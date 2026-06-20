import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // 1. Obter todos os portfólios ativos
    const { data: portfolios, error: portError } = await supabase
      .from('portfolios')
      .select('id, client_id, cash_balance')

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
        continue
      }

      const tickers = Array.from(new Set(transactions.map(t => t.ticker.trim().toUpperCase())))

      // 3. Buscar preços de mercado mais recentes (Yahoo Finance)
      const prices: Record<string, number> = {}
      for (const ticker of tickers) {
        if (['CDI', 'SELIC', 'IPCA', 'TESOURO', 'CAIXA'].some(term => ticker.includes(term))) {
          continue
        }
        try {
          const symbol = /^[A-Z]{4}[0-9]{1,2}$/.test(ticker) ? `${ticker}.SA` : ticker
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            const currentPrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice
            if (currentPrice !== undefined) {
              prices[ticker] = currentPrice
              // Salvar no cache asset_prices do banco de dados
              await supabase.from('asset_prices').upsert({
                ticker,
                current_price: currentPrice,
                last_updated: new Date().toISOString()
              })
              // Salvar no fechamento diário
              await supabase.from('asset_price_daily').upsert({
                ticker,
                price_date: todayStr,
                close_price: currentPrice,
                source: 'yahoo'
              }, { onConflict: 'ticker,price_date' })
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

      // 5. Algoritmo de Fechamento Diário e Cotização (TWR)
      // Loop dia a dia a partir da primeira transação
      let curDate = new Date(startDate)
      const endDate = new Date(todayStr)
      
      let totalShares = 0
      let lastShareValue = 1.0

      // Limpar cotizações futuras para evitar inconsistências caso recalculando
      await supabase.from('portfolio_share_daily')
        .delete()
        .eq('portfolio_id', portfolio.id)
        .gte('rate_date', startDate)

      while (curDate <= endDate) {
        const dateStr = curDate.toISOString().slice(0, 10)

        // Transações do dia
        const dayTxs = transactions.filter(t => t.date === dateStr)

        // Se houver transações ou se for dia útil (mudança de preço), calculamos o fechamento
        // Renda fixa e mercado atualizam diariamente
        
        // Posições no dia
        // Para calcular V_d_prev (valoração antes de transações de hoje)
        // Precisamos rodar a posição com as transações anteriores a hoje
        const prevTxs = transactions.filter(t => t.date < dateStr)
        const valuationPrev = calculateSnapshotValuation(
          prevTxs,
          definitions,
          prices,
          Number(portfolio.cash_balance),
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

        const currentPL = totalShares * lastShareValue

        // Gravar no histórico de cota diária
        await supabase.from('portfolio_share_daily').insert({
          portfolio_id: portfolio.id,
          rate_date: dateStr,
          share_value: lastShareValue,
          gross_pl: currentPL,
          net_pl: currentPL, // simplificado net = gross por enquanto
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
          const periodReturn = cotaAbertura > 0 ? (lastShareValue / cotaAbertura) - 1 : 0

          await supabase.from('portfolio_period_snapshots').upsert({
            portfolio_id: portfolio.id,
            period_type: 'month',
            period_key: periodKey,
            cota_abertura: cotaAbertura,
            cota_fechamento: lastShareValue,
            somatorio_aportes: cashFlow > 0 ? cashFlow : 0,
            somatorio_resgates: cashFlow < 0 ? Math.abs(cashFlow) : 0,
            dividendos_recebidos: 0,
            drawdown_maximo: 0,
            period_return: periodReturn
          }, { onConflict: 'portfolio_id,period_type,period_key' })
        }

        curDate.setDate(curDate.getDate() + 1)
      }

      // 6. Atualizar colunas cache do portfolios
      await supabase.from('portfolios').update({
        total_shares: totalShares,
        last_share_value: lastShareValue,
        last_close_date: todayStr,
        last_gross_pl: totalShares * lastShareValue,
        last_net_pl: totalShares * lastShareValue
      }).eq('id', portfolio.id)

      processedPortfolios.push({
        portfolioId: portfolio.id,
        totalShares,
        shareValue: lastShareValue,
        equity: totalShares * lastShareValue
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

// Função local auxiliar para valoração de carteira simplificada no servidor
function calculateSnapshotValuation(
  transactions: any[],
  definitions: any[],
  prices: Record<string, number>,
  cashBalance: number,
  indexRates: Record<string, Record<string, number>>,
  asOfDate: string
) {
  const txByTicker: Record<string, any[]> = {}
  for (const tx of transactions) {
    const ticker = tx.ticker.trim().toUpperCase()
    if (!txByTicker[ticker]) txByTicker[ticker] = []
    txByTicker[ticker].push(tx)
  }

  const defByTicker = Object.fromEntries(
    definitions.map((d) => [d.ticker.trim().toUpperCase(), d])
  )

  const tickers = new Set([
    ...Object.keys(txByTicker),
    ...Object.keys(defByTicker)
  ])

  let investedValue = 0
  let cashFromPositions = 0

  for (const ticker of tickers) {
    const txs = [...(txByTicker[ticker] ?? [])]
    const definition = defByTicker[ticker]

    let quantity = 0
    let totalCost = 0

    for (const tx of txs) {
      if (tx.date > asOfDate) continue
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

    const pricingMode = definition?.pricing_mode ?? 'market'
    let totalValue = 0

    if (pricingMode === 'fixed_income') {
      const idx = definition?.indexer ?? 'none'
      const activeRates = indexRates[idx.toLowerCase()] ?? {}
      
      // Cálculo de juros simples de fallback
      const appDate = definition?.application_date ?? (txs[0]?.date || asOfDate)
      const diffDays = Math.max(0, (new Date(asOfDate).getTime() - new Date(appDate).getTime()) / (1000 * 60 * 60 * 24))
      const rate = definition?.contract_rate ?? 0
      
      if (idx === 'none') {
        const dailyRate = Math.pow(1 + rate / 100, 1 / 252) - 1
        totalValue = totalCost * Math.pow(1 + dailyRate, diffDays * 5 / 7)
      } else {
        // Pós-fixado aproximado
        const avgIndexerDaily = idx === 'cdi' ? 0.000412 : 0.000411 // fallback CDI/SELIC
        const percent = definition?.indexer_percent ?? 100
        const dailyRate = avgIndexerDaily * (percent / 100)
        totalValue = totalCost * Math.pow(1 + dailyRate, diffDays * 5 / 7)
      }
    } else if (pricingMode === 'manual_value') {
      totalValue = quantity > 0 ? (definition?.manual_current_value ?? totalCost) : 0
    } else if (pricingMode === 'cash') {
      totalValue = totalCost
    } else {
      const currentPrice = prices[ticker] ?? 0
      totalValue = quantity * (currentPrice > 0 ? currentPrice : (quantity > 0 ? totalCost / quantity : 0))
    }

    if (pricingMode === 'cash') {
      cashFromPositions += totalValue
    } else {
      investedValue += totalValue
    }
  }

  const finalCash = cashBalance + cashFromPositions
  return {
    investedValue,
    cashValue: finalCash,
    totalValue: investedValue + finalCash
  }
}
