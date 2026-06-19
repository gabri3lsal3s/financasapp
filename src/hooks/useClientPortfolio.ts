/**
 * useClientPortfolio
 * WHY: Centraliza carregamento + cache de portfólio de cliente no painel de
 *      consultoria, eliminando os ~230 linhas de `loadPortfolioData` que viviam
 *      inline no ConsultantDashboard. Reutiliza o mesmo motor de valuation
 *      (investmentEngine + portfolioValuationLoader) usado em Investments.tsx.
 */
import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/services/offlineCache'
import {
  calculateShareHistory,
  calculatePerformanceMetrics,
  calculateConsolidatedByClass,
  calculateConsolidatedBySector,
  type AssetPosition,
} from '@/services/investmentEngine'
import { loadPortfolioValuation } from '@/utils/portfolioValuationLoader'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'
import type {
  Portfolio,
  PortfolioTransaction,
  PortfolioGroupTarget,
  PortfolioAssetDefinition,
  AssetPrice,
} from '@/types'
import type { PerformanceMetrics, ConsolidatedGroup } from '@/services/investmentEngine'
import toast from 'react-hot-toast'

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface ClientPortfolioCache {
  portfolio?: Portfolio
  clientNotes?: string
  billingFeeRate?: number
  transactions?: PortfolioTransaction[]
  groupTargets?: PortfolioGroupTarget[]
  assetPrices?: Record<string, AssetPrice>
  positions?: AssetPosition[]
  investedValue?: number
  cashValue?: number
  totalValue?: number
  portfolioValue?: number
  assetDefinitions?: PortfolioAssetDefinition[]
  indexRatesByIndexer?: Record<string, IndexRateMap>
  shareValue?: number
  totalShares?: number
  assetTheses?: Record<string, string>
  executiveSummary?: string
  nextMonthPlan?: string
  vnaMap?: Record<string, number>
}

export interface ClientPortfolioData {
  portfolio: Portfolio | null
  transactions: PortfolioTransaction[]
  positions: AssetPosition[]
  investedValue: number
  cashValue: number
  totalValue: number
  shareValue: number
  totalShares: number
  assetPrices: Record<string, AssetPrice>
  assetDefinitions: PortfolioAssetDefinition[]
  indexRatesByIndexer: Record<string, IndexRateMap>
  vnaMap: Record<string, number>
  groupTargets: PortfolioGroupTarget[]
  billingFeeRate: number
  clientNotes: string
  assetTheses: Record<string, string>
  executiveSummary: string
  nextMonthPlan: string
  // Dados derivados já calculados
  shareHistoryData: ReturnType<typeof calculateShareHistory>['shareHistory']
  performanceMetrics: PerformanceMetrics
  consolidatedClass: ConsolidatedGroup[]
  consolidatedSector: ConsolidatedGroup[]
}

export interface UseClientPortfolioReturn extends ClientPortfolioData {
  loadingPortfolio: boolean
  loadPortfolioData: (clientId: string, opts?: { forceRefresh?: boolean }) => Promise<void>
  updateClientNotes: (notes: string) => void
  updateBillingFeeRate: (rate: number) => void
  updateExecutiveSummary: (s: string) => void
  updateNextMonthPlan: (s: string) => void
  updateAssetTheses: (theses: Record<string, string>) => void
  updateGroupTargets: (gts: PortfolioGroupTarget[]) => void
}

// ─── Empty / reset state ─────────────────────────────────────────────────────

const EMPTY: ClientPortfolioData = {
  portfolio: null,
  transactions: [],
  positions: [],
  investedValue: 0,
  cashValue: 0,
  totalValue: 0,
  shareValue: 1.0,
  totalShares: 0,
  assetPrices: {},
  assetDefinitions: [],
  indexRatesByIndexer: {},
  vnaMap: {},
  groupTargets: [],
  billingFeeRate: 0.85,
  clientNotes: '',
  assetTheses: {},
  executiveSummary: '',
  nextMonthPlan: '',
  shareHistoryData: [],
  performanceMetrics: {
    sharpe_ratio: 0,
    beta_ibov: 0,
    beta_sp500: 0,
    volatility_monthly: 0,
    return_monthly_avg: 0,
    data_source: 'insufficient',
  },
  consolidatedClass: [],
  consolidatedSector: [],
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useClientPortfolio(): UseClientPortfolioReturn {
  const { user } = useAuth()

  const [data, setData] = useState<ClientPortfolioData>(EMPTY)
  const [loadingPortfolio, setLoadingPortfolio] = useState(false)

  // Ref para detecção de stale (evita aplicar dados de cliente anterior)
  const activeClientRef = useRef<string>('')

  const isStale = (clientId: string) => activeClientRef.current !== clientId

  const loadPortfolioData = useCallback(
    async (clientId: string, opts?: { forceRefresh?: boolean }) => {
      activeClientRef.current = clientId

      const cacheKey = `consultant-portfolio-data-${clientId}`

      // ── 1. Cache-first ────────────────────────────────────────────────────
      const cached = await getCache<ClientPortfolioCache>(cacheKey)
      if (cached && !opts?.forceRefresh) {
        if (isStale(clientId)) return
        applyCache(cached, clientId)
      }

      setLoadingPortfolio(!cached)

      try {
        // ── 2. Portfolio ──────────────────────────────────────────────────
        const portLookup = await supabase
          .from('portfolios')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle()

        if (isStale(clientId)) return

        let portData = portLookup.data
        if (portLookup.error) throw portLookup.error

        if (!portData) {
          const { data: newPort, error: createErr } = await supabase
            .from('portfolios')
            .insert({ client_id: clientId, consultant_id: user?.id, cash_balance: 0.0 })
            .select()
            .single()

          if (createErr) {
            if (createErr.code === '23505') {
              const { data: retry, error: retryErr } = await supabase
                .from('portfolios')
                .select('*')
                .eq('client_id', clientId)
                .maybeSingle()
              if (retryErr) throw retryErr
              portData = retry
            } else {
              throw createErr
            }
          } else {
            portData = newPort
          }
        }

        // Vincular consultor automaticamente se ausente
        if (portData && !portData.consultant_id && user?.id) {
          const { data: updated } = await supabase
            .from('portfolios')
            .update({ consultant_id: user.id })
            .eq('id', portData.id)
            .select()
            .single()
          if (updated) portData = updated
        }

        if (isStale(clientId)) return

        // ── 3. Inicialização de notas ──────────────────────────────────────

        const currentNotes = portData?.notes || ''
        const currentFee =
          portData && portData.billing_fee_rate != null
            ? Number(portData.billing_fee_rate)
            : 0.85

        // ── 4. Transações ─────────────────────────────────────────────────
        const txs = await fetchAllPortfolioTransactions(portData!.id, {
          orderField: 'date',
          ascending: true,
        })
        if (isStale(clientId)) return

        // ── 5. Metas e limites de grupo ───────────────────────────────────
        const [{ data: targetsData }, { data: groupTargetsData }, { data: thesesData }] =
          await Promise.all([
            supabase.from('target_allocations').select('*').eq('portfolio_id', portData!.id),
            supabase.from('portfolio_group_targets').select('*').eq('portfolio_id', portData!.id),
            supabase.from('asset_theses').select('*').eq('consultant_id', user?.id),
          ])

        if (isStale(clientId)) return

        const currentGroupTargets = groupTargetsData || []

        // Teses e sumário qualitativo
        const mappedTheses: Record<string, string> = {}
        if (thesesData) {
          for (const item of thesesData) {
            mappedTheses[item.ticker.toUpperCase()] = item.thesis
          }
        }
        const execSummary = mappedTheses['__EXECUTIVE_SUMMARY__'] || ''
        const monthPlan = mappedTheses['__NEXT_MONTH_PLAN__'] || ''

        // ── 6. Valuation ──────────────────────────────────────────────────
        let positions: AssetPosition[] = []
        let investedValue = 0
        let cashValue = 0
        let totalValue = 0
        let assetPrices: Record<string, AssetPrice> = {}
        let assetDefinitions: PortfolioAssetDefinition[] = []
        let indexRatesByIndexer: Record<string, IndexRateMap> = {}
        let vnaMap: Record<string, number> = {}
        let shareValue = 1.0
        let totalShares = 0
        let shareHistoryData: ClientPortfolioData['shareHistoryData'] = []

        if (txs.length > 0) {
          const valuation = await loadPortfolioValuation(
            portData!.id,
            txs,
            targetsData || [],
            Number(portData!.cash_balance) || 0,
            { forceRefresh: opts?.forceRefresh },
          )
          if (isStale(clientId)) return

          positions = valuation.positions
          investedValue = valuation.investedValue
          cashValue = valuation.cashValue
          totalValue = valuation.totalValue
          assetPrices = valuation.prices
          assetDefinitions = valuation.definitions
          indexRatesByIndexer = valuation.indexRatesByIndexer
          vnaMap = valuation.vnaMap || {}

          const shareResult = calculateShareHistory(
            txs,
            valuation.prices,
            valuation.definitions,
            valuation.indexRatesByIndexer,
            {},
            vnaMap,
          )
          shareValue = shareResult.currentShareValue
          totalShares = shareResult.totalShares
          shareHistoryData = shareResult.shareHistory
        }

        const performanceMetrics = calculatePerformanceMetrics(shareHistoryData)
        const consolidatedClass = calculateConsolidatedByClass(positions, totalValue, currentGroupTargets)
        const consolidatedSector = calculateConsolidatedBySector(positions, totalValue, currentGroupTargets)

        if (isStale(clientId)) return

        const next: ClientPortfolioData = {
          portfolio: portData,
          transactions: txs,
          positions,
          investedValue,
          cashValue,
          totalValue,
          shareValue,
          totalShares,
          assetPrices,
          assetDefinitions,
          indexRatesByIndexer,
          vnaMap,
          groupTargets: currentGroupTargets,
          billingFeeRate: currentFee,
          clientNotes: currentNotes,
          assetTheses: mappedTheses,
          executiveSummary: execSummary,
          nextMonthPlan: monthPlan,
          shareHistoryData,
          performanceMetrics,
          consolidatedClass,
          consolidatedSector,
        }
        setData(next)

        // ── 7. Persistir cache ────────────────────────────────────────────
        await setCache(cacheKey, {
          portfolio: portData,
          clientNotes: currentNotes,
          billingFeeRate: currentFee,
          transactions: txs,
          groupTargets: currentGroupTargets,
          assetPrices,
          positions,
          investedValue,
          cashValue,
          totalValue,
          assetDefinitions,
          indexRatesByIndexer,
          shareValue,
          totalShares,
          assetTheses: mappedTheses,
          executiveSummary: execSummary,
          nextMonthPlan: monthPlan,
          vnaMap,
        })
      } catch (err) {
        console.error('[useClientPortfolio] Erro ao carregar portfolio:', err)
        toast.error('Erro ao obter carteira do cliente')
      } finally {
        setLoadingPortfolio(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  )

  // ── Helpers para aplicar cache sem reload completo ────────────────────────
  function applyCache(cached: ClientPortfolioCache, clientId: string) {
    const positions = cached.positions || []
    const groupTargets = cached.groupTargets || []
    const totalValue = cached.totalValue ?? cached.portfolioValue ?? 0
    const indexRatesByIndexer = cached.indexRatesByIndexer || {}
    const vnaMap = cached.vnaMap || {}
    const assetPrices = cached.assetPrices || {}
    const assetDefinitions = cached.assetDefinitions || []
    const txs = cached.transactions || []

    const shareResult =
      txs.length > 0
        ? calculateShareHistory(txs, assetPrices, assetDefinitions, indexRatesByIndexer, {}, vnaMap)
        : { currentShareValue: 1.0, totalShares: 0, shareHistory: [] }

    const consolidatedClass = calculateConsolidatedByClass(positions, totalValue, groupTargets)
    const consolidatedSector = calculateConsolidatedBySector(positions, totalValue, groupTargets)

    if (isStale(clientId)) return

    setData((prev) => ({
      ...prev,
      portfolio: cached.portfolio ?? null,
      clientNotes: cached.clientNotes ?? '',
      billingFeeRate: cached.billingFeeRate ?? 0.85,
      transactions: txs,
      groupTargets,
      assetPrices,
      positions,
      investedValue: cached.investedValue ?? cached.portfolioValue ?? 0,
      cashValue: cached.cashValue ?? 0,
      totalValue,
      assetDefinitions,
      indexRatesByIndexer,
      vnaMap,
      shareValue: cached.shareValue ?? shareResult.currentShareValue,
      totalShares: cached.totalShares ?? shareResult.totalShares,
      assetTheses: cached.assetTheses ?? {},
      executiveSummary: cached.executiveSummary ?? '',
      nextMonthPlan: cached.nextMonthPlan ?? '',
      shareHistoryData: shareResult.shareHistory,
      consolidatedClass,
      consolidatedSector,
    }))
  }

  // ── Setters parciais para mutações locais ─────────────────────────────────
  const updateClientNotes = (notes: string) =>
    setData((prev) => ({ ...prev, clientNotes: notes }))

  const updateBillingFeeRate = (rate: number) =>
    setData((prev) => ({ ...prev, billingFeeRate: rate }))

  const updateExecutiveSummary = (s: string) =>
    setData((prev) => ({ ...prev, executiveSummary: s }))

  const updateNextMonthPlan = (s: string) =>
    setData((prev) => ({ ...prev, nextMonthPlan: s }))

  const updateAssetTheses = (theses: Record<string, string>) =>
    setData((prev) => ({ ...prev, assetTheses: theses }))

  const updateGroupTargets = (gts: PortfolioGroupTarget[]) =>
    setData((prev) => ({ ...prev, groupTargets: gts }))

  return {
    ...data,
    loadingPortfolio,
    loadPortfolioData,
    updateClientNotes,
    updateBillingFeeRate,
    updateExecutiveSummary,
    updateNextMonthPlan,
    updateAssetTheses,
    updateGroupTargets,
  }
}
