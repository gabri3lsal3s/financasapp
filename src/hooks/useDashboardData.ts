import { useMemo, useCallback } from 'react'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import {
  addMonths,
  getCurrentMonthString,
} from '@/utils/format'
import { portfolioInvestmentByDay, sumPortfolioTransactionsForMonth } from '@/utils/portfolioMonthlyFlow'
import type { PortfolioTransaction } from '@/types'

const EXPENSE_LIMIT_WARNING_THRESHOLD = 85

export interface SpendingCalcs {
  mode: 'past' | 'future' | 'current'
  title: string
  monthlyAvailable: number
  dailyAvailable: number
  daysInMonth: number
  remainingDays?: number
  currentDay?: number
}

export interface SpendingProjection {
  daysElapsed: number
  daysInMonth: number
  currentDay: number
  dailyBurnRate: number
  projectedEndOfMonthExpenses: number
  projectedSurplus: number
  onTrack: boolean
  mode: 'past' | 'current'
}

export interface ReallocationRecommendation {
  fromId: string
  fromName: string
  fromCurrentLimit: number
  toId: string
  toName: string
  toCurrentLimit: number
  exceededAmount: number
  transferAmount: number
}



export interface CategoryAlert {
  categoryId: string
  name: string
  color: string
  iconName?: string
  value: number
  baseValue: number
  limitAmount: number
  usagePercentage: number
  isExceeded: boolean
  exceededAmount?: number
  remainingAmount?: number
  statusLabel: string
  alertStatusClass: string
}

export interface ExpenseByCategoryItem {
  categoryId: string
  name: string
  color: string
  iconName?: string
  value: number
  baseValue: number
}

export interface UseDashboardDataOptions {
  portfolioTransactions: PortfolioTransaction[]
  currentMonth?: string
}

export interface UseDashboardDataReturn {
  currentMonth: string
  previousMonth: string
  expenses: ReturnType<typeof useExpenses>['expenses']
  expensesLoading: boolean
  refreshExpenses: () => Promise<void>
  createExpense: ReturnType<typeof useExpenses>['createExpense']
  previousMonthExpenses: ReturnType<typeof useExpenses>['expenses']
  incomes: ReturnType<typeof useIncomes>['incomes']
  incomesLoading: boolean
  refreshIncomes: () => Promise<void>
  createIncome: ReturnType<typeof useIncomes>['createIncome']
  categories: ReturnType<typeof useCategories>['categories']
  categoriesLoading: boolean
  incomeCategories: ReturnType<typeof useIncomeCategories>['incomeCategories']
  incomeCategoriesLoading: boolean
  creditCards: ReturnType<typeof useCreditCards>['creditCards']
  currentMonthExpenseLimits: ReturnType<typeof useExpenseCategoryLimits>['limits']
  expenseLimitsLoading: boolean
  setCategoryLimit: ReturnType<typeof useExpenseCategoryLimits>['setCategoryLimit']
  refreshLimits: () => Promise<void>
  colorPalette: ReturnType<typeof usePaletteColors>['colorPalette']
  totalExpenses: number
  totalIncomes: number
  totalInvestments: number
  balance: number
  savingsRate: number
  hasMonthlyData: boolean
  loading: boolean
  previousMonthExpenseTotal: number
  expenseByCategory: ExpenseByCategoryItem[]
  incomeByCategory: { name: string; total: number }[]
  spendingCalcs: SpendingCalcs
  spendingProjection: SpendingProjection | null
  currentMonthExpenseLimitMap: Map<string, number | null>
  expenseLimitMap: Map<string, number | null>
  expenseLimitAlerts: (ExpenseByCategoryItem & { limitAmount: number; exceededAmount: number; exceededPercentage: number; usagePercentage: number })[]
  expenseAttentionCategories: (ExpenseByCategoryItem & { level: string; usagePercentage: number; limitAmount: number; remainingAmount: number })[]
  limitsExceededCount: number
  categoriesAttentionList: CategoryAlert[]
  totalLimits: number
  limitUsedPercentage: number
  progressColor: string
  dailyFlowData: { day: string; Rendas: number; Despesas: number; Investimentos: number }[]
  weekdayExpenseData: { dia: string; Despesas: number }[]
  reallocationRecommendation: ReallocationRecommendation | null
  spendingPace: { overPct: number; isOverBudget: boolean } | null
  currentMonthIncomeTotal: number
}

export function useDashboardData(
  options: UseDashboardDataOptions,
): UseDashboardDataReturn {
  const { portfolioTransactions, currentMonth: optionMonth } = options
  const currentMonth = optionMonth || getCurrentMonthString()
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])

  const { colorPalette } = usePaletteColors()
  const { categories, loading: categoriesLoading } = useCategories()
  const { incomeCategories, loading: incomeCategoriesLoading } = useIncomeCategories()
  const { creditCards } = useCreditCards()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading, setCategoryLimit, refreshLimits } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)

  // ── Helpers ──
  const expenseAmountForDashboard = useCallback(
    (amount: number, reportWeight?: number | null) => amount * (reportWeight ?? 1),
    [],
  )

  const incomeAmountForDashboard = useCallback(
    (amount: number, reportWeight?: number | null) => amount * (reportWeight ?? 1),
    [],
  )

  // ── Totals ──
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0),
    [expenses, expenseAmountForDashboard],
  )

  const totalIncomes = useMemo(
    () => incomes.reduce((sum, inc) => sum + incomeAmountForDashboard(inc.amount, inc.report_weight), 0),
    [incomes, incomeAmountForDashboard],
  )

  const currentMonthIncomeTotal = totalIncomes

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
    () => previousMonthExpenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0),
    [previousMonthExpenses, expenseAmountForDashboard],
  )

  // ── Gasto Disponível ──
  const spendingCalcs = useMemo((): SpendingCalcs => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const systemMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const isPast = currentMonth < systemMonthStr
    const isFuture = currentMonth > systemMonthStr

    const [selYear, selMonth] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(selYear, selMonth, 0).getDate()
    const monthlyAvailable = totalIncomes - totalInvestments - totalExpenses

    if (isPast) {
      return {
        mode: 'past',
        title: 'Gasto Disponível (Mês Encerrado)',
        monthlyAvailable,
        dailyAvailable: 0,
        daysInMonth,
        remainingDays: 0,
      }
    }

    if (isFuture) {
      const totalProjected = totalIncomes - totalInvestments
      const dailyAvailable = daysInMonth > 0 ? Math.max(0, totalProjected / daysInMonth) : 0
      return {
        mode: 'future',
        title: 'Gasto Disponível Projetado',
        monthlyAvailable: totalProjected,
        dailyAvailable,
        daysInMonth,
        remainingDays: daysInMonth,
      }
    }

    const currentDay = today.getDate()
    const remainingDays = daysInMonth - currentDay + 1
    const dailyAvailable = remainingDays > 0 ? Math.max(0, monthlyAvailable / remainingDays) : 0

    return {
      mode: 'current',
      title: 'Gasto Disponível',
      currentDay,
      daysInMonth,
      remainingDays,
      monthlyAvailable,
      dailyAvailable,
    }
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments])

  // ── Projeção de Fim do Mês ──
  const spendingProjection = useMemo((): SpendingProjection | null => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const systemMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const isPast = currentMonth < systemMonthStr
    const isFuture = currentMonth > systemMonthStr

    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    if (daysInMonth <= 0) return null

    if (isPast) {
      return {
        daysElapsed: daysInMonth,
        daysInMonth,
        currentDay: daysInMonth,
        dailyBurnRate: daysInMonth > 0 ? totalExpenses / daysInMonth : 0,
        projectedEndOfMonthExpenses: totalExpenses,
        projectedSurplus: totalIncomes - totalInvestments - totalExpenses,
        onTrack: (totalIncomes - totalInvestments - totalExpenses) >= 0,
        mode: 'past',
      }
    }

    if (isFuture) return null

    const currentDay = today.getDate()
    if (currentDay < 3) return null

    const daysElapsed = Math.min(currentDay, daysInMonth)
    const dailyBurnRate = daysElapsed > 0 ? totalExpenses / daysElapsed : 0
    const projectedEndOfMonthExpenses = dailyBurnRate * daysInMonth
    const projectedSurplus = totalIncomes - totalInvestments - projectedEndOfMonthExpenses
    const onTrack = projectedSurplus >= 0

    return {
      daysElapsed,
      daysInMonth,
      currentDay,
      dailyBurnRate,
      projectedEndOfMonthExpenses,
      projectedSurplus,
      onTrack,
      mode: 'current',
    }
  }, [currentMonth, totalExpenses, totalIncomes, totalInvestments])

  // ── Limites ──
  const currentMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    currentMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [currentMonthExpenseLimits])

  const previousMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [previousMonthExpenseLimits])

  const expenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    categories.forEach((category) => {
      const currentValue = currentMonthExpenseLimitMap.get(category.id)
      if (currentValue !== undefined) {
        map.set(category.id, currentValue)
        return
      }
      const previousValue = previousMonthExpenseLimitMap.get(category.id)
      if (previousValue !== undefined) {
        map.set(category.id, previousValue)
      }
    })
    return map
  }, [categories, currentMonthExpenseLimitMap, previousMonthExpenseLimitMap])

  // ── Expense by Category ──
  const expenseByCategory = useMemo((): ExpenseByCategoryItem[] => {
    const map = new Map<string, ExpenseByCategoryItem>()
    expenses.forEach((expense) => {
      const name = expense.category?.name || 'Sem categoria'
      const categoryId = expense.category?.id || expense.category_id || ''
      const key = categoryId || name
      const category = categories.find((c) => c.id === categoryId)
      const rawColor = category?.color || expense.category?.color || 'var(--color-primary)'
      const [_, iconName] = rawColor.split('|')
      const color = getCategoryColorForPalette(rawColor, colorPalette)
      const current = map.get(key)
      const value = expenseAmountForDashboard(expense.amount, expense.report_weight)

      if (current) {
        current.value += value
        current.baseValue += expense.amount
      } else {
        map.set(key, { categoryId, name, color, iconName, value, baseValue: expense.amount })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [expenses, categories, colorPalette, expenseAmountForDashboard])

  // ── Expense Limit Alerts ──
  const expenseLimitAlerts = useMemo(() => {
    return expenseByCategory
      .map((item) => {
        const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : undefined
        const hasLimit = limitAmount !== null && limitAmount !== undefined
        if (!hasLimit) return null
        const exceededAmount = item.value - (limitAmount || 0)
        if (exceededAmount <= 0) return null
        const usagePercentage = (limitAmount || 0) > 0 ? (item.value / (limitAmount || 1)) * 100 : 100
        return {
          ...item,
          limitAmount: limitAmount || 0,
          exceededAmount,
          exceededPercentage: (limitAmount || 0) > 0 ? (exceededAmount / (limitAmount || 1)) * 100 : 100,
          usagePercentage,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.exceededAmount - a.exceededAmount)
  }, [expenseByCategory, expenseLimitMap])

  const expenseAttentionCategories = useMemo(() => {
    return expenseByCategory
      .map((item) => {
        const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : undefined
        const hasLimit = limitAmount !== null && limitAmount !== undefined
        if (!hasLimit || (limitAmount || 0) <= 0) return null
        const usagePercentage = (item.value / (limitAmount || 1)) * 100
        const isNearLimit = usagePercentage >= EXPENSE_LIMIT_WARNING_THRESHOLD && usagePercentage < 100
        if (!isNearLimit) return null
        const level = usagePercentage >= 95 ? 'Crítica' : usagePercentage >= 90 ? 'Alta' : 'Média'
        return {
          ...item,
          level,
          usagePercentage,
          limitAmount: limitAmount || 0,
          remainingAmount: (limitAmount || 0) - item.value,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.usagePercentage - a.usagePercentage)
  }, [expenseByCategory, expenseLimitMap])

  const limitsExceededCount = useMemo(() => expenseLimitAlerts.length, [expenseLimitAlerts])

  // ── Categories Attention List ──
  const categoriesAttentionList = useMemo((): CategoryAlert[] => {
    const list: CategoryAlert[] = []
    expenseLimitAlerts.forEach((alert) => {
      list.push({
        categoryId: alert.categoryId || '',
        name: alert.name,
        color: alert.color,
        iconName: alert.iconName,
        value: alert.value,
        baseValue: alert.baseValue,
        limitAmount: alert.limitAmount,
        usagePercentage: alert.usagePercentage,
        isExceeded: true,
        exceededAmount: alert.exceededAmount,
        statusLabel: 'Excedido',
        alertStatusClass: 'text-expense font-bold bg-expense/10 px-2 py-0.5 rounded-full',
      })
    })
    expenseAttentionCategories.forEach((alert) => {
      list.push({
        categoryId: alert.categoryId || '',
        name: alert.name,
        color: alert.color,
        iconName: alert.iconName,
        value: alert.value,
        baseValue: alert.baseValue,
        limitAmount: alert.limitAmount,
        usagePercentage: alert.usagePercentage,
        isExceeded: false,
        remainingAmount: alert.remainingAmount,
        statusLabel:
          alert.level === 'Crítica'
            ? 'Crítico (95%+)'
            : alert.level === 'Alta'
              ? 'Alerta (90%+)'
              : 'Atenção (85%+)',
        alertStatusClass: 'text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-full',
      })
    })
    return list.sort((a, b) => b.usagePercentage - a.usagePercentage)
  }, [expenseLimitAlerts, expenseAttentionCategories])

  // ── Total Limits ──
  const totalLimits = useMemo(
    () => currentMonthExpenseLimits.reduce((sum, limit) => sum + (limit.limit_amount || 0), 0),
    [currentMonthExpenseLimits],
  )

  const limitUsedPercentage = useMemo(() => {
    if (totalLimits <= 0) return 0
    return Math.min(100, (totalExpenses / totalLimits) * 100)
  }, [totalExpenses, totalLimits])

  const progressColor = useMemo(() => {
    if (limitUsedPercentage >= 85) return 'bg-expense'
    if (limitUsedPercentage >= 70) return 'bg-warning'
    return 'bg-income'
  }, [limitUsedPercentage])

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
      if (day >= 1 && day <= daysInMonth) series[day - 1].Rendas += incomeAmountForDashboard(income.amount, income.report_weight)
    })

    expenses.forEach((expense) => {
      const day = new Date(`${expense.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) series[day - 1].Despesas += expenseAmountForDashboard(expense.amount, expense.report_weight)
    })

    const portfolioByDay = portfolioInvestmentByDay(portfolioTransactions, currentMonth, daysInMonth)
    portfolioByDay.forEach((value, index) => {
      series[index].Investimentos += value
    })

    return series
  }, [currentMonth, incomes, expenses, portfolioTransactions, incomeAmountForDashboard, expenseAmountForDashboard])

  // ── Weekday Expense Data ──
  const weekdayExpenseData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const totals = labels.map((label) => ({ dia: label, Despesas: 0 }))

    expenses.forEach((expense) => {
      if (!expense.date?.startsWith(currentMonth)) return
      const localDate = new Date(`${expense.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) return
      const dayOfWeek = localDate.getDay()
      const mondayFirstIndex = (dayOfWeek + 6) % 7
      totals[mondayFirstIndex].Despesas += expenseAmountForDashboard(expense.amount, expense.report_weight)
    })

    return totals
  }, [expenses, currentMonth, expenseAmountForDashboard])

  // ── Income by Category ──
  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>()
    incomes.forEach((inc) => {
      const name = inc.income_category?.name || 'Outros'
      const amount = incomeAmountForDashboard(inc.amount, inc.report_weight)
      map.set(name, (map.get(name) || 0) + amount)
    })
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [incomes, incomeAmountForDashboard])

  // ── Spending Pace (mid-month) ──
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

  // ── Reallocation Recommendation ──
  const reallocationRecommendation = useMemo((): ReallocationRecommendation | null => {
    const exceededList: Array<{ id: string; name: string; exceeded: number; limit: number }> = []
    const surplusList: Array<{ id: string; name: string; surplus: number; limit: number }> = []

    categories.forEach((cat) => {
      const limit = currentMonthExpenseLimitMap.get(cat.id)
      const spent = expenses.reduce((sum, e) => {
        if (e.category_id === cat.id) return sum + e.amount * (e.report_weight ?? 1)
        return sum
      }, 0)

      if (limit !== undefined && limit !== null && limit > 0) {
        if (spent > limit) {
          exceededList.push({ id: cat.id, name: cat.name, exceeded: spent - limit, limit })
        } else if (limit > spent) {
          surplusList.push({ id: cat.id, name: cat.name, surplus: limit - spent, limit })
        }
      }
    })

    if (exceededList.length === 0 || surplusList.length === 0) return null

    exceededList.sort((a, b) => b.exceeded - a.exceeded)
    surplusList.sort((a, b) => b.surplus - a.surplus)
    const targetTo = exceededList[0]
    const targetFrom = surplusList[0]
    let amountToTransfer = Math.min(targetTo.exceeded, targetFrom.surplus)
    amountToTransfer = Math.max(10, Math.round(amountToTransfer / 10) * 10)
    if (amountToTransfer < 10) return null

    return {
      fromId: targetFrom.id,
      fromName: targetFrom.name,
      fromCurrentLimit: targetFrom.limit,
      toId: targetTo.id,
      toName: targetTo.name,
      toCurrentLimit: targetTo.limit,
      exceededAmount: targetTo.exceeded,
      transferAmount: amountToTransfer,
    }
  }, [categories, currentMonthExpenseLimitMap, expenses])

  return {
    currentMonth,
    previousMonth,
    expenses,
    expensesLoading,
    refreshExpenses,
    createExpense,
    previousMonthExpenses,
    incomes,
    incomesLoading,
    refreshIncomes,
    createIncome,
    categories,
    categoriesLoading,
    incomeCategories,
    incomeCategoriesLoading,
    creditCards,
    currentMonthExpenseLimits,
    expenseLimitsLoading,
    setCategoryLimit,
    refreshLimits,
    colorPalette,
    totalExpenses,
    totalIncomes,
    totalInvestments,
    balance,
    savingsRate,
    hasMonthlyData,
    loading,
    previousMonthExpenseTotal,
    expenseByCategory,
    incomeByCategory,
    spendingCalcs,
    spendingProjection,
    currentMonthExpenseLimitMap,
    expenseLimitMap,
    expenseLimitAlerts,
    expenseAttentionCategories,
    limitsExceededCount,
    categoriesAttentionList,
    totalLimits,
    limitUsedPercentage,
    progressColor,
    dailyFlowData,
    weekdayExpenseData,
    reallocationRecommendation,
    spendingPace,
    currentMonthIncomeTotal,
  }
}
