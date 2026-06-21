import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
}

serve(async (req) => {
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
      const [defRes, txRes, targetRes] = await Promise.all([
        supabase.from('portfolio_asset_definitions').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('portfolio_transactions').select('*').eq('portfolio_id', portfolio.id).order('date', { ascending: true }),
        supabase.from('target_allocations').select('*').eq('portfolio_id', portfolio.id)
      ])

      const definitions = defRes.data || []
      const transactions = txRes.data || []
      const targets = targetRes.data || []

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
          const res = await fetch(url)
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

      // 4. Carregar taxas diárias CDI/SELIC
      const startDate = transactions[0].date
      const { data: dbRates } = await supabase
        .from('index_rates')
        .select('rate_date, indexer, daily_rate')
        .gte('rate_date', startDate)
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

      // 5. Carregar cotações de fechamento históricas do banco de dados
      const { data: dbPrices } = await supabase
        .from('asset_price_daily')
        .select('ticker, price_date, close_price')
        .in('ticker', tickers)
        .gte('price_date', startDate)
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

      // 6. Algoritmo de Fechamento Diário e Cotização (TWR)
      let curDate = new Date(startDate)
      const endDate = new Date(todayStr)
      
      let totalShares = 0
      let lastShareValue = 1.0

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
          dateStr
        )

        // Cota inicial ou reajustada pela valorização dos ativos
        if (totalShares > 0) {
          lastShareValue = valuationPrev.totalValue / totalShares
        } else if (valuationPrev.totalValue > 0) {
          totalShares = valuationPrev.totalValue
          lastShareValue = 1.0
        }

        // Aplicar transações do dia (aportes/resgates/proventos)
        let cashFlow = 0
        for (const tx of dayTxs) {
          const q = Number(tx.quantity)
          const p = Number(tx.price)
          const type = tx.operation_type

          // Aportes de capital (aumentam patrimônio sem valorizar cota)
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

        // Valoração final do dia (fim do dia, incluindo transações de hoje)
        const dayValuation = calculateSnapshotValuation(
          transactions,
          definitions,
          priceMap,
          prices,
          ratesMap,
          dateStr
        )

        const grossPL = dayValuation.totalValue
        const investedCost = dayValuation.investedCostBasis + dayValuation.cashValue
        const netPL = grossPL - investedCost

        // Atualizar share value final do dia (para o dia seguinte e para gravação)
        const endShareValue = totalShares > 0 ? grossPL / totalShares : 1.0
        lastShareValue = endShareValue

        // Gravar no histórico de cota diária usando upsert seguro
        await supabase.from('portfolio_share_daily').upsert({
          portfolio_id: portfolio.id,
          rate_date: dateStr,
          share_value: endShareValue,
          gross_pl: grossPL,
          net_pl: netPL,
          total_shares: totalShares
        }, { onConflict: 'portfolio_id,rate_date' })

        // Snapshot Mensal
        const isLastDayOfMonth = (date: Date) => {
          const test = new Date(date)
          test.setDate(test.getDate() + 1)
          return test.getMonth() !== date.getMonth()
        }

        if (isLastDayOfMonth(curDate)) {
          const periodKey = `${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, '0')}`
          
          // Abertura do mês = primeira cota do mês ou cota_fechamento do mês anterior
          const startMonthDate = new Date(curDate.getFullYear(), curDate.getMonth(), 1).toISOString().slice(0, 10)
          
          const { data: firstCota } = await supabase
            .from('portfolio_share_daily')
            .select('share_value')
            .eq('portfolio_id', portfolio.id)
            .gte('rate_date', startMonthDate)
            .order('rate_date', { ascending: true })
            .limit(1)
            .maybeSingle()

          const cotaAbertura = firstCota?.share_value ? Number(firstCota.share_value) : 1.0
          const periodReturn = cotaAbertura > 0 ? (endShareValue / cotaAbertura) - 1 : 0

          await supabase.from('portfolio_period_snapshots').upsert({
            portfolio_id: portfolio.id,
            period_type: 'month',
            period_key: periodKey,
            cota_abertura: cotaAbertura,
            cota_fechamento: endShareValue,
            somatorio_aportes: cashFlow > 0 ? cashFlow : 0,
            somatorio_resgates: cashFlow < 0 ? Math.abs(cashFlow) : 0,
            dividendos_recebidos: 0,
            drawdown_maximo: 0,
            period_return: periodReturn
          }, { onConflict: 'portfolio_id,period_type,period_key' })
        }

        curDate.setDate(curDate.getDate() + 1)
      }

      // 7. Atualizar colunas cache do portfolios
      const finalInvested = (positions = []) => {
        // Obtermos valoração final para atualizar o portfolios
        const finalVal = calculateSnapshotValuation(
          transactions,
          definitions,
          priceMap,
          prices,
          ratesMap,
          todayStr
        )
        return finalVal.investedCostBasis + finalVal.cashValue
      }
      
      const finalValuation = calculateSnapshotValuation(
        transactions,
        definitions,
        priceMap,
        prices,
        ratesMap,
        todayStr
      )

      const finalGross = finalValuation.totalValue
      const finalCost = finalValuation.investedCostBasis + finalValuation.cashValue

      await supabase.from('portfolios').update({
        total_shares: totalShares,
        last_share_value: lastShareValue,
        last_close_date: todayStr,
        last_gross_pl: finalGross,
        last_net_pl: finalGross - finalCost
      }).eq('id', portfolio.id)

      // Atualizar cash_balance no portfólio de acordo com transações
      await supabase.from('portfolios').update({
        cash_balance: finalValuation.cashValue
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

  } catch (err) {
    console.error('Erro na Edge Function daily-close:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// Função local auxiliar para valoração de carteira de fechamento histórico no servidor
function calculateSnapshotValuation(
  transactions: any[],
  definitions: any[],
  priceMap: Record<string, Record<string, number>>,
  pricesToday: Record<string, number>,
  indexRates: Record<string, Record<string, number>>,
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

    for (const tx of txs) {
      const q = Number(tx.quantity)
      const p = Number(tx.price)
      
      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        quantity += q
        totalCost += q * p
      } else if (tx.operation_type === 'sell') {
        if (quantity > 0) {
          const pm = totalCost / quantity
          quantity = Math.max(0, quantity - q)
          totalCost = quantity * pm
        }
      } else if (tx.operation_type === 'split') {
        quantity += q
      } else if (tx.operation_type === 'reverse_split') {
        quantity = Math.max(0, quantity - q)
      }
    }

    if (quantity <= 0 && totalCost <= 0) continue

    const isLegacyCash = legacyCashTickers.includes(ticker)
    const pricingMode = isLegacyCash ? 'cash' : (definition?.pricing_mode ?? 'market')
    
    let totalValue = 0

    if (pricingMode === 'fixed_income') {
      const idx = definition?.indexer ?? 'none'
      const activeRates = indexRates[idx.toLowerCase()] ?? {}
      
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
      // Valoração de mercado a partir de preço histórico com forward-fill
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
