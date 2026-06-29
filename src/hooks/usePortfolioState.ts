import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { getAssetPrices } from '@/services/priceService'
import { loadIndexRatesFromDb, loadVnaFromDb } from '@/services/indexRatesFetcher'
import { computePositions, type ValuedPosition } from '@/utils/portfolioCalculations'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import type {
  PortfolioAssetDefinition,
  PortfolioGroupTarget,
  PortfolioTransaction,
  TargetAllocation,
  PortfolioShareDailyRow,
  PortfolioQuantPreferences,
  ScuttlebuttPillar,
  ScuttlebuttQuestion,
  ScuttlebuttAnswer,
  AssetFundamentalsCache
} from '@/types'
import toast from 'react-hot-toast'
import { isBusinessDay } from '@/utils/businessDays'
import { subDays, format } from 'date-fns'
import { runClientSideHistoricalRecalculation } from '@/services/portfolioHistoricalRecalc'
import { computeDailyShareHistory, needsHistoricalBackfill } from '@/utils/portfolioTwrEngine'
import { isCashTicker } from '@/utils/assetClassifier'
import { logger } from '@/utils/logger'
import { getMergedFundamentals } from '@/services/fundamentalsService'
import {
  calculateScuttlebuttScore,
  calculateQuantitativeScore,
  determineTier,
  checkScuttlebuttDecay,
  calculateAbsoluteLimit,
  determineEnquadramentoState
} from '@/utils/quantamentalEngine'

async function fetchAllShareHistory(portfolioId: string): Promise<PortfolioShareDailyRow[]> {
  let allShares: PortfolioShareDailyRow[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('portfolio_share_daily')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('rate_date', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allShares = [...allShares, ...(data as PortfolioShareDailyRow[])]
      if (data.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  return allShares
}

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
  
  // Estados Quantamentais
  const [preferences, setPreferences] = useState<PortfolioQuantPreferences | null>(null)
  const [scuttlebuttAnswers, setScuttlebuttAnswers] = useState<ScuttlebuttAnswer[]>([])
  const [scuttlebuttPillars, setScuttlebuttPillars] = useState<ScuttlebuttPillar[]>([])
  const [scuttlebuttQuestions, setScuttlebuttQuestions] = useState<ScuttlebuttQuestion[]>([])
  const [assetFundamentals, setAssetFundamentals] = useState<Record<string, AssetFundamentalsCache>>({})

  // Estados derivados / calculados
  const [positions, setPositions] = useState<ValuedPosition[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [investedValue, setInvestedValue] = useState(0)
  const [cashValue, setCashValue] = useState(0)

  const loadData = useCallback(async (options?: { forceRefresh?: boolean; silent?: boolean; skipBackfill?: boolean }) => {
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
          await runClientSideHistoricalRecalculation(portfolio.id, (phase) => {
            logger.debug('[recalc]', phase)
          })
        } catch (recalcErr) {
          logger.error('[usePortfolioState] Failed client-side recalculation on forceRefresh:', recalcErr)
        }
      }

      // 2. Carregar dados do banco de dados relacionados
      const [
        txsData, 
        defsData, 
        targetsData, 
        groupsData, 
        shareData,
        prefRes,
        pillarsRes,
        questionsRes,
        answersRes,
        fundamentalsRes
      ] = await Promise.all([
        fetchAllPortfolioTransactions(portfolio.id),
        supabase.from('portfolio_asset_definitions').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('target_allocations').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('portfolio_group_targets').select('*').eq('portfolio_id', portfolio.id),
        fetchAllShareHistory(portfolio.id),
        supabase.from('portfolio_quant_preferences').select('*').eq('portfolio_id', portfolio.id).maybeSingle(),
        supabase.from('scuttlebutt_pillars').select('*').or(`portfolio_id.is.null,portfolio_id.eq.${portfolio.id}`),
        supabase.from('scuttlebutt_questions').select('*'),
        supabase.from('scuttlebutt_answers').select('*').eq('portfolio_id', portfolio.id),
        supabase.from('asset_fundamentals_cache').select('*')
      ])

      const finalTxs = txsData || []
      const finalDefs = (defsData.data as PortfolioAssetDefinition[]) || []
      const finalTargets = (targetsData.data as TargetAllocation[]) || []
      const finalGroups = (groupsData.data as PortfolioGroupTarget[]) || []
      const finalShares = shareData || []

      const finalPref = (prefRes.data as PortfolioQuantPreferences) || {
        portfolio_id: portfolio.id,
        tier_s_limit: 20.00,
        tier_a_limit: 10.00,
        tier_b_limit: 5.00,
        tier_c_limit: 0.00,
        max_sector_acoes: 30.00,
        max_sector_fiis: 45.00,
        min_roic_excelente: 15.00,
        max_divida_ebitda: 2.50,
        scuttlebutt_decay_days: 365
      }

      const finalPillars = (pillarsRes.data as ScuttlebuttPillar[]) || []
      const finalQuestions = (questionsRes.data as ScuttlebuttQuestion[]) || []
      const finalAnswers = (answersRes.data as ScuttlebuttAnswer[]) || []
      const finalFundamentalsList = (fundamentalsRes.data as AssetFundamentalsCache[]) || []

      const finalFundamentalsMap: Record<string, AssetFundamentalsCache> = {}
      for (const fund of finalFundamentalsList) {
        finalFundamentalsMap[fund.ticker.trim().toUpperCase()] = fund
      }

      setTransactions(finalTxs)
      setAssetDefinitions(finalDefs)
      setTargetAllocations(finalTargets)
      setGroupTargets(finalGroups)
      setPreferences(finalPref)
      setScuttlebuttPillars(finalPillars)
      setScuttlebuttQuestions(finalQuestions)
      setScuttlebuttAnswers(finalAnswers)
      setAssetFundamentals(finalFundamentalsMap)

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
              if (error) logger.error('[usePortfolioState] Error resetting cash balance:', error)
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
      
      const [cdiRates, selicRates, ipcaRates, vnaMap] = await Promise.all([
        loadIndexRatesFromDb('cdi', startDate, todayStr),
        loadIndexRatesFromDb('selic', startDate, todayStr),
        loadIndexRatesFromDb('ipca', startDate, todayStr),
        loadVnaFromDb(startDate, todayStr)
      ])

      const indexRates = {
        cdi: cdiRates,
        selic: selicRates,
        ipca: ipcaRates
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
            if (error) logger.error('[usePortfolioState] Error updating out-of-sync cash balance:', error)
          })
      }

      const valuation = computePositions(
        finalTxs,
        finalDefs,
        prices,
        calculatedCash,
        indexRates,
        vnaMap,
        todayStr
      )

      // Injetar metas de alocação de ativos e cálculo quantamental
      const positionsWithTargets = valuation.positions.map((pos) => {
        const target = finalTargets.find(t => t.ticker.toUpperCase() === pos.ticker.toUpperCase())
        const targetPct = target ? Number(target.target_percentage) : 0
        const totalValuePortfolio = valuation.totalValue
        const usdRate = pos.usd_rate

        // 1. Obter a definição do ativo para buscar overrides
        const definition = finalDefs.find(d => d.ticker.toUpperCase() === pos.ticker.toUpperCase())

        // 2. Calcular scores e enquadramento quantamental
        let qualityScore = 100
        let scuttlebuttScore = 100
        let quantitativeScore = 100
        let convictionTier: 'S' | 'A' | 'B' | 'C' = 'S'
        let absoluteLimit = 100.00
        let isDecayed = false
        let mergedFundamentals: ValuedPosition['fundamentals'] = null
        let lastScuttlebuttUpdate: string | undefined = undefined

        const isCashOrRf = pos.pricing_mode === 'cash' || 
                           pos.pricing_mode === 'fixed_income' || 
                           pos.asset_class === 'Renda Fixa' || 
                           pos.asset_class === 'Saldo em Caixa'

        if (!isCashOrRf) {
          // A. Calcular qualitativo (Scuttlebutt)
          const answersForTicker = finalAnswers.filter(a => a.ticker.toUpperCase() === pos.ticker.toUpperCase())

          if (answersForTicker.length > 0) {
            const timestamps = answersForTicker
              .map(a => a.updated_at ? new Date(a.updated_at).getTime() : 0)
              .filter(t => t > 0)
            if (timestamps.length > 0) {
              lastScuttlebuttUpdate = new Date(Math.max(...timestamps)).toISOString()
            }
          }

          const scutt = calculateScuttlebuttScore(answersForTicker, finalPillars, finalQuestions)
          scuttlebuttScore = scutt.score

          // B. Obter/Mesclar fundamentos
          const fetchedFund = finalFundamentalsMap[pos.ticker.toUpperCase()] || null
          
          // Tratando a mesclagem para FIIs e ETFs
          const rawFundamentals = {
            roic: fetchedFund?.roic ?? 0,
            dividend_yield: fetchedFund?.dividend_yield ?? 0,
            pe_ratio: fetchedFund?.pe_ratio ?? null,
            ev_ebitda: fetchedFund?.ev_ebitda ?? null,
            net_debt_ebitda: fetchedFund?.net_debt_ebitda ?? null,
            pe_5y_average: fetchedFund?.pe_5y_average ?? null,
            ev_ebitda_5y_average: fetchedFund?.ev_ebitda_5y_average ?? null,
            net_debt_trend_up_2y: fetchedFund?.net_debt_trend_up_2y ?? false,
            p_vp: definition?.manual_p_vp ?? null,
            vacancy: definition?.manual_vacancy ?? null,
            etf_fee: definition?.manual_etf_fee ?? null,
            etf_tracking_error: definition?.manual_etf_tracking_error ?? null
          }
          
          const mergedBase = getMergedFundamentals(fetchedFund, definition)
          mergedFundamentals = {
            ...mergedBase,
            p_vp: rawFundamentals.p_vp,
            vacancy: rawFundamentals.vacancy,
            etf_fee: rawFundamentals.etf_fee,
            etf_tracking_error: rawFundamentals.etf_tracking_error
          }

          // C. Calcular quantitativo (Fundamentos)
          quantitativeScore = calculateQuantitativeScore(pos.asset_class, mergedFundamentals, finalPref)

          // D. Score de Qualidade Híbrido
          const cUpper = pos.asset_class.trim().toUpperCase()
          const isEtf = cUpper.includes('ETF')

          if (isEtf) {
            qualityScore = quantitativeScore
          } else {
            // Ações e FIIs: 50% Quali + 50% Quanti
            qualityScore = (scuttlebuttScore + quantitativeScore) / 2
          }

          // E. Determinar Tier de Convicção
          convictionTier = determineTier(qualityScore)

          // F. Decay check para qualitativo (somente Ações e FIIs com respostas)
          if (!isEtf && answersForTicker.length > 0) {
            isDecayed = checkScuttlebuttDecay(lastScuttlebuttUpdate, finalPref.scuttlebutt_decay_days)
          }

          // G. Limite Absoluto: Target da Classe * Fator do Tier
          const classTargetPct = finalGroups.find(g => g.group_type === 'class' && g.group_name.toLowerCase() === pos.asset_class.toLowerCase())?.target_percentage ?? 0

          let tierLimitFactor = 100.00
          if (convictionTier === 'S') tierLimitFactor = finalPref.tier_s_limit
          else if (convictionTier === 'A') tierLimitFactor = finalPref.tier_a_limit
          else if (convictionTier === 'B') tierLimitFactor = finalPref.tier_b_limit
          else if (convictionTier === 'C') tierLimitFactor = finalPref.tier_c_limit

          absoluteLimit = calculateAbsoluteLimit(classTargetPct, tierLimitFactor)
        } else {
          // Renda Fixa e Caixa: Limite absoluto é o target do próprio ativo ou da classe
          absoluteLimit = targetPct > 0 ? targetPct : (finalGroups.find(g => g.group_type === 'class' && g.group_name.toLowerCase() === pos.asset_class.toLowerCase())?.target_percentage ?? 100.00)
        }

        // H. Determinar estado de enquadramento
        const state = determineEnquadramentoState(pos.current_percentage, absoluteLimit, isDecayed)

        // I. Calcular Gaps
        let gapFinancial = 0
        let gapPercentage = 0

        if (state !== 'desenquadrado_excesso') {
          const targetValBrl = (absoluteLimit / 100) * totalValuePortfolio
          const targetVal = pos.currency === 'USD' ? targetValBrl / usdRate : targetValBrl
          gapFinancial = Math.max(0, targetVal - pos.total_value)
          gapPercentage = Math.max(0, absoluteLimit - pos.current_percentage)
        }

        return {
          ...pos,
          target_percentage: targetPct,
          gap_financial: gapFinancial,
          gap_percentage: gapPercentage,
          quality_score: Number(qualityScore.toFixed(1)),
          scuttlebutt_score: Number(scuttlebuttScore.toFixed(1)),
          quantitative_score: Number(quantitativeScore.toFixed(1)),
          conviction_tier: convictionTier,
          absolute_limit: Number(absoluteLimit.toFixed(2)),
          enquadramento_state: state,
          is_decayed: isDecayed,
          scuttlebutt_last_updated: lastScuttlebuttUpdate,
          fundamentals: mergedFundamentals
        }
      })

      // Calcular o Total Aportado (soma cumulativa dos fluxos externos de caixa)
      let cumulativeExternalContribution = 0

      for (const tx of finalTxs) {
        const tickerUpper = tx.ticker.trim().toUpperCase()
        const isCash = isCashTicker(tickerUpper) || 
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

      const firstTxDate = finalTxs.map(t => t.date).sort()[0] || todayStr
      const pricesTodayMap = Object.fromEntries(
        tickers.map(t => [t, prices[t]?.current_price ?? 0])
      )

      let displayShares: PortfolioShareDailyRow[] = [...finalShares]
      const shouldBackfill = needsHistoricalBackfill(finalShares, firstTxDate, todayStr)

      if (shouldBackfill) {
        const { dailyRows } = computeDailyShareHistory({
          portfolioId: portfolio.id,
          transactions: finalTxs,
          definitions: finalDefs,
          priceMap: {},
          pricesToday: pricesTodayMap,
          indexRates,
          vnaMap,
          startDate: firstTxDate,
          endDate: todayStr
        })

        if (dailyRows.length > displayShares.length) {
          displayShares = dailyRows
        }
      }

      const hasToday = displayShares.some(s => s.rate_date === todayStr)
      if (!hasToday && displayShares.length > 0) {
        const lastClose = displayShares[displayShares.length - 1]
        const todayShareValue = lastClose.total_shares > 0
          ? valuation.totalValue / lastClose.total_shares
          : lastClose.share_value

        displayShares.push({
          portfolio_id: portfolio.id,
          rate_date: todayStr,
          share_value: todayShareValue,
          gross_pl: valuation.investedValue,
          net_pl: valuation.investedValue - valuation.investedCostBasis,
          total_shares: lastClose.total_shares,
          cash_value: valuation.cashValue,
          invested_cost: valuation.investedCostBasis
        })
      } else if (!hasToday && displayShares.length === 0 && valuation.totalValue > 0) {
        displayShares.push({
          portfolio_id: portfolio.id,
          rate_date: todayStr,
          share_value: calculatedInvestedValue > 0
            ? valuation.totalValue / calculatedInvestedValue
            : 1.0,
          gross_pl: valuation.investedValue,
          net_pl: valuation.investedValue - valuation.investedCostBasis,
          total_shares: calculatedInvestedValue > 0 ? calculatedInvestedValue : valuation.totalValue,
          cash_value: valuation.cashValue,
          invested_cost: valuation.investedCostBasis
        })
      }

      setShareHistory(displayShares)

      if (shouldBackfill && !options?.skipBackfill) {
        logger.debug('[usePortfolioState] Histórico TWR incompleto. Iniciando backfill em background...')
        setTimeout(async () => {
          try {
            await runClientSideHistoricalRecalculation(portfolio.id)
            void loadData({ silent: true, skipBackfill: true })
          } catch (err) {
            logger.error('[usePortfolioState] Backfill histórico falhou:', err)
          }
        }, 300)
      }

      // Verificação de auto-refresh de cotações pós-fechamento do mercado
      const latestTradingDateStr = getLatestTradingDate()
      const closingThresholdUtc = new Date(`${latestTradingDateStr}T21:00:00Z`).getTime()
      
      const marketTickers = tickers.filter(t => 
        !isCashTicker(t) && !['CDI', 'SELIC', 'IPCA', 'TESOURO', 'DEBENTURE'].includes(t.toUpperCase())
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
        logger.debug(`[AutoRefresh] Cotações desatualizadas em relação ao fechamento (${latestTradingDateStr} 18h). Forçando atualização em background...`)
        setTimeout(() => {
          void loadData({ forceRefresh: true, silent: true })
        }, 1000)
      }

    } catch (err) {
      logger.error('[usePortfolioState] Erro ao carregar carteira:', err)
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
        ev.detail?.entity === 'asset_prices' ||
        ev.detail?.entity === 'scuttlebutt_answers' ||
        ev.detail?.entity === 'portfolio_quant_preferences' ||
        ev.detail?.entity === 'scuttlebutt_pillars' ||
        ev.detail?.entity === 'scuttlebutt_questions' ||
        ev.detail?.entity === 'asset_fundamentals_cache'
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
      const toastId = toast.loading('Recalculando rentabilidade histórica...')
      try {
        await runClientSideHistoricalRecalculation(portfolioId, (phase) => {
          toast.loading(phase, { id: toastId })
        })
        toast.success('Rentabilidade recalculada!', { id: toastId })
      } catch (recalcErr) {
        logger.error('[usePortfolioState] Failed client-side recalculation during reload:', recalcErr)
        toast.error('Erro no recálculo de rentabilidade.', { id: toastId })
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
    preferences,
    scuttlebuttAnswers,
    scuttlebuttPillars,
    scuttlebuttQuestions,
    assetFundamentals,
    refresh,
    reload
  }
}
