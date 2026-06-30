import { createClient } from "npm:@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
}

function sortTransactionsStably(transactions: any[]): any[] {
  const getPriority = (type: string): number => {
    const priorities: Record<string, number> = {
      split: 1,
      reverse_split: 1,
      buy: 2,
      subscription: 2,
      sell: 3,
      dividend: 4,
      jcp: 4,
      fii_yield: 4,
    }
    return priorities[type] ?? 99
  }

  return [...transactions].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date)
    if (dateDiff !== 0) return dateDiff

    const prioDiff = getPriority(a.operation_type) - getPriority(b.operation_type)
    if (prioDiff !== 0) return prioDiff

    const createdDiff = (a.created_at || '').localeCompare(b.created_at || '')
    if (createdDiff !== 0) return createdDiff

    return (a.id || '').localeCompare(b.id || '')
  })
}

async function fetchAllPortfolioTransactions(supabase: any, portfolioId: string): Promise<any[]> {
  let allTxs: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('portfolio_transactions')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('date', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allTxs = [...allTxs, ...data]
      if (data.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  return allTxs
}

async function fetchAllIndexRates(supabase: any, startDate: string, endDate: string): Promise<any[]> {
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

async function fetchAllAssetPrices(supabase: any, tickers: string[], startDate: string, endDate: string): Promise<any[]> {
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

Deno.serve(async (req) => {
  // CORS check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente nas variáveis de ambiente.')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })



    // Parse target portfolioId from request body if available
    let targetPortfolioId = null
    try {
      const body = await req.json()
      if (body && body.portfolioId) {
        targetPortfolioId = body.portfolioId
      }
    } catch (_) {
      // Empty or invalid body is ignored, runs for all portfolios
    }

    // 1. Obter portfólios ativos
    let portfoliosQuery = supabase.from('portfolios').select('id, client_id, cash_balance')
    if (targetPortfolioId) {
      portfoliosQuery = portfoliosQuery.eq('id', targetPortfolioId)
    }
    const { data: portfolios, error: portError } = await portfoliosQuery

    if (portError) throw portError
    if (!portfolios || portfolios.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum portfólio encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const processedPortfolios = []

    for (const portfolio of portfolios) {
      // 2. Carregar definições e transações
      const [defRes, txsData] = await Promise.all([
        supabase.from('portfolio_asset_definitions').select('*').eq('portfolio_id', portfolio.id),
        fetchAllPortfolioTransactions(supabase, portfolio.id)
      ])

      const definitions = defRes.data || []
      const rawTransactions = sortTransactionsStably(txsData || [])
      const transactions = adjustTransactionsForSplits(rawTransactions)

      if (transactions.length === 0) {
        // Limpar todo o histórico e snapshots caso não existam mais transações
        await Promise.all([
          supabase.from('portfolio_share_daily').delete().eq('portfolio_id', portfolio.id),
          supabase.from('portfolio_period_snapshots').delete().eq('portfolio_id', portfolio.id)
        ])
        
        // Resetar as métricas acumuladas do portfólio no banco
        await supabase.from('portfolios').update({
          total_shares: 0,
          last_share_value: 1.0,
          last_close_date: todayStr,
          last_gross_pl: 0,
          last_net_pl: 0,
          cash_balance: 0
        }).eq('id', portfolio.id)
        
        continue
      }

      // 2.5 Limpar todo o histórico antigo e snapshots da carteira antes de iniciar o recálculo
      await Promise.all([
        supabase.from('portfolio_share_daily').delete().eq('portfolio_id', portfolio.id),
        supabase.from('portfolio_period_snapshots').delete().eq('portfolio_id', portfolio.id)
      ])

      const tickers = Array.from(new Set(transactions.map(t => t.ticker.trim().toUpperCase())))

      // Limpar definições e metas de ativos órfãos que não possuem mais transações
      const [defRes, targetRes] = await Promise.all([
        supabase.from('portfolio_asset_definitions').select('ticker').eq('portfolio_id', portfolio.id),
        supabase.from('target_allocations').select('ticker').eq('portfolio_id', portfolio.id)
      ])

      const existingDefs = (defRes.data || []).map((d: any) => d.ticker.trim().toUpperCase())
      const existingTargets = (targetRes.data || []).map((t: any) => t.ticker.trim().toUpperCase())
      const allRegisteredTickers = Array.from(new Set([...existingDefs, ...existingTargets]))
      const orphanTickers = allRegisteredTickers.filter(t => !tickers.includes(t))

      if (orphanTickers.length > 0) {
        await Promise.all([
          supabase.from('portfolio_asset_definitions').delete().eq('portfolio_id', portfolio.id).in('ticker', orphanTickers),
          supabase.from('target_allocations').delete().eq('portfolio_id', portfolio.id).in('ticker', orphanTickers)
        ])

        // Limpar preços e cotações diárias globais se o ticker não for usado por nenhuma outra carteira
        for (const ticker of orphanTickers) {
          const { data: remainingTx } = await supabase
            .from('portfolio_transactions')
            .select('id')
            .eq('ticker', ticker)
            .limit(1)

          if (!remainingTx || remainingTx.length === 0) {
            await Promise.all([
              supabase.from('asset_price_daily').delete().eq('ticker', ticker),
              supabase.from('asset_prices').delete().eq('ticker', ticker)
            ])
            // console.log removed for production
          }
        }
      }

      // 3. Buscar preços de mercado históricos (Yahoo Finance)
      const prices: Record<string, number> = {}
      const startDate = transactions[0].date
      const period1 = Math.floor(new Date(startDate).getTime() / 1000)
      const period2 = Math.floor(Date.now() / 1000) + 86400

      for (const ticker of tickers) {
        if (['CDI', 'SELIC', 'IPCA', 'TESOURO', 'CAIXA', 'SALDO'].some(term => ticker.includes(term))) {
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
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
          })
          if (res.ok) {
            const data = await res.json()
            const result = data?.chart?.result?.[0]
            if (result) {
              const currentPrice = result.meta?.regularMarketPrice
              if (currentPrice !== undefined) {
                prices[ticker] = currentPrice
                // Salvar no cache asset_prices do banco de dados
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
          console.warn(`Erro ao buscar cotação de ${ticker}:`, err)
        }
      }

      // 4. Carregar taxas diárias CDI/SELIC e VNA
      const startDateStr = transactions[0].date
      const [dbRates, vnaRes] = await Promise.all([
        fetchAllIndexRates(supabase, startDateStr, todayStr),
        supabase
          .from('vna_daily')
          .select('reference_date, vna_value')
          .gte('reference_date', startDateStr)
          .lte('reference_date', todayStr)
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
      if (vnaRes && vnaRes.data) {
        for (const v of vnaRes.data) {
          vnaMap[v.reference_date] = Number(v.vna_value)
        }
      }

      // 5. Carregar cotações de fechamento históricas do banco de dados
      const dbPrices = await fetchAllAssetPrices(supabase, tickers, startDateStr, todayStr)

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

      // 6. Algoritmo de Fechamento Diário e Cotização (TWR)
      const curDate = new Date(startDateStr)
      const endDate = new Date(todayStr)
      
      let totalShares = 0
      let lastShareValue = 1.0
      let cumulativeExternalContribution = 0
      let monthlyCashFlow = 0
      let monthlyDividends = 0
      let peakShareValue = 1.0
      let monthlyMaxDrawdown = 0

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
          prices,
          ratesMap,
          vnaMap,
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
        let dayDividends = 0
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
          } else if (['dividend', 'jcp', 'fii_yield'].includes(type)) {
            dayDividends += q * p
          }
        }

        if (cashFlow !== 0) {
          const cota = lastShareValue > 0 ? lastShareValue : 1.0
          const sharesDiff = cashFlow / cota
          totalShares = Math.max(0, totalShares + sharesDiff)
        }

        cumulativeExternalContribution += cashFlow
        monthlyCashFlow += cashFlow
        monthlyDividends += dayDividends

        // Valoração final do dia (fim do dia, incluindo transações de hoje)
        const dayValuation = calculateSnapshotValuation(
          transactions,
          definitions,
          priceMap,
          prices,
          ratesMap,
          vnaMap,
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

        // Track drawdown: update peak and calculate current drawdown
        if (endShareValue > peakShareValue) {
          peakShareValue = endShareValue
        } else if (peakShareValue > 0) {
          const currentDrawdown = (peakShareValue - endShareValue) / peakShareValue
          if (currentDrawdown > monthlyMaxDrawdown) {
            monthlyMaxDrawdown = currentDrawdown
          }
        }

        // Gravar no histórico de cota diária usando upsert seguro
        const round2 = (v: number) => Math.round(v * 100) / 100
        await supabase.from('portfolio_share_daily').upsert({
          portfolio_id: portfolio.id,
          rate_date: dateStr,
          share_value: endShareValue,
          gross_pl: round2(grossPL),
          net_pl: round2(netPL),
          total_shares: totalShares,
          cash_value: round2(dayValuation.cashValue),
          invested_cost: round2(dayValuation.investedCostBasis)
        }, { onConflict: 'portfolio_id,rate_date' })

        // Snapshot Mensal
        const isLastDayOfMonth = (date: Date) => {
          const test = new Date(date)
          test.setDate(test.getDate() + 1)
          return test.getMonth() !== date.getMonth()
        }

        if (isLastDayOfMonth(curDate)) {
          const periodKey = `${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, '0')}`
          
          // Abertura do mês = cota de fechamento do mês anterior
          const startMonthDate = new Date(curDate.getFullYear(), curDate.getMonth(), 1).toISOString().slice(0, 10)
          
          const { data: prevCota } = await supabase
            .from('portfolio_share_daily')
            .select('share_value')
            .eq('portfolio_id', portfolio.id)
            .lt('rate_date', startMonthDate)
            .order('rate_date', { descending: true })
            .limit(1)
            .maybeSingle()

          const cotaAbertura = prevCota?.share_value ? Number(prevCota.share_value) : 1.0
          const periodReturn = cotaAbertura > 0 ? (endShareValue / cotaAbertura) - 1 : 0

          await supabase.from('portfolio_period_snapshots').upsert({
            portfolio_id: portfolio.id,
            period_type: 'month',
            period_key: periodKey,
            cota_abertura: cotaAbertura,
            cota_fechamento: endShareValue,
            somatorio_aportes: monthlyCashFlow > 0 ? monthlyCashFlow : 0,
            somatorio_resgates: monthlyCashFlow < 0 ? Math.abs(monthlyCashFlow) : 0,
            dividendos_recebidos: monthlyDividends,
            drawdown_maximo: monthlyMaxDrawdown,
            period_return: periodReturn
          }, { onConflict: 'portfolio_id,period_type,period_key' })

          // Reset peak and max drawdown for next month
          peakShareValue = endShareValue
          monthlyMaxDrawdown = 0

          // Reset monthly accumulators for next month
          monthlyCashFlow = 0
          monthlyDividends = 0
        }

        curDate.setDate(curDate.getDate() + 1)
      }

      const finalValuation = calculateSnapshotValuation(
        transactions,
        definitions,
        priceMap,
        prices,
        ratesMap,
        vnaMap,
        todayStr
      )

      const finalGross = finalValuation.totalValue
      const finalCost = cumulativeExternalContribution

      const round2 = (v: number) => Math.round(v * 100) / 100
      await supabase.from('portfolios').update({
        total_shares: totalShares,
        last_share_value: lastShareValue,
        last_close_date: todayStr,
        last_gross_pl: round2(finalGross),
        last_net_pl: round2(finalGross - finalCost)
      }).eq('id', portfolio.id)

      // Atualizar cash_balance no portfólio de acordo com transações
      await supabase.from('portfolios').update({
        cash_balance: round2(finalValuation.cashValue)
      }).eq('id', portfolio.id)

      processedPortfolios.push({
        portfolioId: portfolio.id,
        totalShares,
        shareValue: lastShareValue,
        equity: finalGross,
        netProfit: finalGross - finalCost
      })
    }

    return new Response(JSON.stringify({ 
      message: 'Fechamento diário concluído com sucesso.', 
      portfolios: processedPortfolios 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err: any) {
    console.error('Erro na Edge Function daily-close:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// Função local auxiliar para valoração de carteira de fechamento histórico no servidor
function adjustTransactionsForSplits(txs: any[]): any[] {
  // Agrupar por ticker
  const txByTicker: Record<string, any[]> = {}
  for (const tx of txs) {
    const ticker = tx.ticker.trim().toUpperCase()
    if (!txByTicker[ticker]) txByTicker[ticker] = []
    txByTicker[ticker].push(tx)
  }

  const adjustedAll: any[] = []

  for (const ticker of Object.keys(txByTicker)) {
    const sorted = sortTransactionsStably(txByTicker[ticker])
    const hasSplits = sorted.some(tx => tx.operation_type === 'split' || tx.operation_type === 'reverse_split')
    
    if (!hasSplits) {
      adjustedAll.push(...sorted)
      continue
    }

    let qtyMultiplier = 1.0
    const adjusted: any[] = []
    const originalQuantities: number[] = []
    let currentQty = 0

    for (const tx of sorted) {
      originalQuantities.push(currentQty)
      const q = Number(tx.quantity)
      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        currentQty += q
      } else if (tx.operation_type === 'sell') {
        currentQty = Math.max(0, currentQty - q)
      } else if (tx.operation_type === 'split') {
        currentQty += q
      } else if (tx.operation_type === 'reverse_split') {
        currentQty = Math.max(0, currentQty - q)
      }
    }

    for (let i = sorted.length - 1; i >= 0; i--) {
      const tx = sorted[i]
      const type = tx.operation_type
      const q = Number(tx.quantity)
      const p = Number(tx.price)

      if (type === 'split') {
        const qtyBefore = originalQuantities[i]
        if (qtyBefore > 0) {
          const ratio = (qtyBefore + q) / qtyBefore
          qtyMultiplier *= ratio
        }
        continue
      } else if (type === 'reverse_split') {
        const qtyBefore = originalQuantities[i]
        if (qtyBefore > 0) {
          const ratio = Math.max(0, qtyBefore - q) / qtyBefore
          qtyMultiplier *= ratio
        }
        continue
      }

      adjusted.unshift({
        ...tx,
        quantity: q * qtyMultiplier,
        price: qtyMultiplier > 0 ? p / qtyMultiplier : p
      })
    }
    
    adjustedAll.push(...adjusted)
  }

  return sortTransactionsStably(adjustedAll)
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function countBusinessDays(start: string, end: string): number {
  const dStart = parseLocalDate(start)
  const dEnd = parseLocalDate(end)
  if (dStart >= dEnd) return 0

  let count = 0
  const cur = new Date(dStart)
  while (cur < dEnd) {
    if (isBusinessDay(cur)) {
      count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function annualToDailyRate(annualRatePercent: number): number {
  return Math.pow(1 + annualRatePercent / 100, 1 / 252) - 1
}

// Função local auxiliar para valoração de carteira de fechamento histórico no servidor
function calculateSnapshotValuation(
  transactions: any[],
  definitions: any[],
  priceMap: Record<string, Record<string, number>>,
  pricesToday: Record<string, number>,
  indexRates: Record<string, Record<string, number>>,
  vnaMap: Record<string, number>,
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
    const rawTxs = sortTransactionsStably(txByTicker[ticker] ?? [])
    const txs = adjustTransactionsForSplits(rawTxs)
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
      }
    }

    if (quantity <= 0 && totalCost <= 0) continue

    const pricingMode = isCash ? 'cash' : (definition?.pricing_mode ?? 'market')
    
    let totalValue = 0

    if (pricingMode === 'fixed_income') {
      const idx = (definition?.indexer ?? 'none').toLowerCase()
      const activeRates = indexRates[idx] ?? {}
      
      // Acumular lotes de renda fixa para a data de corte
      const lots: { principal: number; date: string; contractRate: number; vnaAtPurchase?: number }[] = []
      let totalQty = 0
      
      for (const tx of txs) {
        const q = Number(tx.quantity)
        const p = Number(tx.price)
        if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
          lots.push({
            principal: q * p,
            date: tx.date,
            contractRate: definition.contract_rate ?? tx.contract_rate ?? 0,
            vnaAtPurchase: tx.vna_at_purchase ? Number(tx.vna_at_purchase) : undefined
          })
          totalQty += q
        } else if (tx.operation_type === 'sell') {
          if (totalQty > 0) {
            const sellRatio = Math.max(0, 1 - (q / totalQty))
            for (const lot of lots) {
              lot.principal *= sellRatio
            }
            totalQty = Math.max(0, totalQty - q)
          }
        }
      }
      
      const vnaToday = idx === 'ipca' ? vnaMap[asOfDate] : undefined

      for (const lot of lots) {
        if (lot.principal <= 0) continue

        let lotVal = 0

        // IPCA+ com VNA ANBIMA
        if (idx === 'ipca' && vnaToday && lot.vnaAtPurchase) {
          const vnaPurchase = lot.vnaAtPurchase
          const vnaFactor = vnaPurchase > 0 ? vnaToday / vnaPurchase : 1.0
          
          const businessDays = countBusinessDays(lot.date, asOfDate)
          const fixedDaily = annualToDailyRate(lot.contractRate)
          const fixedFactor = Math.pow(1 + fixedDaily, businessDays)

          lotVal = lot.principal * vnaFactor * fixedFactor
        } else {
          // Outros indexadores pós-fixados normais por lote
          if (idx === 'none') {
            const businessDays = countBusinessDays(lot.date, asOfDate)
            const dailyRate = annualToDailyRate(lot.contractRate)
            lotVal = lot.principal * Math.pow(1 + dailyRate, businessDays)
          } else if (idx === 'cdi' || idx === 'selic') {
            const curDate = parseLocalDate(lot.date)
            const endDate = parseLocalDate(asOfDate)
            const spreadDaily = lot.contractRate > 0 ? annualToDailyRate(lot.contractRate) : 0
            let factor = 1.0

            while (curDate < endDate) {
              if (isBusinessDay(curDate)) {
                const dateStr = formatLocalDate(curDate)
                const rawRate = activeRates[dateStr] !== undefined ? activeRates[dateStr] : annualToDailyRate(10.75)
                const percent = definition?.indexer_percent ?? 100
                const dailyIndexerRate = rawRate * (percent / 100)
                factor *= (1 + dailyIndexerRate) * (1 + spreadDaily)
              }
              curDate.setDate(curDate.getDate() + 1)
            }
            lotVal = lot.principal * factor
          } else if (idx === 'ipca') {
            // Fallback se não houver VNA
            const businessDays = countBusinessDays(lot.date, asOfDate)
            const dailySpreadRate = annualToDailyRate(lot.contractRate)
            const fixedFactor = Math.pow(1 + dailySpreadRate, businessDays)
            const ipcaDailyRate = annualToDailyRate(4.5)
            const ipcaFactor = Math.pow(1 + ipcaDailyRate, businessDays)
            lotVal = lot.principal * fixedFactor * ipcaFactor
          }
        }

        totalValue += lotVal
      }
    } else if (pricingMode === 'manual_value') {
      totalValue = quantity > 0 ? (definition?.manual_current_value ?? totalCost) : 0
    } else if (pricingMode === 'cash') {
      totalValue = totalCost
    } else {
      // Valoração de mercado a partir de preço histórico com forward-fill
      const tickerPrices = priceMap[ticker]
      let dayPrice = 0
      
      if (tickerPrices && tickerPrices[asOfDate] !== undefined) {
        dayPrice = tickerPrices[asOfDate]
      } else if (tickerPrices) {
        const priceDates = Object.keys(tickerPrices).sort()
        let lastPrice = 0
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
