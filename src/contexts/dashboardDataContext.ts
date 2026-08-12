/**
 * Contexto + hooks focados dos dados do Dashboard (módulo sem JSX).
 * Separado de DashboardDataContext.tsx (que exporta apenas o Provider) para
 * fast-refresh limpo e contrato de hooks centralizado num único módulo (DRY).
 */
import { createContext, useContext } from 'react'
import type { DashboardData } from '@/hooks/useDashboardData'

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

export const DashboardDataContext = createContext<DashboardData | null>(null)

/* ------------------------------------------------------------------ */
/*  Internal helper                                                    */
/* ------------------------------------------------------------------ */

function useDashboardDataOrThrow(): DashboardData {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) {
    throw new Error(
      'Dashboard hooks must be used within a <DashboardDataProvider>. ' +
      'Wrap your component tree with <DashboardDataProvider>.',
    )
  }
  return ctx
}

/* ------------------------------------------------------------------ */
/*  Focused Hooks                                                     */
/* ------------------------------------------------------------------ */

/**
 * Apenas os dados financeiros essenciais (loading, totais, saldo).
 */
export function useDashboardFinances() {
  const ctx = useDashboardDataOrThrow()
  return {
    loading: ctx.loading,
    hasMonthlyData: ctx.hasMonthlyData,
    currentMonth: ctx.currentMonth,
    previousMonth: ctx.previousMonth,
    totalIncomes: ctx.totalIncomes,
    totalExpenses: ctx.totalExpenses,
    totalInvestments: ctx.totalInvestments,
    balance: ctx.balance,
    savingsRate: ctx.savingsRate,
    dailyFlowData: ctx.dailyFlowData,
    previousMonthDailyExpenses: ctx.previousMonthDailyExpenses,
    previousMonthExpenseTotal: ctx.previousMonthExpenseTotal,
    weekdayExpenseData: ctx.weekdayExpenseData,
  }
}

/**
 * Dados de orçamento, limites e projeções.
 */
export function useDashboardBudget() {
  const ctx = useDashboardDataOrThrow()
  return {
    spendingCalcs: ctx.spendingCalcs,
    spendingProjection: ctx.spendingProjection,
    totalLimits: ctx.totalLimits,
    limitUsedPercentage: ctx.limitUsedPercentage,
    progressColor: ctx.progressColor,
    currentMonthExpenseLimitMap: ctx.currentMonthExpenseLimitMap,
    reallocationRecommendation: ctx.reallocationRecommendation,
    expenseByCategory: ctx.expenseByCategory,
    categoriesAttentionList: ctx.categoriesAttentionList,
  }
}

/**
 * Insights, sugestões de otimização e refresh.
 */
export function useDashboardInsightsContext() {
  const ctx = useDashboardDataOrThrow()
  return {
    insights: ctx.insights,
    refreshInsights: ctx.refreshInsights,
    optimizationSummary: ctx.optimizationSummary,
  }
}

/**
 * Dados de portfólio/investimentos.
 */
export function useDashboardPortfolioContext() {
  const ctx = useDashboardDataOrThrow()
  return {
    portfolioId: ctx.portfolioId,
    portfolioTransactions: ctx.portfolioTransactions,
    loadPortfolioTransactions: ctx.loadPortfolioTransactions,
  }
}

/**
 * Ações de mutação (criar receita/despesa, refresh, limites).
 */
export function useDashboardActions() {
  const ctx = useDashboardDataOrThrow()
  return {
    categories: ctx.categories,
    incomeCategories: ctx.incomeCategories,
    creditCards: ctx.creditCards,
    createExpense: ctx.createExpense,
    createIncome: ctx.createIncome,
    setCategoryLimit: ctx.setCategoryLimit,
    refreshExpenses: ctx.refreshExpenses,
    refreshIncomes: ctx.refreshIncomes,
    refreshLimits: ctx.refreshLimits,
    isOnline: ctx.isOnline,
  }
}

/**
 * Hook full — compatível com o uso antigo de useDashboardData().
 * Útil para situações onde vários slices são consumidos.
 */
export { useDashboardDataOrThrow as useDashboardData }
