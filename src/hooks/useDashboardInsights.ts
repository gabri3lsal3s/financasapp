import { useMemo, useCallback, useState, useEffect } from 'react'
import { logger } from '@/utils/logger'
import { formatNumberWithTwoDecimalsBR } from '@/utils/format'
import {
  type AnalysisInput,
  computeStructuredInsights,
  type StructuredInsights,
} from '@/services/insightsEngine'
import {
  loadPinnedAnalysis,
  savePinnedAnalysis,
  clearPinnedAnalysis as clearPinned,
  type PinnedAnalysisPref,
} from '@/services/userPreferencesService'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PinnedInsightData = PinnedAnalysisPref

export interface UseDashboardInsightsReturn {
  insights: StructuredInsights
  hasNewData: boolean
  isUpdating: boolean
  pinnedInsight: PinnedInsightData | null
  updatePinnedInsight: () => Promise<void>
  clearPinnedInsight: () => Promise<void>
  refreshInsights: () => void
}

export function useDashboardInsights(input: AnalysisInput): UseDashboardInsightsReturn {
  const [pinnedInsight, setPinnedInsight] = useState<PinnedInsightData | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  /* ── Computed hash ── */
  const currentHash = useMemo(() => {
    const { totalIncomes, totalExpenses, expensesCount, incomesCount } = input
    const expHash = `${expensesCount}_${formatNumberWithTwoDecimalsBR(totalExpenses)}`
    const incHash = `${incomesCount}_${formatNumberWithTwoDecimalsBR(totalIncomes)}`
    return `exp:${expHash}|inc:${incHash}`
  }, [
    input.expensesCount,
    input.incomesCount,
    input.totalExpenses,
    input.totalIncomes,
  ])

  /* ── Compute structured insights ── */
  const insights: StructuredInsights = useMemo(() => {
    return computeStructuredInsights(input)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    input.currentMonth,
    input.totalIncomes,
    input.totalExpenses,
    input.totalInvestments,
    input.savingsRate,
    input.limitsExceededCount,
    input.spendingPace,
    input.spendingProjection,
    input.expenses.length,
    input.previousMonthExpenses.length,
    input.categoryExpenseSummaries.length,
    input.expensesWithLimit.length,
    refreshKey,
  ])

  /* ── Has new data since last pin? ── */
  const hasNewData = !!(pinnedInsight && pinnedInsight.dataHash !== currentHash)

  /* ── Load pinned insight from userPreferencesService ── */
  const loadPinnedInsight = useCallback(async () => {
    try {
      const data = await loadPinnedAnalysis()
      if (data) {
        setPinnedInsight({
          text: data.text || 'Análise Financeira',
          dataHash: data.dataHash || '',
        })
      }
    } catch (err) {
      logger.error('Erro ao carregar insight fixado:', err)
    }
  }, [])

  useEffect(() => {
    void loadPinnedInsight()
  }, [loadPinnedInsight])

  /* ── Update pinned insight ── */
  const updatePinnedInsight = useCallback(async () => {
    setIsUpdating(true)
    try {
      const newPinned: PinnedInsightData = {
        text: `Resumo Financeiro - ${input.currentMonth}`,
        dataHash: currentHash,
      }
      await savePinnedAnalysis(newPinned)
      setPinnedInsight(newPinned)
    } catch (err) {
      logger.error('Erro ao atualizar insight fixado:', err)
    } finally {
      setIsUpdating(false)
    }
  }, [currentHash, input.currentMonth])

  /* ── Clear pinned insight ── */
  const clearPinnedInsight = useCallback(async () => {
    try {
      await clearPinned()
      setPinnedInsight(null)
    } catch (err) {
      logger.error('Erro ao limpar insight fixado:', err)
    }
  }, [])

  /* ── Force refresh ── */
  const refreshInsights = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    insights,
    hasNewData,
    isUpdating,
    pinnedInsight,
    updatePinnedInsight,
    clearPinnedInsight,
    refreshInsights,
  }
}
