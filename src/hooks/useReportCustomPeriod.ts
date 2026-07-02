import { useState, useCallback, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'
import {
  generateMonthsRange,
  generateDaysRange,
  buildPaymentMethodsBreakdown,
  computePeriodPendingInRange,
} from '@/utils/reportAggregation'
import {
  buildCustomCategoryExpenses,
  buildCustomCategoryIncomes,
  buildCustomMonthlySummaries,
  buildCustomDailySummaries,
  buildCustomMonthlyCategoryExpenses,
  buildCustomDailyCategoryExpenses,
  buildCustomMonthlyIncomeByCategory,
  buildCustomDailyIncomeByCategory,
  buildCustomCumulativeBalance,
  buildCustomTrendData,
  buildCustomConsolidatedSummary,
  buildCustomDailyConsolidated,
  buildCustomWeekdayData,
  buildBaseTotalsMap,
} from '@/utils/reportCustomData'
import type { PortfolioTransaction } from '@/types'
import type {
  DetailExpenseEntry,
  DetailIncomeEntry,
  TrendSeriesMeta,
} from '@/types/reports'
import type { Debt, CreditCard } from '@/types'

export interface CustomPeriodData {
  startDate: string
  endDate: string
  setStartDate: (d: string) => void
  setEndDate: (d: string) => void
  loading: boolean
  expenses: DetailExpenseEntry[]
  incomes: DetailIncomeEntry[]
  portfolioTransactions: Pick<PortfolioTransaction, 'id' | 'cash_offset_source_id' | 'date' | 'operation_type' | 'quantity' | 'price'>[]
  recalculate: () => Promise<void>
  // Computed data
  categoryExpenses: ReturnType<typeof buildCustomCategoryExpenses>
  categoryIncomes: ReturnType<typeof buildCustomCategoryIncomes>
  months: string[]
  days: string[]
  isSingleMonth: boolean
  monthlySummaries: ReturnType<typeof buildCustomMonthlySummaries>
  dailySummaries: ReturnType<typeof buildCustomDailySummaries>
  monthlyCategoryExpenses: ReturnType<typeof buildCustomMonthlyCategoryExpenses>
  dailyCategoryExpenses: ReturnType<typeof buildCustomDailyCategoryExpenses>
  monthlyIncomeByCategory: ReturnType<typeof buildCustomMonthlyIncomeByCategory>
  dailyIncomeByCategory: ReturnType<typeof buildCustomDailyIncomeByCategory>
  cumulativeBalanceData: ReturnType<typeof buildCustomCumulativeBalance>
  expenseTrendSeries: TrendSeriesMeta[]
  expenseTrendData: Array<Record<string, string | number>>
  expenseTrendVisibleData: Array<Record<string, string | number>>
  incomeTrendSeries: TrendSeriesMeta[]
  incomeTrendData: Array<Record<string, string | number>>
  incomeTrendVisibleData: Array<Record<string, string | number>>
  pieExpenses: Array<{ categoryId: string; name: string; value: number; baseValue: number; detailType: 'expense'; detailPeriod: 'month' | 'year'; color: string; iconName?: string }>
  pieIncomes: Array<{ categoryId: string; name: string; value: number; baseValue: number; detailType: 'income'; detailPeriod: 'month' | 'year'; color: string; iconName?: string }>
  piePaymentMethods: ReturnType<typeof buildPaymentMethodsBreakdown>
  weekdayExpenseData: ReturnType<typeof buildCustomWeekdayData>
  summary: ReturnType<typeof buildCustomConsolidatedSummary> | null
  dailyConsolidatedData: ReturnType<typeof buildCustomDailyConsolidated>
  quickData: Array<{ month: string; Rendas: number; Despesas: number; Investimentos: number }>
  baseExpenseTotals: Map<string, number>
  baseIncomeTotals: Map<string, number>
  pendingInfo: { payables: number; receivables: number; balanceProj: number; count: number }
}

export function useReportCustomPeriod(
  debts: Debt[],
  creditCards: CreditCard[],
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
  categories: { id: string; name: string; color?: string }[],
  incomeCategories: { id: string; name: string; color?: string }[],
  getExpenseColor: (categoryId: string, fallback: string) => string,
  getIncomeColor: (categoryId: string, fallback: string) => string,
): CustomPeriodData {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [expenses, setExpenses] = useState<DetailExpenseEntry[]>([])
  const [incomes, setIncomes] = useState<DetailIncomeEntry[]>([])
  const [portfolioTransactions, setPortfolioTransactions] = useState<
    Pick<PortfolioTransaction, 'id' | 'cash_offset_source_id' | 'date' | 'operation_type' | 'quantity' | 'price'>[]
  >([])

  // Initialize dates with current month
  useEffect(() => {
    if (!startDate || !endDate) {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate()
      setStartDate(`${yyyy}-${mm}-01`)
      setEndDate(`${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`)
    }
  }, [startDate, endDate])

  const loadData = useCallback(async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const [expensesRes, incomesRes] = await Promise.all([
        supabase
          .from('expenses')
          .select(`id, amount, report_weight, category_id, date, description, payment_method, credit_card_id, category:categories(id, name, color)`)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('incomes')
          .select(`id, amount, report_weight, income_category_id, date, description, income_category:income_categories(id, name, color)`)
          .gte('date', startDate)
          .lte('date', endDate),
      ])

      let transactions: Pick<PortfolioTransaction, 'id' | 'cash_offset_source_id' | 'date' | 'operation_type' | 'quantity' | 'price'>[] = []
      if (user) {
        const { data: portfolio } = await supabase
          .from('portfolios')
          .select('id')
          .eq('client_id', user.id)
          .maybeSingle()
        if (portfolio) {
          const { data: txs } = await supabase
            .from('portfolio_transactions')
            .select('id, cash_offset_source_id, date, operation_type, quantity, price')
            .eq('portfolio_id', portfolio.id)
            .gte('date', startDate)
            .lte('date', endDate)
          if (txs) {
            const offsetIds = new Set(txs.map(t => t.cash_offset_source_id).filter((id): id is string => !!id))
            transactions = txs.filter(t => !t.cash_offset_source_id && !offsetIds.has(t.id))
          }
        }
      }

      const mappedExpenses: DetailExpenseEntry[] = (expensesRes.data || []).map((e: Record<string, unknown>) => {
        const cat = Array.isArray(e.category) ? (e.category as Array<Record<string, unknown>>)[0] : (e.category as Record<string, unknown> | null)
        return {
          id: e.id as string,
          amount: e.amount as number,
          report_weight: e.report_weight as number | null,
          category_id: e.category_id as string,
          date: e.date as string,
          description: e.description as string | null,
          payment_method: e.payment_method as string | null,
          credit_card_id: e.credit_card_id as string | null,
          category: cat ? { id: cat.id as string, name: cat.name as string, color: cat.color as string } : null,
        }
      })

      const mappedIncomes: DetailIncomeEntry[] = (incomesRes.data || []).map((i: Record<string, unknown>) => {
        const cat = Array.isArray(i.income_category) ? (i.income_category as Array<Record<string, unknown>>)[0] : (i.income_category as Record<string, unknown> | null)
        return {
          id: i.id as string,
          amount: i.amount as number,
          report_weight: i.report_weight as number | null,
          income_category_id: i.income_category_id as string,
          date: i.date as string,
          description: i.description as string | null,
          income_category: cat ? { id: cat.id as string, name: cat.name as string, color: cat.color as string } : null,
        }
      })

      setExpenses(mappedExpenses)
      setIncomes(mappedIncomes)
      setPortfolioTransactions(transactions)
    } catch (err) {
      logger.error('Erro ao carregar dados customizados:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  // Auto-load on date change
  useEffect(() => {
    if (startDate && endDate) {
      void loadData()
    }
  }, [startDate, endDate, loadData])

  // Listener for local data changes (e.g., offline queue mutations)
  useEffect(() => {
    const onDataChanged = () => {
      if (startDate && endDate) {
        void loadData()
      }
    }
    window.addEventListener('local-data-changed', onDataChanged)
    return () => window.removeEventListener('local-data-changed', onDataChanged)
  }, [startDate, endDate, loadData])

  // Computed data
  const categoryExpenses = useMemo(() => buildCustomCategoryExpenses(expenses, getAmountByMode), [expenses, getAmountByMode])
  const categoryIncomes = useMemo(() => buildCustomCategoryIncomes(incomes, getAmountByMode), [incomes, getAmountByMode])

  const months = useMemo(() => generateMonthsRange(startDate, endDate), [startDate, endDate])
  const days = useMemo(() => generateDaysRange(startDate, endDate), [startDate, endDate])
  const isSingleMonth = useMemo(() => months.length <= 1, [months])

  const monthlySummaries = useMemo(
    () => buildCustomMonthlySummaries(months, expenses, incomes, portfolioTransactions, debts, startDate, endDate, getAmountByMode),
    [months, expenses, incomes, portfolioTransactions, debts, startDate, endDate, getAmountByMode],
  )
  const dailySummaries = useMemo(
    () => buildCustomDailySummaries(days, expenses, incomes, portfolioTransactions, debts, getAmountByMode),
    [days, expenses, incomes, portfolioTransactions, debts, getAmountByMode],
  )
  const monthlyCategoryExpenses = useMemo(
    () => buildCustomMonthlyCategoryExpenses(months, expenses, startDate, endDate, getAmountByMode),
    [months, expenses, startDate, endDate, getAmountByMode],
  )
  const dailyCategoryExpenses = useMemo(
    () => buildCustomDailyCategoryExpenses(days, expenses, getAmountByMode),
    [days, expenses, getAmountByMode],
  )
  const monthlyIncomeByCategory = useMemo(
    () => buildCustomMonthlyIncomeByCategory(months, incomes, startDate, endDate, getAmountByMode),
    [months, incomes, startDate, endDate, getAmountByMode],
  )
  const dailyIncomeByCategory = useMemo(
    () => buildCustomDailyIncomeByCategory(days, incomes, getAmountByMode),
    [days, incomes, getAmountByMode],
  )
  const cumulativeBalanceData = useMemo(
    () => buildCustomCumulativeBalance(isSingleMonth, dailySummaries, monthlySummaries),
    [isSingleMonth, dailySummaries, monthlySummaries],
  )

  const expenseTrendSeries = useMemo<TrendSeriesMeta[]>(() =>
    [...categoryExpenses].sort((a, b) => b.total - a.total).map(c => ({
      key: c.category_id,
      name: c.category_name,
      color: getExpenseColor(c.category_id, c.color),
    })),
    [categoryExpenses, getExpenseColor],
  )

  const expenseTrendData = useMemo(
    () => buildCustomTrendData(isSingleMonth, dailySummaries, monthlySummaries, dailyCategoryExpenses, monthlyCategoryExpenses, expenseTrendSeries, (item) => item.category_id),
    [isSingleMonth, dailySummaries, monthlySummaries, dailyCategoryExpenses, monthlyCategoryExpenses, expenseTrendSeries],
  )

  const expenseTrendVisibleData = useMemo(() => {
    if (expenseTrendSeries.length === 0) return []
    return expenseTrendData.filter(row => expenseTrendSeries.some(s => Number(row[s.key] ?? 0) > 0))
  }, [expenseTrendData, expenseTrendSeries])

  const incomeTrendSeries = useMemo<TrendSeriesMeta[]>(() =>
    [...categoryIncomes].sort((a, b) => b.total - a.total).map(c => ({
      key: c.income_category_id,
      name: c.category_name,
      color: getIncomeColor(c.income_category_id, c.color),
    })),
    [categoryIncomes, getIncomeColor],
  )

  const incomeTrendData = useMemo(
    () => buildCustomTrendData(isSingleMonth, dailySummaries, monthlySummaries, dailyIncomeByCategory, monthlyIncomeByCategory, incomeTrendSeries, (item) => item.income_category_id),
    [isSingleMonth, dailySummaries, monthlySummaries, dailyIncomeByCategory, monthlyIncomeByCategory, incomeTrendSeries],
  )

  const incomeTrendVisibleData = useMemo(() => {
    if (incomeTrendSeries.length === 0) return []
    return incomeTrendData.filter(row => incomeTrendSeries.some(s => Number(row[s.key] ?? 0) > 0))
  }, [incomeTrendData, incomeTrendSeries])

  const baseExpenseTotals = useMemo(() => buildBaseTotalsMap(expenses, (e: DetailExpenseEntry) => e.category_id), [expenses])
  const baseIncomeTotals = useMemo(() => buildBaseTotalsMap(incomes, (i: DetailIncomeEntry) => i.income_category_id), [incomes])

  const pieExpenses = useMemo(() =>
    categoryExpenses.map(cat => {
      const matched = categories.find(c => c.id === cat.category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.category_id,
        name: cat.category_name,
        value: cat.total,
        baseValue: baseExpenseTotals.get(cat.category_id) ?? cat.total,
        detailType: 'expense' as const,
        detailPeriod: 'month' as const,
        color: getExpenseColor(cat.category_id, cat.color),
        iconName,
      }
    }),
    [categoryExpenses, categories, getExpenseColor, baseExpenseTotals],
  )

  const pieIncomes = useMemo(() =>
    categoryIncomes.map(cat => {
      const matched = incomeCategories.find(c => c.id === cat.income_category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.income_category_id,
        name: cat.category_name,
        value: cat.total,
        baseValue: baseIncomeTotals.get(cat.income_category_id) ?? cat.total,
        detailType: 'income' as const,
        detailPeriod: 'month' as const,
        color: getIncomeColor(cat.income_category_id, cat.color),
        iconName,
      }
    }),
    [categoryIncomes, incomeCategories, getIncomeColor, baseIncomeTotals],
  )

  const piePaymentMethods = useMemo(
    () => buildPaymentMethodsBreakdown(expenses, creditCards, getAmountByMode),
    [expenses, creditCards, getAmountByMode],
  )

  const weekdayExpenseData = useMemo(
    () => buildCustomWeekdayData(expenses, incomes, portfolioTransactions, getAmountByMode),
    [expenses, incomes, portfolioTransactions, getAmountByMode],
  )

  const summary = useMemo(
    () => buildCustomConsolidatedSummary(expenses, incomes, portfolioTransactions, debts, startDate, endDate, getAmountByMode),
    [expenses, incomes, portfolioTransactions, debts, startDate, endDate, getAmountByMode],
  )

  const dailyConsolidatedData = useMemo(
    () => buildCustomDailyConsolidated(startDate, endDate, expenses, incomes, portfolioTransactions, debts, getAmountByMode),
    [expenses, incomes, portfolioTransactions, debts, startDate, endDate, getAmountByMode],
  )

  const quickData = useMemo(() =>
    summary ? [{ month: 'Período', Rendas: summary.total_income, Despesas: summary.total_expenses, Investimentos: summary.total_investments }] : [],
    [summary],
  )

  const pendingInfo = useMemo(() => {
    const p = computePeriodPendingInRange(debts, startDate, endDate)
    return { payables: p.payables, receivables: p.receivables, balanceProj: p.balanceProj, count: p.count }
  }, [debts, startDate, endDate])

  return {
    startDate, endDate, setStartDate, setEndDate,
    loading, expenses, incomes, portfolioTransactions,
    recalculate: loadData,
    categoryExpenses, categoryIncomes,
    months, days, isSingleMonth,
    monthlySummaries, dailySummaries,
    monthlyCategoryExpenses, dailyCategoryExpenses,
    monthlyIncomeByCategory, dailyIncomeByCategory,
    cumulativeBalanceData,
    expenseTrendSeries, expenseTrendData, expenseTrendVisibleData,
    incomeTrendSeries, incomeTrendData, incomeTrendVisibleData,
    pieExpenses, pieIncomes, piePaymentMethods,
    weekdayExpenseData, summary, dailyConsolidatedData, quickData,
    baseExpenseTotals, baseIncomeTotals, pendingInfo,
  }
}
