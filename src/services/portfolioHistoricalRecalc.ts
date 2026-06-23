import { supabase } from '@/lib/supabase'
import { fetchWithCorsProxy } from '@/services/priceService'
import { sortTransactionsStably } from '@/utils/portfolioOperations'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { computeDailyShareHistory } from '@/utils/portfolioTwrEngine'

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
 */
export async function runClientSideHistoricalRecalculation(portfolioId: string): Promise<void> {
  console.log(`[recalcFallback] Iniciando recálculo do portfólio ${portfolioId}...`)
  const todayStr = new Date().toISOString().slice(0, 10)

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
    console.log(`[recalcFallback] Portfólio sem transações. Limpando histórico e zerando métricas.`)
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
        const data = await res.json() as any
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
      console.warn(`[recalcFallback] Erro ao buscar cotações históricas para ${ticker}:`, err)
    }
  }

  const dbRates = await fetchAllIndexRates(startDateStr, todayStr)

  const ratesMap: Record<string, Record<string, number>> = { cdi: {}, selic: {}, ipca: {} }
  if (dbRates) {
    for (const r of dbRates) {
      const idx = r.indexer.toLowerCase()
      if (ratesMap[idx]) {
        ratesMap[idx][r.rate_date] = Number(r.daily_rate)
      }
    }
  }

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
  console.log(`[recalcFallback] Recálculo do portfólio ${portfolioId} finalizado com sucesso (${dailyRows.length} dias).`)
}
