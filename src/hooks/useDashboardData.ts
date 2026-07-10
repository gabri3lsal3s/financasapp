import { useMemo } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { getCurrentMonthString, addMonths } from '@/utils/format'
import { portfolioInvestmentByDay, sumPortfolioTransactionsForMonth } from '@/utils/portfolioMonthlyFlow'
import { useDashboardPortfolio } from '@/hooks/useDashboardPortfolio'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useDashboardInsights } from '@/hooks/useDashboardInsights'
import { useSpendingCalculations } from '@/hooks/useSpendingCalculations'
import { useSpendingProjection } from '@/hooks/useSpendingProjection'
import { useBudgetLimits } from '@/hooks/useBudgetLimits'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { generateOptimizationSuggestions } from '@/services/insightsEngine'
import type { AnalysisInput } from '@/services/insightsEngine'
import type { Expense, Income, PortfolioTransaction } from '@/types'
import { applyReportWeight } from '@/utils/reportWeight'

/* ------------------------------------------------------------------ */
/*  Return Type                                                        */
/* ------------------------------------------------------------------ */

export interface DashboardData {
  // Loading
  loading: boolean
  hasMonthlyData: boolean
  currentMonth: string
  previousMonth: string

  // Core financials
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
  balance: number
  savingsRate: number

  // Raw data arrays (for modals/drill-down)
  expenses: Expense[]
  incomes: Income[]

  // Budget
  spendingCalcs: ReturnType<typeof useSpendingCalculations>
  spendingProjection: ReturnType<typeof useSpendingProjection>
  totalLimits: number
  limitUsedPercentage: number
  progressColor: string

  // Chart
  dailyFlowData: Array<{ day: string; Rendas: number; Despesas: number; Investimentos: number }>

  // Derived
  previousMonthExpenseTotal: number
  weekdayExpenseData: Array<{ dia: string; Despesas: number }>

  // Insights & Optimization
  insights: ReturnType<typeof useDashboardInsights>['insights']
  refreshInsights: () => void
  optimizationSummary: ReturnType<typeof generateOptimizationSuggestions>

  // Portfolio
  portfolioId: string
  portfolioTransactions: PortfolioTransaction[]
  loadPortfolioTransactions: () => Promise<void>

  // Reference data for modals
  categories: ReturnType<typeof useCategories>['categories']
  incomeCategories: ReturnType<typeof useIncomeCategories>['incomeCategories']
  creditCards: ReturnType<typeof useCreditCards>['creditCards']
  currentMonthExpenseLimitMap: Map<string, number | null>
  reallocationRecommendation: ReturnType<typeof useBudgetLimits>['reallocationRecommendation']
  expenseByCategory: ReturnType<typeof useBudgetLimits>['expenseByCategory']
  categoriesAttentionList: ReturnType<typeof useBudgetLimits>['categoriesAttentionList']

  // Mutation helpers
  createExpense: ReturnType<typeof useExpenses>['createExpense']
  createIncome: ReturnType<typeof useIncomes>['createIncome']
  setCategoryLimit: ReturnType<typeof useExpenseCategoryLimits>['setCategoryLimit']
  refreshExpenses: () => Promise<void>
  refreshIncomes: () => Promise<void>
  refreshLimits: () => Promise<void>
  isOnline: boolean
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDashboardData(): DashboardData {
  const currentMonth = getCurrentMonthString()
  const { isOnline } = useNetworkStatus()

  // Portfolio
  const {
    portfolioId,
    portfolioTransactions,
    loadPortfolioTransactions,
  } = useDashboardPortfolio()

  // Colors & Categories
  const { colorPalette } = usePaletteColors()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { creditCards } = useCreditCards()

  // Months
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const monthMinus2 = useMemo(() => addMonths(currentMonth, -2), [currentMonth])
  const monthMinus3 = useMemo(() => addMonths(currentMonth, -3), [currentMonth])

  // Expenses — current month + 3 historical months for subscription detection
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { expenses: expensesMinus2 } = useExpenses(monthMinus2)
  const { expenses: expensesMinus3 } = useExpenses(monthMinus3)

  // Incomes
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)

  // Limits
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading, setCategoryLimit, refreshLimits } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)

  // O reportWeight é aplicado inline via applyReportWeight (utilitário puro)

  // ── Totals ──
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + applyReportWeight(exp.amount, exp.report_weight), 0),
    [expenses],
  )

  const totalIncomes = useMemo(
    () => incomes.reduce((sum, inc) => sum + applyReportWeight(inc.amount, inc.report_weight), 0),
    [incomes],
  )

  const portfolioMonthFlow = useMemo(
    () => sumPortfolioTransactionsForMonth(portfolioTransactions, currentMonth),
    [portfolioTransactions, currentMonth],
  )

  const totalInvestments = useMemo(() => portfolioMonthFlow, [portfolioMonthFlow])

  const balance = totalIncomes - totalExpenses - totalInvestments
  const savingsRate = totalIncomes > 0 ? (balance / totalIncomes) * 100 : 0

  const hasMonthlyData = expenses.length > 0 || incomes.length > 0 || portfolioMonthFlow !== 0

  const loading = expensesLoading || incomesLoading || expenseLimitsLoading || previousExpenseLimitsLoading

  const previousMonthExpenseTotal = useMemo(
    () => previousMonthExpenses.reduce((sum, exp) => sum + applyReportWeight(exp.amount, exp.report_weight), 0),
    [previousMonthExpenses],
  )

  // ── Budget Hooks ──
  const spendingCalcs = useSpendingCalculations(currentMonth, totalIncomes, totalExpenses, totalInvestments)
  const spendingProjection = useSpendingProjection(currentMonth, totalExpenses, totalIncomes, totalInvestments)

  const {
    spentMap,
    expenseByCategory,
    limitsExceededCount,
    reallocationRecommendation,
    totalLimits,
    limitUsedPercentage,
    progressColor,
    categoriesAttentionList,
  } = useBudgetLimits(
    categories,
    expenses,
    currentMonthExpenseLimits,
    previousMonthExpenseLimits,
    totalExpenses,
    totalIncomes,
    colorPalette,
    getCategoryColorForPalette,
    setCategoryLimit,
    refreshLimits,
  )

  // ── Limit Map ──
  const currentMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    currentMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [currentMonthExpenseLimits])

  // ── Derived Data for Insights ──
  const categoryExpenseSummaries = useMemo(
    () => expenseByCategory.map(item => ({ category_name: item.name, total: item.value, baseTotal: item.baseValue })),
    [expenseByCategory],
  )

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>()
    incomes.forEach((inc) => {
      const name = inc.income_category?.name || 'Outros'
      const amount = applyReportWeight(inc.amount, inc.report_weight)
      map.set(name, (map.get(name) || 0) + amount)
    })
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [incomes])

  const spendingPace = useMemo(() => {
    if (totalIncomes <= 0 || totalExpenses <= 0) return null
    const today = new Date()
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const currentDay = today.getDate()
    if (currentDay <= 7) return null
    const monthFraction = currentDay / daysInMonth
    if (monthFraction < 0.3) return null
    const fairShare = (totalIncomes - totalInvestments) * monthFraction
    if (fairShare <= 0) return null
    if (totalExpenses > fairShare) {
      const overPct = ((totalExpenses - fairShare) / fairShare) * 100
      return { overPct, isOverBudget: true }
    }
    return null
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments])

  const weekdayExpenseData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const totals = labels.map((label) => ({ dia: label, Despesas: 0 }))
    expenses.forEach((expense) => {
      if (!expense.date?.startsWith(currentMonth)) return
      const localDate = new Date(`${expense.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) return
      const dayOfWeek = localDate.getDay()
      const mondayFirstIndex = (dayOfWeek + 6) % 7
      totals[mondayFirstIndex].Despesas += applyReportWeight(expense.amount, expense.report_weight)
    })
    return totals
  }, [expenses, currentMonth])

  const expensesWithLimit = useMemo(() => {
    return categories
      .map((cat) => {
        const limit = currentMonthExpenseLimitMap.get(cat.id)
        const spent = expenses
          .filter((e) => (e.category?.id || e.category_id) === cat.id)
          .reduce((s, e) => s + e.amount * (e.report_weight ?? 1), 0)
        return { categoryId: cat.id, spent, limit: limit ?? null, name: cat.name }
      })
      .filter((item) => item.limit !== null && item.limit !== undefined)
  }, [categories, expenses, currentMonthExpenseLimitMap])

  // ── Insights Engine ──
  const aiInput: AnalysisInput = useMemo(() => ({
    currentMonth,
    totalIncomes,
    totalExpenses,
    totalInvestments,
    savingsRate,
    categoryExpenseSummaries,
    previousMonthExpenseTotal,
    weekdayExpenseData,
    limitsExceededCount,
    incomeByCategory,
    spendingPace,
    spendingProjection,
    balance,
    expenses,
    previousMonthExpenses,
    additionalPreviousMonthExpenses: [expensesMinus2, expensesMinus3],
    categories: categories.map(c => ({ id: c.id, name: c.name })),
    expensesWithLimit,
    expensesCount: expenses.length,
    incomesCount: incomes.length,
  }), [
    currentMonth, totalIncomes, totalExpenses, totalInvestments,
    savingsRate, categoryExpenseSummaries, previousMonthExpenseTotal,
    weekdayExpenseData, limitsExceededCount, incomeByCategory,
    spendingPace, spendingProjection, balance,
    expenses, previousMonthExpenses, expensesMinus2, expensesMinus3,
    categories, expensesWithLimit,
  ])

  const { insights, refreshInsights } = useDashboardInsights(aiInput)

  const optimizationSummary = useMemo(() => {
    return generateOptimizationSuggestions({
      insights,
      categoriesWithLimit: categories.map(c => ({
        categoryId: c.id,
        name: c.name,
        spent: spentMap.get(c.id) || 0,
        limit: currentMonthExpenseLimitMap.get(c.id) ?? null,
      })),
      reallocationRecommendation: reallocationRecommendation ? {
        fromId: reallocationRecommendation.fromId,
        fromName: reallocationRecommendation.fromName,
        toId: reallocationRecommendation.toId,
        toName: reallocationRecommendation.toName,
        transferAmount: reallocationRecommendation.transferAmount,
      } : null,
      totalIncomes,
      totalExpenses,
    })
  }, [
    insights, categories, spentMap,
    currentMonthExpenseLimitMap, reallocationRecommendation,
    totalIncomes, totalExpenses,
  ])

  // ── Daily Flow Data ──
  const dailyFlowData = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const series = Array.from({ length: daysInMonth }, (_, index) => ({
      day: String(index + 1).padStart(2, '0'),
      Rendas: 0,
      Despesas: 0,
      Investimentos: 0,
    }))

    incomes.forEach((income) => {
      const day = new Date(`${income.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) {
        series[day - 1].Rendas += applyReportWeight(income.amount, income.report_weight)
      }
    })
    expenses.forEach((expense) => {
      const day = new Date(`${expense.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) {
        series[day - 1].Despesas += applyReportWeight(expense.amount, expense.report_weight)
      }
    })
    const portfolioByDay = portfolioInvestmentByDay(portfolioTransactions, currentMonth, daysInMonth)
    portfolioByDay.forEach((value, index) => {
      series[index].Investimentos += value
    })

    return series
  }, [currentMonth, incomes, expenses, portfolioTransactions])

  return {
    loading,
    hasMonthlyData,
    currentMonth,
    previousMonth,
    totalIncomes,
    totalExpenses,
    totalInvestments,
    balance,
    savingsRate,
    expenses,
    incomes,
    spendingCalcs,
    spendingProjection,
    totalLimits,
    limitUsedPercentage,
    progressColor,
    dailyFlowData,
    previousMonthExpenseTotal,
    weekdayExpenseData,
    insights,
    refreshInsights,
    optimizationSummary,
    portfolioId,
    portfolioTransactions,
    loadPortfolioTransactions,
    categories,
    incomeCategories,
    creditCards,
    currentMonthExpenseLimitMap,
    reallocationRecommendation,
    expenseByCategory,
    categoriesAttentionList,
    createExpense,
    createIncome,
    setCategoryLimit,
    refreshExpenses,
    refreshIncomes,
    refreshLimits,
    isOnline,
  }
}
