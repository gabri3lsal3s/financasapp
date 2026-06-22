import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { getAssetPrices } from '@/services/priceService'
import { loadIndexRatesFromDb } from '@/services/indexRatesFetcher'
import { computePositions, type ValuedPosition } from '@/utils/portfolioCalculations'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import type {
  PortfolioAssetDefinition,
  PortfolioGroupTarget,
  PortfolioTransaction,
  TargetAllocation,
  PortfolioShareDailyRow
} from '@/types'
import toast from 'react-hot-toast'
import { isBusinessDay } from '@/utils/businessDays'
import { subDays, format } from 'date-fns'
import { runClientSideHistoricalRecalculation } from '@/services/portfolioHistoricalRecalc'

function getLatestTradingDate(): string {
  const now = new Date()
  const hours = now.getHours()
  let dateCursor = now

  if (isBusinessDay(now)) {
    if (hours < 18) {
      dateCursor = subDays(now, 1)
    }
  } else {
    dateCursor = subDays(now, 1)
  }

  while (!isBusinessDay(dateCursor)) {
    dateCursor = subDays(dateCursor, 1)
  }

  return format(dateCursor, 'yyyy-MM-dd')
}

export function usePortfolioState() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [portfolioId, setPortfolioId] = useState<string>('')
  
  // Dados do banco
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [assetDefinitions, setAssetDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>([])
  const [groupTargets, setGroupTargets] = useState<PortfolioGroupTarget[]>([])
  const [shareHistory, setShareHistory] = useState<PortfolioShareDailyRow[]>([])

  // Estados derivados / calculados
  const [positions, setPositions] = useState<ValuedPosition[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [investedValue, setInvestedValue] = useState(0)
  const [cashValue, setCashValue] = useState(0)

  const loadData = useCallback(async (options?: { forceRefresh?: boolean; silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Obter ou criar portfólio
      const { data: portfolioData, error: portError } = await supabase
        .from('portfolios')
        .select('id, cash_balance')
        .eq('client_id', user.id)
        .maybeSingle()

      if (portError) throw portError
      let portfolio = portfolioData

      if (!portfolio) {
        const { data: newPort, error: createError } = await supabase
          .from('portfolios')
          .insert({ client_id: user.id, cash_balance: 0.0 })
          .select('id, cash_balance')
          .single()
        if (createError) throw createError
        portfolio = newPort
      }

      if (!portfolio) return
      setPortfolioId(portfolio.id)

      if (options?.forceRefresh) {
        try {
          const { error } = await supabase.functions.invoke('daily-close', {
            body: { portfolioId: portfolio.id }
          })
          if (error) throw error
        } catch (err) {
          console.warn('[usePortfolioState] Error invoking daily-close on forceRefresh, running client-side recalculation fallback:', err)
          try {
            await runClientSideHistoricalRecalculation(portfolio.id)
          } catch (recalcErr) {
            console.error('[usePortfolioState] Failed client-side recalculation fallback on forceRefresh:', recalcErr)
          }
        }
      }

      // 2. Carregar dados do banco de dados relacionados
      const [txsData, defsData, targetsData, groupsData, shareData] = await Promise.all([
        fetchAllPortfolioTransactions(portfolio.id),
        supabase.from('portfolio_asset_definitions').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('target_allocations').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('portfolio_group_targets').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('portfolio_share_daily')
          .select('*')
          .eq('portfolio_id', portfolio.id)
          .order('rate_date', { ascending: true })
      ])

      const finalTxs = txsData || []
      const finalDefs = (defsData.data as PortfolioAssetDefinition[]) || []
      const finalTargets = (targetsData.data as TargetAllocation[]) || []
      const finalGroups = (groupsData.data as PortfolioGroupTarget[]) || []
      const finalShares = (shareData.data as PortfolioShareDailyRow[]) || []

      setTransactions(finalTxs)
      setAssetDefinitions(finalDefs)
      setTargetAllocations(finalTargets)
      setGroupTargets(finalGroups)

      if (finalTxs.length === 0) {
        setPositions([])
        setTotalValue(0)
        setInvestedValue(0)
        setCashValue(0)
        setShareHistory([])
        
        // Auto-heal database cash_balance if it is out of sync (e.g. all transactions deleted)
        if (Math.abs(Number(portfolio.cash_balance) || 0) > 0.001) {
          supabase
            .from('portfolios')
            .update({ cash_balance: 0.0 })
            .eq('id', portfolio.id)
            .then(({ error }) => {
              if (error) console.error('[usePortfolioState] Error resetting cash balance:', error)
            })
        }
        
        setLoading(false)
        return
      }

      // 3. Obter cotações atuais de mercado
      const tickers = Array.from(new Set(finalTxs.map(t => t.ticker.trim().toUpperCase())))
      const prices = await getAssetPrices(tickers, { forceRefresh: options?.forceRefresh })

      // 4. Carregar taxas diárias para renda fixa pós-fixada
      const startDate = finalTxs.map(t => t.date).sort()[0] || new Date().toISOString().slice(0, 10)
      const todayStr = new Date().toISOString().slice(0, 10)
      
      const [cdiRates, selicRates] = await Promise.all([
        loadIndexRatesFromDb('cdi', startDate, todayStr),
        loadIndexRatesFromDb('selic', startDate, todayStr)
      ])

      const indexRates = {
        cdi: cdiRates,
        selic: selicRates,
        ipca: {}
      }

      // 5. Calcular posições atuais locais de forma dinâmica
      const calculatedCash = calculateLedgerCashBalance(finalTxs, finalDefs)
      
      // Auto-heal database cash_balance if it is out of sync (e.g. manual transaction saves/deletes)
      if (Math.abs(calculatedCash - (Number(portfolio.cash_balance) || 0)) > 0.001) {
        supabase
          .from('portfolios')
          .update({ cash_balance: calculatedCash })
          .eq('id', portfolio.id)
          .then(({ error }) => {
            if (error) console.error('[usePortfolioState] Error updating out-of-sync cash balance:', error)
          })
      }

      const valuation = computePositions(
        finalTxs,
        finalDefs,
        prices,
        calculatedCash,
        indexRates,
        {},
        todayStr
      )

      // Injetar metas de alocação de ativos
      const positionsWithTargets = valuation.positions.map((pos) => {
        const target = finalTargets.find(t => t.ticker.toUpperCase() === pos.ticker.toUpperCase())
        const targetPct = target ? Number(target.target_percentage) : 0
        const totalValuePortfolio = valuation.totalValue
        
        const usdRate = pos.usd_rate
        const targetValBrl = (targetPct / 100) * totalValuePortfolio
        const targetVal = pos.currency === 'USD' ? targetValBrl / usdRate : targetValBrl
        const gapFinancial = targetVal - pos.total_value

        return {
          ...pos,
          target_percentage: targetPct,
          gap_financial: gapFinancial,
          gap_percentage: targetPct - pos.current_percentage
        }
      })

      // Calcular o Total Aportado (soma cumulativa dos fluxos externos de caixa)
      let cumulativeExternalContribution = 0
      const legacyCashTickers = ['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA']

      for (const tx of finalTxs) {
        const tickerUpper = tx.ticker.trim().toUpperCase()
        const isCash = legacyCashTickers.includes(tickerUpper) || 
          finalDefs.some(d => d.ticker.trim().toUpperCase() === tickerUpper && d.pricing_mode === 'cash')

        // Ignorar se for offset automático de proventos/rendimentos (não afeta fluxo externo)
        if (isCash && tx.cash_offset_source_id) {
          const sourceTx = finalTxs.find(t => t.id === tx.cash_offset_source_id)
          if (sourceTx && ['dividend', 'jcp', 'fii_yield'].includes(sourceTx.operation_type)) {
            continue
          }
        }

        const q = Number(tx.quantity)
        const p = Number(tx.price)
        const type = tx.operation_type

        if (type === 'buy' || type === 'subscription') {
          cumulativeExternalContribution += q * p
        } else if (type === 'sell') {
          cumulativeExternalContribution -= q * p
        }
      }

      const calculatedInvestedValue = cumulativeExternalContribution

      setPositions(positionsWithTargets)
      setTotalValue(valuation.totalValue)
      setInvestedValue(calculatedInvestedValue)
      setCashValue(valuation.cashValue)

      // Simulação do ponto de hoje no gráfico para refletir mudanças de cotação/ledger em tempo real
      const hasToday = finalShares.some(s => s.rate_date === todayStr)
      
      const chartShares = [...finalShares]
      if (!hasToday) {
        if (finalShares.length > 0) {
          const lastClose = finalShares[finalShares.length - 1]
          const todayShareValue = lastClose.gross_pl > 0
            ? lastClose.share_value * (valuation.totalValue / lastClose.gross_pl)
            : lastClose.share_value

          chartShares.push({
            portfolio_id: portfolio.id,
            rate_date: todayStr,
            share_value: todayShareValue,
            gross_pl: valuation.totalValue,
            net_pl: valuation.totalValue - calculatedInvestedValue,
            total_shares: lastClose.total_shares
          })
        } else if (valuation.totalValue > 0) {
          // Portfólio sem fechamento diário histórico no banco, mas com posições ativas
          const initialShareValue = calculatedInvestedValue > 0
            ? 1.0 * (valuation.totalValue / calculatedInvestedValue)
            : 1.0

          chartShares.push({
            portfolio_id: portfolio.id,
            rate_date: todayStr,
            share_value: initialShareValue,
            gross_pl: valuation.totalValue,
            net_pl: valuation.totalValue - calculatedInvestedValue,
            total_shares: 100
          })
        }
      }

      setShareHistory(chartShares)

      // Verificação de auto-refresh de cotações pós-fechamento do mercado
      const latestTradingDateStr = getLatestTradingDate()
      const closingThresholdUtc = new Date(`${latestTradingDateStr}T21:00:00Z`).getTime()
      
      const marketTickers = tickers.filter(t => 
        !['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA', 'CDI', 'SELIC', 'IPCA', 'TESOURO', 'DEBENTURE'].includes(t.toUpperCase())
      )

      let needsAutoRefresh = false
      if (marketTickers.length > 0) {
        for (const ticker of marketTickers) {
          const priceData = prices[ticker]
          if (!priceData) {
            needsAutoRefresh = true
            break
          }
          const lastUpdatedTime = new Date(priceData.last_updated).getTime()
          if (lastUpdatedTime < closingThresholdUtc) {
            needsAutoRefresh = true
            break
          }
        }
      }

      if (needsAutoRefresh && !options?.forceRefresh) {
        console.log(`[AutoRefresh] Cotações desatualizadas em relação ao fechamento (${latestTradingDateStr} 18h). Forçando atualização em background...`)
        setTimeout(() => {
          void loadData({ forceRefresh: true, silent: true })
        }, 1000)
      }

    } catch (err) {
      console.error('[usePortfolioState] Erro ao carregar carteira:', err)
      toast.error('Erro ao carregar dados da carteira.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()

    // Escutar eventos locais de alteração para recarregamento em tempo real (offline sync e salvamentos)
    const onLocalChanged = (e: Event) => {
      const ev = e as CustomEvent
      if (
        ev.detail?.entity === 'portfolio_transactions' ||
        ev.detail?.entity === 'investments' ||
        ev.detail?.entity === 'portfolio_asset_definitions' ||
        ev.detail?.entity === 'asset_prices'
      ) {
        void loadData({ silent: true })
      }
    }

    window.addEventListener('local-data-changed', onLocalChanged)
    return () => {
      window.removeEventListener('local-data-changed', onLocalChanged)
    }
  }, [loadData])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadData({ forceRefresh: true })
      toast.success('Cotações e posições atualizadas!')
    } catch {
      toast.error('Falha ao atualizar cotações.')
    } finally {
      setRefreshing(false)
    }
  }, [loadData])

  const reload = useCallback(async () => {
    if (portfolioId) {
      try {
        const { error } = await supabase.functions.invoke('daily-close', {
          body: { portfolioId }
        })
        if (error) throw error
      } catch (err) {
        console.warn('[usePortfolioState] Error invoking daily-close during reload, running client-side recalculation fallback:', err)
        try {
          await runClientSideHistoricalRecalculation(portfolioId)
        } catch (recalcErr) {
          console.error('[usePortfolioState] Failed client-side recalculation fallback during reload:', recalcErr)
        }
      }
    }
    await loadData({ silent: true })
  }, [portfolioId, loadData])

  return {
    loading,
    refreshing,
    portfolioId,
    transactions,
    assetDefinitions,
    targetAllocations,
    groupTargets,
    shareHistory,
    positions,
    totalValue,
    investedValue,
    cashValue,
    refresh,
    reload
  }
}
