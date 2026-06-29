import { supabase } from '@/lib/supabase'
import { fetchWithCorsProxy } from '@/services/priceService'
import { sortTransactionsStably } from '@/utils/portfolioOperations'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { computeDailyShareHistory } from '@/utils/portfolioTwrEngine'
import { logger } from '@/utils/logger'

interface PriceApiResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number
      }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          close?: (number | null)[]
        }>
      }
    }>
  }
}

async function fetchAllIndexRates(startDate: string, endDate: string): Promise<any[]> {
  let allRates: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('index_rates')
      .select('rate_date, indexer, daily_rate')
      .gte('rate_date', startDate)
      .lte('rate_date', endDate)
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allRates = [...allRates, ...data]
      if (data.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  return allRates
}

async function fetchAllVna(startDate: string, endDate: string): Promise<any[]> {
  let allVna: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('vna_daily')
      .select('reference_date, vna_value')
      .gte('reference_date', startDate)
      .lte('reference_date', endDate)
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allVna = [...allVna, ...data]
      if (data.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  return allVna
}

async function fetchAllAssetPrices(tickers: string[], startDate: string, endDate: string): Promise<any[]> {
  let allPrices: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('asset_price_daily')
      .select('ticker, price_date, close_price')
      .in('ticker', tickers)
      .gte('price_date', startDate)
      .lte('price_date', endDate)
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allPrices = [...allPrices, ...data]
      if (data.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  return allPrices
}

/**
 * Executa o recálculo histórico do TWR (Time Weighted Return) e da cota diária do portfólio no frontend.
 * Funciona como fallback resiliente caso o motor do backend (Supabase Edge Function daily-close) falhe ou esteja indisponível.
 *
 * @param portfolioId - ID do portfólio a recalcular
 * @param onProgress - Callback opcional para reportar progresso
 */
export async function runClientSideHistoricalRecalculation(
  portfolioId: string,
  onProgress?: (phase: string, current: number, total: number) => void
): Promise<void> {
  logger.info(`[recalcFallback] Iniciando recálculo do portfólio ${portfolioId}...`)
  onProgress?.('Iniciando recálculo...', 0, 5)
  const todayStr = new Date().toISOString().slice(0, 10)

  onProgress?.('Carregando transações e definições...', 1, 5)
  const [txsData, defRes] = await Promise.all([
    fetchAllPortfolioTransactions(portfolioId),
    supabase
      .from('portfolio_asset_definitions')
      .select('*')
      .eq('portfolio_id', portfolioId)
  ])

  if (defRes.error) throw defRes.error

  const rawTransactions = sortTransactionsStably(txsData || [])
  const definitions = defRes.data || []

  if (rawTransactions.length === 0) {
    logger.info(`[recalcFallback] Portfólio sem transações. Limpando histórico e zerando métricas.`)
    await Promise.all([
      supabase.from('portfolio_share_daily').delete().eq('portfolio_id', portfolioId),
      supabase.from('portfolio_period_snapshots').delete().eq('portfolio_id', portfolioId),
      supabase.from('portfolios').update({
        total_shares: 0,
        last_share_value: 1.0,
        last_close_date: todayStr,
        last_gross_pl: 0,
        last_net_pl: 0,
        cash_balance: 0
      }).eq('id', portfolioId)
    ])
    return
  }

  onProgress?.('Buscando cotações históricas...', 2, 5)
  const tickers = Array.from(new Set(rawTransactions.map(t => t.ticker.trim().toUpperCase())))
  const startDateStr = rawTransactions[0].date

  const period1 = Math.floor(new Date(startDateStr).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000) + 86400

  for (const ticker of tickers) {
    if (['CDI', 'SELIC', 'IPCA', 'TESOURO', 'CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA', 'SALDO'].some(term => ticker.includes(term))) {
      continue
    }
    try {
      let symbol = ticker
      if (['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT'].includes(ticker)) {
        symbol = `${ticker}-BRL`
      } else {
        const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(ticker)
        symbol = isB3 ? `${ticker}.SA` : ticker
      }
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`
      const res = await fetchWithCorsProxy(url)
      if (res.ok) {
        const data = await res.json() as PriceApiResponse
        const result = data?.chart?.result?.[0]
        if (result) {
          const currentPrice = result.meta?.regularMarketPrice
          if (currentPrice !== undefined) {
            await supabase.from('asset_prices').upsert({
              ticker,
              current_price: currentPrice,
              last_updated: new Date().toISOString()
            })
          }

          const timestamps = result.timestamp || []
          const quotes = result.indicators?.quote?.[0]?.close || []
          const upsertData = []

          for (let i = 0; i < timestamps.length; i++) {
            const ts = timestamps[i]
            if (typeof ts === 'number' && !isNaN(ts)) {
              const priceDate = new Date(ts * 1000).toISOString().slice(0, 10)
              const closePrice = quotes[i]
              if (closePrice !== null && closePrice !== undefined && closePrice > 0) {
                upsertData.push({
                  ticker,
                  price_date: priceDate,
                  close_price: closePrice,
                  source: 'yahoo'
                })
              }
            }
          }

          if (upsertData.length > 0) {
            await supabase.from('asset_price_daily').upsert(upsertData, { onConflict: 'ticker,price_date' })
          }
        }
      }
    } catch (err) {
      logger.warn(`[recalcFallback] Erro ao buscar cotações históricas para ${ticker}:`, err)
    }
  }

  onProgress?.('Carregando taxas de indexadores...', 3, 5)
  const [dbRates, dbVna] = await Promise.all([
    fetchAllIndexRates(startDateStr, todayStr),
    fetchAllVna(startDateStr, todayStr)
  ])

  const ratesMap: Record<string, Record<string, number>> = { cdi: {}, selic: {}, ipca: {} }
  if (dbRates) {
    for (const r of dbRates) {
      const idx = r.indexer.toLowerCase()
      if (ratesMap[idx]) {
        ratesMap[idx][r.rate_date] = Number(r.daily_rate)
      }
    }
  }

  const vnaMap: Record<string, number> = {}
  if (dbVna) {
    for (const v of dbVna) {
      vnaMap[v.reference_date] = Number(v.vna_value)
    }
  }

  onProgress?.('Carregando preços históricos...', 4, 5)
  const dbPrices = await fetchAllAssetPrices(tickers, startDateStr, todayStr)

  const priceMap: Record<string, Record<string, number>> = {}
  for (const ticker of tickers) {
    priceMap[ticker] = {}
  }
  if (dbPrices) {
    for (const p of dbPrices) {
      const t = p.ticker.trim().toUpperCase()
      if (priceMap[t]) {
        priceMap[t][p.price_date] = Number(p.close_price)
      }
    }
  }

  const { data: curPricesData } = await supabase
    .from('asset_prices')
    .select('ticker, current_price')
    .in('ticker', tickers)
  const pricesToday: Record<string, number> = {}
  if (curPricesData) {
    for (const row of curPricesData) {
      pricesToday[row.ticker.toUpperCase()] = Number(row.current_price)
    }
  }

  await Promise.all([
    supabase.from('portfolio_share_daily').delete().eq('portfolio_id', portfolioId),
    supabase.from('portfolio_period_snapshots').delete().eq('portfolio_id', portfolioId)
  ])

  onProgress?.('Calculando histórico de cotas...', 5, 5)
  const {
    dailyRows,
    periodSnapshots,
    totalShares,
    lastShareValue,
    cumulativeExternalContribution
  } = computeDailyShareHistory({
    portfolioId,
    transactions: rawTransactions,
    definitions,
    priceMap,
    pricesToday,
    indexRates: ratesMap,
    vnaMap,
    startDate: startDateStr,
    endDate: todayStr
  })

  if (dailyRows.length > 0) {
    const CHUNK_SIZE = 100
    for (let i = 0; i < dailyRows.length; i += CHUNK_SIZE) {
      const chunk = dailyRows.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('portfolio_share_daily').upsert(chunk, { onConflict: 'portfolio_id,rate_date' })
      if (error) throw error
    }
  }

  if (periodSnapshots.length > 0) {
    const { error } = await supabase.from('portfolio_period_snapshots').upsert(periodSnapshots, { onConflict: 'portfolio_id,period_type,period_key' })
    if (error) throw error
  }

  const lastRow = dailyRows[dailyRows.length - 1]
  const finalGross = lastRow
    ? lastRow.gross_pl + lastRow.cash_value
    : 0
  const finalCost = cumulativeExternalContribution

  const { error: finalError } = await supabase
    .from('portfolios')
    .update({
      total_shares: totalShares,
      last_share_value: lastShareValue,
      last_close_date: todayStr,
      last_gross_pl: finalGross,
      last_net_pl: finalGross - finalCost,
      cash_balance: lastRow?.cash_value ?? 0
    })
    .eq('id', portfolioId)

  if (finalError) throw finalError
  logger.info(`[recalcFallback] Recálculo do portfólio ${portfolioId} finalizado com sucesso (${dailyRows.length} dias).`)
}
