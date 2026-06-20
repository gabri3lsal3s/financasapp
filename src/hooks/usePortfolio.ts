/**
 * usePortfolio.ts
 *
 * Hook reativo que encapsula o carregamento e cache da carteira de investimentos.
 *
 * Antes, toda esta lógica estava inline em Investments.tsx (~130 linhas).
 * Agora segue o padrão cache-then-revalidate usado em useExpenses / useIncomes.
 *
 * Escuta:
 *  - local-data-changed { entity: 'portfolio_transactions' } → recarrega
 *  - offline-queue-processed → recarrega
 *  - isOnline → recarrega ao reconectar
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/services/offlineCache'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useTheme } from '@/hooks/useTheme'
import { loadPortfolioValuation } from '@/utils/portfolioValuationLoader'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { loadHistoricalPrices } from '@/services/priceService'
import {
  calculateConsolidatedByClass,
  calculateConsolidatedBySector,
  calculateShareHistory,
  type AssetPosition,
  type ConsolidatedGroup,
} from '@/services/investmentEngine'
import type {
  PortfolioAssetDefinition,
  PortfolioGroupTarget,
  PortfolioTransaction,
  TargetAllocation,
  AssetPrice,
} from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface PortfolioData {
  cashBalance: number
  investedValue: number
  cashValue: number
  totalValue: number
  positions: AssetPosition[]
  consolidatedClass: ConsolidatedGroup[]
  consolidatedSector: ConsolidatedGroup[]
}

export interface UsePortfolioReturn {
  /** Dados calculados da carteira (posições, KPIs, consolidados) */
  portfolioData: PortfolioData | null
  /** Lista bruta de transações */
  transactions: PortfolioTransaction[]
  /** Metas de grupo (classe / setor) */
  groupTargets: PortfolioGroupTarget[]
  /** Definições de ativos (modo de precificação, taxa, etc.) */
  assetDefinitions: PortfolioAssetDefinition[]
  /** Metas individuais por ticker */
  targetAllocations: TargetAllocation[]
  /** Preços dos ativos no último carregamento */
  valuationPrices: Record<string, AssetPrice>
  /** Taxas de índice (CDI, SELIC, IPCA) */
  indexRatesByIndexer: Record<string, IndexRateMap>
  /** VNA do Tesouro */
  vnaMap: Record<string, number>
  /** ID do portfólio no banco */
  portfolioId: string
  /** true enquanto carrega pela primeira vez */
  loading: boolean
  /** true durante refresh forçado */
  refreshing: boolean
  /** Histórico de cotas calculado dinamicamente */
  dynamicHistory: ReturnType<typeof calculateShareHistory>
  /** Paleta de cores para gráficos */
  chartPalette: string[]
  /** Recarrega forçando atualização de cotações */
  refresh: () => Promise<void>
  /** Recarrega silenciosamente (ex: após salvar transação) */
  reload: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

type PortfolioCache = {
  portfolioData?: PortfolioData
  transactions?: PortfolioTransaction[]
  groupTargets?: PortfolioGroupTarget[]
  assetDefinitions?: PortfolioAssetDefinition[]
  historicalPrices?: Record<string, Record<string, number>>
}

function buildCacheKey(userId: string) {
  return `portfolio-valuation-data-${userId}`
}

const EMPTY_PORTFOLIO: PortfolioData = {
  cashBalance: 0,
  investedValue: 0,
  cashValue: 0,
  totalValue: 0,
  positions: [],
  consolidatedClass: [],
  consolidatedSector: [],
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePortfolio(): UsePortfolioReturn {
  const { isOnline } = useNetworkStatus()
  const { colorPalette } = useTheme()

  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [groupTargets, setGroupTargets] = useState<PortfolioGroupTarget[]>([])
  const [assetDefinitions, setAssetDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>([])
  const [valuationPrices, setValuationPrices] = useState<Record<string, AssetPrice>>({})
  const [indexRatesByIndexer, setIndexRatesByIndexer] = useState<Record<string, IndexRateMap>>({})
  const [vnaMap, setVnaMap] = useState<Record<string, number>>({})
  const [portfolioId, setPortfolioId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [historicalPrices, setHistoricalPrices] = useState<Record<string, Record<string, number>>>({})

  // ---------------------------------------------------------------------------
  // Carregamento principal (cache-then-revalidate)
  // ---------------------------------------------------------------------------

  const loadPortfolioData = useCallback(
    async (options?: { forceRefresh?: boolean; silent?: boolean }) => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const cacheKey = buildCacheKey(user.id)

        // 1. Serve cache primeiro (se não está forçando refresh)
        if (!options?.forceRefresh && !portfolioData) {
          const cached = await getCache<PortfolioCache>(cacheKey)
          if (cached) {
            if (cached.portfolioData) setPortfolioData(cached.portfolioData)
            if (cached.transactions) setTransactions(cached.transactions)
            if (cached.groupTargets) setGroupTargets(cached.groupTargets)
            if (cached.assetDefinitions) setAssetDefinitions(cached.assetDefinitions)
            if (cached.historicalPrices) setHistoricalPrices(cached.historicalPrices)
          }
        }

        // 2. Mostra spinner apenas na primeira carga (não em reloads silenciosos)
        if (!options?.silent) {
          setLoading(!portfolioData)
        }

        // 3. Busca ou cria o portfólio do usuário
        let { data: portfolio } = await supabase
          .from('portfolios')
          .select('id, cash_balance, last_close_date')
          .eq('client_id', user.id)
          .maybeSingle()

        if (!portfolio) {
          const { data: newPort, error: createError } = await supabase
            .from('portfolios')
            .insert({ client_id: user.id, cash_balance: 0.0 })
            .select('id, cash_balance, last_close_date')
            .single()
          if (createError) throw createError
          portfolio = newPort
        }

        if (!portfolio) return
        setPortfolioId(portfolio.id)

        // 4. Carrega transações, metas e targets
        const [txData, targetsResult, groupTargetsResult] = await Promise.all([
          fetchAllPortfolioTransactions(portfolio.id),
          supabase.from('target_allocations').select('*').eq('portfolio_id', portfolio.id),
          supabase.from('portfolio_group_targets').select('*').eq('portfolio_id', portfolio.id),
        ])

        const finalTransactions = txData || []
        const finalGroupTargets = groupTargetsResult.data || []
        const finalTargets = targetsResult.data || []

        setTransactions(finalTransactions)
        setGroupTargets(finalGroupTargets)
        setTargetAllocations(finalTargets)

        // 5. Portfólio vazio → zera state e persiste cache
        if (finalTransactions.length === 0) {
          setPortfolioData(EMPTY_PORTFOLIO)
          setHistoricalPrices({})
          await setCache(cacheKey, {
            portfolioData: EMPTY_PORTFOLIO,
            transactions: [],
            groupTargets: finalGroupTargets,
            assetDefinitions: [],
            historicalPrices: {},
          })
          return
        }

        // 6. Valoração completa
        const valuation = await loadPortfolioValuation(
          portfolio.id,
          finalTransactions,
          finalTargets,
          Number(portfolio.cash_balance) || 0,
          { forceRefresh: options?.forceRefresh },
        )

        setAssetDefinitions(valuation.definitions)
        setValuationPrices(valuation.prices)
        setIndexRatesByIndexer(valuation.indexRatesByIndexer)
        setVnaMap(valuation.vnaMap || {})

        const { positions, investedValue, cashValue, totalValue } = valuation
        // Carrega preços históricos para os ativos do portfólio
        let histPrices: Record<string, Record<string, number>> = {}
        if (finalTransactions.length > 0) {
          const sorted = [...finalTransactions].sort((a, b) => a.date.localeCompare(b.date))
          const startDate = sorted[0].date
          const todayStr = new Date().toISOString().split('T')[0]
          const tickers = Array.from(new Set(finalTransactions.map(tx => tx.ticker.toUpperCase())))
          histPrices = await loadHistoricalPrices(tickers, startDate, todayStr)
        }
        setHistoricalPrices(histPrices)

        const consolidatedClass = calculateConsolidatedByClass(positions, totalValue, finalGroupTargets)
        const consolidatedSector = calculateConsolidatedBySector(positions, totalValue, finalGroupTargets)

        const nextData: PortfolioData = {
          cashBalance: valuation.cashBalance,
          investedValue,
          cashValue,
          totalValue,
          positions,
          consolidatedClass,
          consolidatedSector,
        }

        setPortfolioData(nextData)

        // 7. Persiste no cache
        await setCache(cacheKey, {
          portfolioData: nextData,
          transactions: finalTransactions,
          groupTargets: finalGroupTargets,
          assetDefinitions: valuation.definitions,
          historicalPrices: histPrices,
        })
      } catch (err) {
        console.error('[usePortfolio] Erro ao carregar carteira:', err)
        toast.error('Erro ao sincronizar dados da carteira.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portfolioData],
  )

  // ---------------------------------------------------------------------------
  // Carga inicial + reconexão
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOnline) {
      void loadPortfolioData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // ---------------------------------------------------------------------------
  // Escuta eventos de mudança local (padrão do projeto)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onLocalDataChanged = (e: Event) => {
      const ev = e as CustomEvent
      if (
        ev.detail?.entity === 'portfolio_transactions' ||
        ev.detail?.entity === 'investments'
      ) {
        void loadPortfolioData({ silent: true })
      }
    }
    const onQueueProcessed = () => void loadPortfolioData({ silent: true })

    window.addEventListener('local-data-changed', onLocalDataChanged)
    window.addEventListener('offline-queue-processed', onQueueProcessed)
    return () => {
      window.removeEventListener('local-data-changed', onLocalDataChanged)
      window.removeEventListener('offline-queue-processed', onQueueProcessed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const dynamicHistory = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { currentShareValue: 1.0, totalShares: 0, shareHistory: [] }
    }
    return calculateShareHistory(
      transactions,
      valuationPrices,
      assetDefinitions,
      indexRatesByIndexer,
      historicalPrices,
      vnaMap,
    )
  }, [transactions, valuationPrices, assetDefinitions, indexRatesByIndexer, historicalPrices, vnaMap])

  const chartPalette = useMemo(() => {
    if (colorPalette === 'monochrome') {
      return Array.from({ length: 6 }, (_, i) => `var(--chart-mono-${i})`)
    }
    return [
      'var(--color-primary)',
      ...Array.from({ length: 6 }, (_, i) => `var(--chart-glass-${i})`),
    ]
  }, [colorPalette])

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadPortfolioData({ forceRefresh: true })
      toast.success('Cotações atualizadas com sucesso!')
    } catch {
      toast.error('Erro ao atualizar cotações.')
    } finally {
      setRefreshing(false)
    }
  }, [loadPortfolioData])

  const reload = useCallback(
    () => loadPortfolioData({ silent: true }),
    [loadPortfolioData],
  )

  return {
    portfolioData,
    transactions,
    groupTargets,
    assetDefinitions,
    targetAllocations,
    valuationPrices,
    indexRatesByIndexer,
    vnaMap,
    portfolioId,
    loading,
    refreshing,
    dynamicHistory,
    chartPalette,
    refresh,
    reload,
  }
}
