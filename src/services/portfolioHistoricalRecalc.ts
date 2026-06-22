import { supabase } from '@/lib/supabase'
import { fetchWithCorsProxy } from '@/services/priceService'

/**
 * Executa o recálculo histórico do TWR (Time Weighted Return) e da cota diária do portfólio no frontend.
 * Funciona como fallback resiliente caso o motor do backend (Supabase Edge Function daily-close) falhe ou esteja indisponível.
 */
export async function runClientSideHistoricalRecalculation(portfolioId: string): Promise<void> {
  console.log(`[recalcFallback] Iniciando recálculo do portfólio ${portfolioId}...`)
  const todayStr = new Date().toISOString().slice(0, 10)

  // 1. Carregar transações e definições
  const [txRes, defRes] = await Promise.all([
    supabase
      .from('portfolio_transactions')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('date', { ascending: true }),
    supabase
      .from('portfolio_asset_definitions')
      .select('*')
      .eq('portfolio_id', portfolioId)
  ])

  if (txRes.error) throw txRes.error
  if (defRes.error) throw defRes.error

  const transactions = txRes.data || []
  const definitions = defRes.data || []

  if (transactions.length === 0) {
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

  const tickers = Array.from(new Set(transactions.map(t => t.ticker.trim().toUpperCase())))
  const startDateStr = transactions[0].date

  // 2. Buscar preços de mercado históricos (Yahoo Finance) via CORS Proxy para alimentar o banco de dados
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

  // 3. Carregar taxas diárias CDI/SELIC
  const { data: dbRates } = await supabase
    .from('index_rates')
    .select('rate_date, indexer, daily_rate')
    .gte('rate_date', startDateStr)
    .lte('rate_date', todayStr)

  const ratesMap: Record<string, Record<string, number>> = { cdi: {}, selic: {}, ipca: {} }
  if (dbRates) {
    for (const r of dbRates) {
      const idx = r.indexer.toLowerCase()
      if (ratesMap[idx]) {
        ratesMap[idx][r.rate_date] = Number(r.daily_rate)
      }
    }
  }

  // 4. Carregar cotações de fechamento históricas salvas no banco
  const { data: dbPrices } = await supabase
    .from('asset_price_daily')
    .select('ticker, price_date, close_price')
    .in('ticker', tickers)
    .gte('price_date', startDateStr)
    .lte('price_date', todayStr)

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

  // 5. Carregar cotações atuais do cache para valoração
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

  // 6. Limpar histórico antigo da carteira antes de reinserir
  await Promise.all([
    supabase.from('portfolio_share_daily').delete().eq('portfolio_id', portfolioId),
    supabase.from('portfolio_period_snapshots').delete().eq('portfolio_id', portfolioId)
  ])

  // 7. Algoritmo de Cotização Diária (TWR)
  const curDate = new Date(startDateStr)
  const endDate = new Date(todayStr)
  
  let totalShares = 0
  let lastShareValue = 1.0
  let cumulativeExternalContribution = 0

  const dailyRows: any[] = []
  const periodSnapshots: any[] = []

  while (curDate <= endDate) {
    const dateStr = curDate.toISOString().slice(0, 10)

    // Transações do dia
    const dayTxs = transactions.filter(t => t.date === dateStr)

    // Posições no dia anterior (para calcular V_d_prev e ajustar cota)
    const prevTxs = transactions.filter(t => t.date < dateStr)
    const valuationPrev = calculateSnapshotValuation(
      prevTxs,
      definitions,
      priceMap,
      pricesToday,
      ratesMap,
      dateStr
    )

    // Cota inicial ou reajustada pela valorização da carteira (incluindo caixa)
    if (totalShares > 0) {
      lastShareValue = valuationPrev.totalValue / totalShares
    } else if (valuationPrev.totalValue > 0) {
      totalShares = valuationPrev.totalValue
      lastShareValue = 1.0
    }

    // Aplicar transações do dia (aportes/resgates/proventos)
    let cashFlow = 0
    const legacyCashTickers = ['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA']
    for (const tx of dayTxs) {
      const tickerUpper = tx.ticker.trim().toUpperCase()
      const isCash = legacyCashTickers.includes(tickerUpper) || 
        definitions.some(d => d.ticker.trim().toUpperCase() === tickerUpper && d.pricing_mode === 'cash')

      // Ignorar se for offset automático de proventos/rendimentos (não afeta fluxo externo)
      if (isCash && tx.cash_offset_source_id) {
        const sourceTx = transactions.find(t => t.id === tx.cash_offset_source_id)
        if (sourceTx && ['dividend', 'jcp', 'fii_yield'].includes(sourceTx.operation_type)) {
          continue
        }
      }

      const q = Number(tx.quantity)
      const p = Number(tx.price)
      const type = tx.operation_type

      if (type === 'buy' || type === 'subscription') {
        cashFlow += q * p
      } else if (type === 'sell') {
        cashFlow -= q * p
      }
    }

    if (cashFlow !== 0) {
      const cota = lastShareValue > 0 ? lastShareValue : 1.0
      const sharesDiff = cashFlow / cota
      totalShares = Math.max(0, totalShares + sharesDiff)
    }

    cumulativeExternalContribution += cashFlow

    // Valoração final do dia (fim do dia, incluindo transações de hoje)
    const dayValuation = calculateSnapshotValuation(
      transactions,
      definitions,
      priceMap,
      pricesToday,
      ratesMap,
      dateStr
    )

    const grossPL = dayValuation.investedValue // Bruto investido (exclui caixa)
    const netPL = grossPL - dayValuation.investedCostBasis // Lucro investido (exclui caixa)

    // Atualizar share value final do dia com base no valor total (incluindo caixa) com guardrail para valores pequenos
    let endShareValue = 1.0
    if (dayValuation.totalValue <= 0.01) {
      totalShares = 0
      endShareValue = 1.0
    } else if (totalShares > 0) {
      endShareValue = dayValuation.totalValue / totalShares
    } else {
      totalShares = dayValuation.totalValue
      endShareValue = 1.0
    }
    lastShareValue = endShareValue

    dailyRows.push({
      portfolio_id: portfolioId,
      rate_date: dateStr,
      share_value: endShareValue,
      gross_pl: grossPL,
      net_pl: netPL,
      total_shares: totalShares
    })

    // Snapshot Mensal
    const isLastDayOfMonth = (date: Date) => {
      const test = new Date(date)
      test.setDate(test.getDate() + 1)
      return test.getMonth() !== date.getMonth()
    }

    if (isLastDayOfMonth(curDate)) {
      const periodKey = `${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, '0')}`
      const startMonthDate = new Date(curDate.getFullYear(), curDate.getMonth(), 1).toISOString().slice(0, 10)
      
      const firstCota = dailyRows.find(row => row.rate_date >= startMonthDate)
      const cotaAbertura = firstCota?.share_value ? Number(firstCota.share_value) : 1.0
      const periodReturn = cotaAbertura > 0 ? (endShareValue / cotaAbertura) - 1 : 0

      periodSnapshots.push({
        portfolio_id: portfolioId,
        period_type: 'month',
        period_key: periodKey,
        cota_abertura: cotaAbertura,
        cota_fechamento: endShareValue,
        somatorio_aportes: cashFlow > 0 ? cashFlow : 0,
        somatorio_resgates: cashFlow < 0 ? Math.abs(cashFlow) : 0,
        dividendos_recebidos: 0,
        drawdown_maximo: 0,
        period_return: periodReturn
      })
    }

    curDate.setDate(curDate.getDate() + 1)
  }

  // 8. Gravar os dados calculados no histórico
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

  // 9. Atualizar dados consolidados na tabela de portfolios
  const finalValuation = calculateSnapshotValuation(
    transactions,
    definitions,
    priceMap,
    pricesToday,
    ratesMap,
    todayStr
  )

  const finalGross = finalValuation.totalValue
  const finalCost = cumulativeExternalContribution

  const { error: finalError } = await supabase
    .from('portfolios')
    .update({
      total_shares: totalShares,
      last_share_value: lastShareValue,
      last_close_date: todayStr,
      last_gross_pl: finalGross,
      last_net_pl: finalGross - finalCost,
      cash_balance: finalValuation.cashValue
    })
    .eq('id', portfolioId)

  if (finalError) throw finalError
  console.log(`[recalcFallback] Recálculo do portfólio ${portfolioId} finalizado com sucesso.`)
}

function calculateSnapshotValuation(
  transactions: any[],
  definitions: any[],
  priceMap: Record<string, Record<string, number>>,
  pricesToday: Record<string, number>,
  _indexRates: Record<string, Record<string, number>>,
  asOfDate: string
) {
  const txByTicker: Record<string, any[]> = {}
  for (const tx of transactions) {
    if (tx.date > asOfDate) continue
    const ticker = tx.ticker.trim().toUpperCase()
    if (!txByTicker[ticker]) txByTicker[ticker] = []
    txByTicker[ticker].push(tx)
  }

  const defByTicker = Object.fromEntries(
    definitions.map((d) => [d.ticker.trim().toUpperCase(), d])
  )

  const legacyCashTickers = ['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA']
  const cashTickers = new Set([
    ...legacyCashTickers,
    ...definitions.filter(d => d.pricing_mode === 'cash').map(d => d.ticker.toUpperCase().trim())
  ])

  const tickers = new Set([
    ...Object.keys(txByTicker),
    ...Object.keys(defByTicker)
  ])

  let investedValue = 0
  let cashValue = 0
  let investedCostBasis = 0

  for (const ticker of tickers) {
    const txs = [...(txByTicker[ticker] ?? [])]
    const definition = defByTicker[ticker]

    let quantity = 0
    let totalCost = 0
    const isCash = cashTickers.has(ticker)

    for (const tx of txs) {
      const q = Number(tx.quantity)
      const p = Number(tx.price)
      
      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        if (isCash) {
          totalCost += q * p
          quantity = totalCost
        } else {
          quantity += q
          totalCost += q * p
        }
      } else if (tx.operation_type === 'sell') {
        if (isCash) {
          totalCost = Math.max(0, totalCost - q * p)
          quantity = totalCost
        } else if (quantity > 0) {
          const pm = totalCost / quantity
          quantity = Math.max(0, quantity - q)
          totalCost = quantity * pm
        }
      } else if (tx.operation_type === 'split') {
        if (!isCash) quantity += q
      } else if (tx.operation_type === 'reverse_split') {
        if (!isCash) quantity = Math.max(0, quantity - q)
      }
    }

    if (quantity <= 0 && totalCost <= 0) continue

    const pricingMode = isCash ? 'cash' : (definition?.pricing_mode ?? 'market')
    
    let totalValue = 0

    if (pricingMode === 'fixed_income') {
      const idx = definition?.indexer ?? 'none'
      
      const appDate = definition?.application_date ?? (txs[0]?.date || asOfDate)
      const diffDays = Math.max(0, (new Date(asOfDate).getTime() - new Date(appDate).getTime()) / (1000 * 60 * 60 * 24))
      const rate = definition?.contract_rate ?? 0
      
      if (idx === 'none') {
        const dailyRate = Math.pow(1 + rate / 100, 1 / 252) - 1
        totalValue = totalCost * Math.pow(1 + dailyRate, diffDays * 5 / 7)
      } else {
        const avgIndexerDaily = idx === 'cdi' ? 0.000412 : 0.000411
        const percent = definition?.indexer_percent ?? 100
        const dailyRate = avgIndexerDaily * (percent / 100)
        totalValue = totalCost * Math.pow(1 + dailyRate, diffDays * 5 / 7)
      }
    } else if (pricingMode === 'manual_value') {
      totalValue = quantity > 0 ? (definition?.manual_current_value ?? totalCost) : 0
    } else if (pricingMode === 'cash') {
      totalValue = totalCost
    } else {
      const tickerPrices = priceMap[ticker]
      let dayPrice = 0
      
      if (tickerPrices && tickerPrices[asOfDate] !== undefined) {
        dayPrice = tickerPrices[asOfDate]
      } else if (tickerPrices) {
        const priceDates = Object.keys(tickerPrices).sort()
        let lastPrice = pricesToday[ticker] ?? 0
        for (const pd of priceDates) {
          if (pd > asOfDate) break
          lastPrice = tickerPrices[pd]
        }
        dayPrice = lastPrice
      } else {
        dayPrice = pricesToday[ticker] ?? 0
      }

      totalValue = quantity * (dayPrice > 0 ? dayPrice : (quantity > 0 ? totalCost / quantity : 0))
    }

    if (pricingMode === 'cash') {
      cashValue += totalValue
    } else {
      investedValue += totalValue
      investedCostBasis += totalCost
    }
  }

  return {
    investedValue,
    cashValue,
    totalValue: investedValue + cashValue,
    investedCostBasis
  }
}
