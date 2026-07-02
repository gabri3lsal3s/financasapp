import { useMemo, useState, useCallback } from 'react'
import type { Category, Expense, ExpenseCategoryMonthLimit } from '@/types'
import type { ColorPalette } from '@/utils/categoryColors'
const EXPENSE_LIMIT_WARNING_THRESHOLD = 85

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

export interface ExpenseLimitAlert {
  categoryId: string
  name: string
  color: string
  iconName?: string
  value: number
  baseValue: number
  limitAmount: number
  exceededAmount: number
  exceededPercentage: number
  usagePercentage: number
}

export interface ExpenseAttentionCategory {
  categoryId: string
  name: string
  color: string
  iconName?: string
  value: number
  baseValue: number
  limitAmount: number
  usagePercentage: number
  remainingAmount: number
  level: string
}

export interface CategoriesAttentionItem {
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

export interface UseBudgetLimitsReturn {
  currentLimitsMap: Map<string, number>
  spentMap: Map<string, number>
  expenseLimitMap: Map<string, number | null>
  expenseLimitAlerts: ExpenseLimitAlert[]
  expenseAttentionCategories: ExpenseAttentionCategory[]
  limitsExceededCount: number
  categoriesAttentionList: CategoriesAttentionItem[]
  reallocationRecommendation: ReallocationRecommendation | null
  isReallocating: boolean
  handleReallocate: () => Promise<void>
  expenseByCategory: Array<{ categoryId: string; name: string; color: string; iconName?: string; value: number; baseValue: number }>
  totalLimits: number
  limitUsedPercentage: number
  progressColor: string
}

export function useBudgetLimits(
  categories: Category[],
  expenses: Expense[],
  currentMonthExpenseLimits: ExpenseCategoryMonthLimit[],
  previousMonthExpenseLimits: ExpenseCategoryMonthLimit[],
  totalExpenses: number,
  totalIncomes: number,
  expenseAmountForDashboard: (amount: number, reportWeight?: number | null) => number,
  colorPalette: ColorPalette,
  getCategoryColorForPalette: (color: string, palette: ColorPalette) => string,
  setCategoryLimit: (categoryId: string, amount: number | null) => Promise<{ data: unknown; error: string | null }>,
  refreshLimits: () => Promise<void>,
): UseBudgetLimitsReturn {
  // ── Limits maps ──
  const currentLimitsMap = useMemo(() => {
    const map = new Map<string, number>()
    currentMonthExpenseLimits.forEach((l) => {
      if (l.limit_amount !== null && l.limit_amount !== undefined) {
        map.set(l.category_id, l.limit_amount)
      }
    })
    return map
  }, [currentMonthExpenseLimits])

  const spentMap = useMemo(() => {
    const map = new Map<string, number>()
    expenses.forEach((e) => {
      const weight = e.report_weight ?? 1
      map.set(e.category_id, (map.get(e.category_id) || 0) + e.amount * weight)
    })
    return map
  }, [expenses])

  // ── Expense by category ──
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; name: string; color: string; iconName?: string; value: number; baseValue: number }>()
    expenses.forEach((expense) => {
      const name = expense.category?.name || 'Sem categoria'
      const categoryId = expense.category?.id || expense.category_id || ''
      const key = categoryId || name
      const category = categories.find((c) => c.id === categoryId)
      const rawColor = category?.color || expense.category?.color || 'var(--color-primary)'
      const [_, iconName] = rawColor.split('|')
      const color = getCategoryColorForPalette(rawColor, colorPalette)
      const current = map.get(key)
      if (current) {
        current.value += expenseAmountForDashboard(expense.amount, expense.report_weight)
        current.baseValue += expense.amount
      } else {
        map.set(key, { categoryId, name, color, iconName, value: expenseAmountForDashboard(expense.amount, expense.report_weight), baseValue: expense.amount })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [expenses, categories, colorPalette, expenseAmountForDashboard, getCategoryColorForPalette])

  // ── Reallocation recommendation ──
  const reallocationRecommendation = useMemo((): ReallocationRecommendation | null => {
    const exceededList: Array<{ id: string; name: string; exceeded: number; limit: number }> = []
    const surplusList: Array<{ id: string; name: string; surplus: number; limit: number }> = []
    categories.forEach((cat) => {
      const limit = currentLimitsMap.get(cat.id)
      const spent = spentMap.get(cat.id) || 0
      if (limit !== undefined && limit > 0) {
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
  }, [categories, currentLimitsMap, spentMap])

  const [isReallocating, setIsReallocating] = useState(false)

  const handleReallocate = useCallback(async () => {
    if (!reallocationRecommendation) return
    setIsReallocating(true)
    const { fromId, fromCurrentLimit, toId, toCurrentLimit, transferAmount } = reallocationRecommendation
    const fromNewLimit = Math.max(0, fromCurrentLimit - transferAmount)
    const toNewLimit = toCurrentLimit + transferAmount
    const res1 = await setCategoryLimit(fromId, fromNewLimit)
    if (res1.error) {
      alert(`Erro ao atualizar limite de origem: ${res1.error}`)
      setIsReallocating(false)
      return
    }
    const res2 = await setCategoryLimit(toId, toNewLimit)
    if (res2.error) {
      alert(`Erro ao atualizar limite de destino: ${res2.error}`)
      setIsReallocating(false)
      return
    }
    setIsReallocating(false)
    refreshLimits()
  }, [reallocationRecommendation, setCategoryLimit, refreshLimits])

  // ── Limit maps (current + previous fallback) ──
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

  // ── Expense limit alerts ──
  const expenseLimitAlerts = useMemo((): ExpenseLimitAlert[] => {
    return expenseByCategory
      .map((item) => {
        const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : undefined
        const hasLimit = limitAmount !== null && limitAmount !== undefined
        if (!hasLimit) return null
        const exceededAmount = item.value - (limitAmount || 0)
        if (exceededAmount <= 0) return null
        const exceededPercentage = (limitAmount || 0) > 0 ? (exceededAmount / (limitAmount || 1)) * 100 : 100
        const usagePercentage = (limitAmount || 0) > 0 ? (item.value / (limitAmount || 1)) * 100 : 100
        return { ...item, limitAmount: limitAmount || 0, exceededAmount, exceededPercentage, usagePercentage }
      })
      .filter((item): item is ExpenseLimitAlert => Boolean(item))
      .sort((a, b) => b.exceededAmount - a.exceededAmount)
  }, [expenseByCategory, expenseLimitMap])

  // ── Expense attention categories ──
  const expenseAttentionCategories = useMemo((): ExpenseAttentionCategory[] => {
    return expenseByCategory
      .map((item) => {
        const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : undefined
        const hasLimit = limitAmount !== null && limitAmount !== undefined
        if (!hasLimit || (limitAmount || 0) <= 0) return null
        const usagePercentage = (item.value / (limitAmount || 1)) * 100
        const isNearLimit = usagePercentage >= EXPENSE_LIMIT_WARNING_THRESHOLD && usagePercentage < 100
        if (!isNearLimit) return null
        const level = usagePercentage >= 95 ? 'Crítica' : usagePercentage >= 90 ? 'Alta' : 'Média'
        return { ...item, level, usagePercentage, limitAmount: limitAmount || 0, remainingAmount: (limitAmount || 0) - item.value }
      })
      .filter((item): item is ExpenseAttentionCategory => Boolean(item))
      .sort((a, b) => b.usagePercentage - a.usagePercentage)
  }, [expenseByCategory, expenseLimitMap])

  const limitsExceededCount = useMemo(() => expenseLimitAlerts.length, [expenseLimitAlerts])

  // ── Categories attention list (merged alerts + attention) ──
  const categoriesAttentionList = useMemo((): CategoriesAttentionItem[] => {
    const list: CategoriesAttentionItem[] = []
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
        statusLabel: alert.level === 'Crítica' ? 'Crítico (95%+)' : alert.level === 'Alta' ? 'Alerta (90%+)' : 'Atenção (85%+)',
        alertStatusClass: 'text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-full',
      })
    })
    return list.sort((a, b) => b.usagePercentage - a.usagePercentage)
  }, [expenseLimitAlerts, expenseAttentionCategories])

  // ── Total limits and usage ──
  const totalLimits = useMemo(() => {
    return currentMonthExpenseLimits.reduce((sum, limit) => sum + (limit.limit_amount || 0), 0)
  }, [currentMonthExpenseLimits])

  const limitUsedPercentage = useMemo(() => {
    const effectiveLimit = totalLimits > 0 ? totalLimits : totalIncomes
    if (effectiveLimit <= 0) return 0
    return Math.min(100, (totalExpenses / effectiveLimit) * 100)
  }, [totalExpenses, totalLimits, totalIncomes])

  const progressColor = useMemo(() => {
    if (limitUsedPercentage >= 85) return 'bg-expense'
    if (limitUsedPercentage >= 70) return 'bg-warning'
    return 'bg-income'
  }, [limitUsedPercentage])

  return {
    currentLimitsMap,
    spentMap,
    expenseLimitMap,
    expenseByCategory,
    expenseLimitAlerts,
    expenseAttentionCategories,
    limitsExceededCount,
    categoriesAttentionList,
    reallocationRecommendation,
    isReallocating,
    handleReallocate,
    totalLimits,
    limitUsedPercentage,
    progressColor,
  }
}
