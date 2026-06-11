import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input from '@/components/Input'
import ReportsCategoryRowButton from '@/components/reports/ReportsCategoryRowButton'
import ReportsPieLegendRow, { type ReportsPieLegendItem } from '@/components/reports/ReportsPieLegendRow'
import Select from '@/components/Select'
import { PAGE_HEADERS } from '@/constants/pages'
import Loader from '@/components/Loader'
import { useReports } from '@/hooks/useReports'
import { useIncomeReports } from '@/hooks/useIncomeReports'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useIncomeCategoryExpectations } from '@/hooks/useIncomeCategoryExpectations'
import { useCreditCards } from '@/hooks/useCreditCards'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { useAppSettings } from '@/hooks/useAppSettings'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction } from '@/types'
import { portfolioInvestmentByDay } from '@/utils/portfolioMonthlyFlow'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { addMonths, clampMonthToAppStart, formatCurrency, formatDate, formatMonth, formatMonthShort, formatNumberWithTwoDecimalsBR, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { Scale, Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSearchParams } from 'react-router-dom'

import AnnualFlowChart from '@/components/reports/AnnualFlowChart'
import CumulativeBalanceChart from '@/components/reports/CumulativeBalanceChart'
import WeekdayExpenseChart from '@/components/reports/WeekdayExpenseChart'
import CategoryPieChart from '@/components/reports/CategoryPieChart'
import CategoryTrendChart from '@/components/reports/CategoryTrendChart'
import CategoryDetailMiniChart from '@/components/reports/CategoryDetailMiniChart'
import MonthCompositionChart from '@/components/reports/MonthCompositionChart'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'

type ViewMode = 'year' | 'month'
type DetailType = 'expense' | 'income' | 'payment_method' | 'credit_card'

type MonthlySummary = {
  month: string
  total_income: number
  total_expenses: number
  total_investments: number
  balance: number
}

type ExpenseCategorySummary = {
  category_id: string
  category_name: string
  total: number
  color: string
}

type IncomeCategorySummary = {
  income_category_id: string
  category_name: string
  total: number
  color: string
}

type PieDatum = {
  name: string
  value: number
  color: string
  categoryId?: string
  detailType?: DetailType
  detailPeriod?: 'month' | 'year'
}

type TrendSeriesMeta = {
  key: string
  name: string
  color: string
}

type DetailModalState = {
  isOpen: boolean
  type: DetailType
  categoryId: string
  categoryName: string
  period: 'month' | 'year'
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit_card: 'Cartão de Crédito',
  pix: 'Pix',
  transfer: 'Transferência',
  other: 'Outros',
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: 'var(--payment-method-cash)',
  debit: 'var(--payment-method-debit)',
  credit_card: 'var(--payment-method-credit-card)',
  pix: 'var(--payment-method-pix)',
  transfer: 'var(--payment-method-transfer)',
  other: 'var(--payment-method-other)',
}

const DETAIL_ITEMS_STEP = 8

type DetailExpenseEntry = {
  id: string
  amount: number
  report_weight?: number | null
  category_id: string
  date: string
  description?: string | null
  category?: {
    name?: string | null
  } | null
}

type DetailIncomeEntry = {
  id: string
  amount: number
  report_weight?: number | null
  income_category_id: string
  date: string
  description?: string | null
  income_category?: {
    name?: string | null
  } | null
}



export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentYear = new Date().getFullYear()
  const currentMonth = getCurrentMonthString()

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loadingAvailablePeriods, setLoadingAvailablePeriods] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    isOpen: false,
    type: 'expense',
    categoryId: '',
    categoryName: '',
    period: 'month',
  })
  const [detailSearch, setDetailSearch] = useState('')
  const [detailVisibleCount, setDetailVisibleCount] = useState(DETAIL_ITEMS_STEP)
  const [yearDetailLoading, setYearDetailLoading] = useState(false)
  const [yearExpenseItems, setYearExpenseItems] = useState<DetailExpenseEntry[]>([])
  const [previousYearExpenseItems, setPreviousYearExpenseItems] = useState<DetailExpenseEntry[]>([])
  const [yearIncomeItems, setYearIncomeItems] = useState<DetailIncomeEntry[]>([])
  const [previousYearIncomeItems, setPreviousYearIncomeItems] = useState<DetailIncomeEntry[]>([])
  const [hiddenExpenseSeries, setHiddenExpenseSeries] = useState<string[]>([])
  const [hiddenIncomeSeries, setHiddenIncomeSeries] = useState<string[]>([])
  const [hiddenAnnualFlowSeries, setHiddenAnnualFlowSeries] = useState<string[]>([])
  const [hiddenDailyConsolidatedSeries, setHiddenDailyConsolidatedSeries] = useState<string[]>([])
  const [hiddenMonthCompositionSeries, setHiddenMonthCompositionSeries] = useState<string[]>([])
  const [evolutionType, setEvolutionType] = useState<'expense' | 'income'>('expense')
  const [drilldownSectionType, setDrilldownSectionType] = useState<'expense' | 'income'>('expense')
  const {
    dashboardReportsWeightsEnabled,
    setDashboardReportsWeightsEnabled,
  } = useAppSettings()

  useEffect(() => {
    let canceled = false

    const loadAvailablePeriods = async () => {
      setLoadingAvailablePeriods(true)

      const [expenseDatesRes, incomeDatesRes, transactionDatesRes] = await Promise.all([
        supabase.from('expenses').select('date'),
        supabase.from('incomes').select('date'),
        supabase.from('portfolio_transactions').select('date'),
      ])

      if (canceled) return

      const monthSet = new Set<string>()

        ; (expenseDatesRes.data ?? []).forEach((row: { date?: string | null }) => {
          const month = row.date?.slice(0, 7)
          if (month && /^\d{4}-\d{2}$/.test(month)) {
            monthSet.add(month)
          }
        })

        ; (incomeDatesRes.data ?? []).forEach((row: { date?: string | null }) => {
          const month = row.date?.slice(0, 7)
          if (month && /^\d{4}-\d{2}$/.test(month)) {
            monthSet.add(month)
          }
        })

        ; (transactionDatesRes.data ?? []).forEach((row: { date?: string | null }) => {
          const month = row.date?.slice(0, 7)
          if (month && /^\d{4}-\d{2}$/.test(month)) {
            monthSet.add(month)
          }
        })

      const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a))
      setAvailableMonths(sortedMonths)
      setLoadingAvailablePeriods(false)
    }

    loadAvailablePeriods()

    return () => {
      canceled = true
    }
  }, [])

  const availableYears = useMemo(
    () => Array.from(new Set(availableMonths.map((month) => Number(month.slice(0, 4))))).sort((a, b) => b - a),
    [availableMonths]
  )

  const monthsForSelectedYear = useMemo(
    () => availableMonths.filter((month) => month.startsWith(`${selectedYear}-`)),
    [availableMonths, selectedYear]
  )

  useEffect(() => {
    if (availableYears.length === 0) {
      return
    }

    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  useEffect(() => {
    if (availableYears.length === 0) {
      return
    }

    if (monthsForSelectedYear.length === 0) {
      const fallbackYear = availableYears[0]
      const fallbackMonths = availableMonths.filter((month) => month.startsWith(`${fallbackYear}-`))

      if (fallbackMonths.length > 0) {
        setSelectedYear(fallbackYear)
        if (selectedMonth !== fallbackMonths[0]) {
          setSelectedMonth(fallbackMonths[0])
        }
      }
      return
    }

    if (!monthsForSelectedYear.includes(selectedMonth)) {
      setSelectedMonth(monthsForSelectedYear[0])
    }
  }, [availableMonths, availableYears, monthsForSelectedYear, selectedMonth])

  const { colorPalette } = usePaletteColors()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const includeReportWeights = dashboardReportsWeightsEnabled
  const previousMonth = useMemo(() => addMonths(selectedMonth, -1), [selectedMonth])
  const { monthlySummaries, categoryExpenses, monthlyCategoryExpenses, annualExpenses, loading } = useReports(selectedYear, includeReportWeights)
  const { incomeByCategory, monthlyIncomeByCategory, loading: loadingIncomes } = useIncomeReports(selectedYear, includeReportWeights)
  const { expenses: monthExpenses, loading: loadingMonthExpenses } = useExpenses(selectedMonth)
  const { creditCards } = useCreditCards()
  const { incomes: monthIncomes, loading: loadingMonthIncomes } = useIncomes(selectedMonth)
  const { expenses: previousMonthExpenses, loading: loadingPreviousMonthExpenses } = useExpenses(previousMonth)
  const { incomes: previousMonthIncomes, loading: loadingPreviousMonthIncomes } = useIncomes(previousMonth)
  const { isOnline } = useNetworkStatus()
  const [portfolioTransactions, setPortfolioTransactions] = useState<
    Pick<PortfolioTransaction, 'date' | 'operation_type' | 'quantity' | 'price'>[]
  >([])

  useEffect(() => {
    let canceled = false

    const loadPortfolioTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!canceled) setPortfolioTransactions([])
        return
      }

      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle()

      if (!portfolio) {
        if (!canceled) setPortfolioTransactions([])
        return
      }

      const [year, month] = selectedMonth.split('-').map(Number)
      const daysInMonth = new Date(year, month, 0).getDate()
      const rangeEnd = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`

      const { data } = await supabase
        .from('portfolio_transactions')
        .select('date, operation_type, quantity, price')
        .eq('portfolio_id', portfolio.id)
        .gte('date', `${selectedMonth}-01`)
        .lte('date', rangeEnd)

      if (!canceled) {
        setPortfolioTransactions(data || [])
      }
    }

    if (isOnline) {
      void loadPortfolioTransactions()
    } else {
      setPortfolioTransactions([])
    }

    const onDataChanged = () => {
      if (isOnline) void loadPortfolioTransactions()
    }
    window.addEventListener('local-data-changed', onDataChanged)
    return () => {
      canceled = true
      window.removeEventListener('local-data-changed', onDataChanged)
    }
  }, [selectedMonth, isOnline])

  const { limits: monthExpenseLimits } = useExpenseCategoryLimits(selectedMonth)
  const { limits: previousMonthExpenseLimits } = useExpenseCategoryLimits(previousMonth)
  const { expectations: monthIncomeExpectations } = useIncomeCategoryExpectations(selectedMonth)
  const { expectations: previousMonthIncomeExpectations } = useIncomeCategoryExpectations(previousMonth)

  const expenseCategoryIdToColor = useMemo(() => {
    const assigned = assignUniquePaletteColors(categories, colorPalette)
    const map: Record<string, string> = {}
    categories.forEach((c, i) => {
      if (c?.id) map[c.id] = assigned[i] ?? getCategoryColorForPalette(c.color, colorPalette)
    })
    return map
  }, [categories, colorPalette])

  const incomeCategoryIdToColor = useMemo(() => {
    const assigned = assignUniquePaletteColors(incomeCategories, colorPalette)
    const map: Record<string, string> = {}
    incomeCategories.forEach((c, i) => {
      if (c?.id) map[c.id] = assigned[i] ?? getCategoryColorForPalette(c.color, colorPalette)
    })
    return map
  }, [incomeCategories, colorPalette])

  const getExpenseColor = useCallback(
    (categoryId: string, fallback: string) => expenseCategoryIdToColor[categoryId] ?? fallback,
    [expenseCategoryIdToColor]
  )
  const getIncomeColor = useCallback(
    (categoryId: string, fallback: string) => incomeCategoryIdToColor[categoryId] ?? fallback,
    [incomeCategoryIdToColor]
  )

  const getAmountByMode = useCallback(
    (entry: { amount: number; report_weight?: number | null }) =>
      includeReportWeights
        ? getWeightedReportAmount(entry.amount, entry.report_weight)
        : entry.amount,
    [includeReportWeights],
  )

  const monthlyData = useMemo(
    () =>
      monthlySummaries.map((s: MonthlySummary) => ({
        month: formatMonthShort(s.month),
        Rendas: s.total_income,
        Despesas: s.total_expenses,
        Investimentos: s.total_investments,
        Saldo: s.balance,
      })),
    [monthlySummaries]
  )

  const annualPieExpenses = useMemo(
    () =>
      categoryExpenses.map((cat: ExpenseCategorySummary) => ({
        name: cat.category_name,
        value: cat.total,
        color: getExpenseColor(cat.category_id, cat.color),
        categoryId: cat.category_id,
        detailType: 'expense' as DetailType,
        detailPeriod: 'year' as const,
      })),
    [categoryExpenses, getExpenseColor]
  )

  const annualPieIncomes = useMemo(
    () =>
      incomeByCategory.map((cat) => ({
        name: cat.category_name,
        value: cat.total,
        color: getIncomeColor(cat.income_category_id, cat.color),
        categoryId: cat.income_category_id,
        detailType: 'income' as DetailType,
        detailPeriod: 'year' as const,
      })),
    [incomeByCategory, getIncomeColor]
  )

  const annualPiePaymentMethods = useMemo(() => {
    const methodsMap = new Map<string, number>()
    const cardsMap = new Map<string, number>()

    annualExpenses.forEach((exp) => {
      const amount = getAmountByMode(exp)
      if (exp.payment_method === 'credit_card' && exp.credit_card_id) {
        cardsMap.set(exp.credit_card_id, (cardsMap.get(exp.credit_card_id) || 0) + amount)
      } else {
        const method = exp.payment_method || 'other'
        methodsMap.set(method, (methodsMap.get(method) || 0) + amount)
      }
    })

    const results: PieDatum[] = []

    Array.from(methodsMap.entries())
      .filter(([method]) => method !== 'credit_card')
      .forEach(([method, total]) => {
        results.push({
          name: PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.other,
          value: total,
          color: PAYMENT_METHOD_COLORS[method] || PAYMENT_METHOD_COLORS.other,
          categoryId: method,
          detailType: 'payment_method' as const,
          detailPeriod: 'year' as const,
        })
      })

    Array.from(cardsMap.entries()).forEach(([cardId, total]) => {
      const card = creditCards.find((c) => c.id === cardId)
      results.push({
        name: card?.name ? `Cartão ${card.name}` : 'Cartão Desconhecido',
        value: total,
        color: card?.color || 'var(--payment-method-credit-card)',
        categoryId: cardId,
        detailType: 'credit_card' as const,
        detailPeriod: 'year' as const,
      })
    })

    return results
  }, [annualExpenses, creditCards, getAmountByMode])

  const cumulativeBalanceData = useMemo(() => {
    let cumulative = 0
    return monthlySummaries.map((item: MonthlySummary) => {
      cumulative += item.balance
      return {
        month: formatMonthShort(item.month),
        SaldoAcumulado: cumulative,
      }
    })
  }, [monthlySummaries])

  const annualTotals = useMemo(() => {
    return monthlySummaries.reduce(
      (acc: { income: number; expenses: number; investments: number; balance: number }, month: MonthlySummary) => ({
        income: acc.income + month.total_income,
        expenses: acc.expenses + month.total_expenses,
        investments: acc.investments + month.total_investments,
        balance: acc.balance + month.balance,
      }),
      { income: 0, expenses: 0, investments: 0, balance: 0 }
    )
  }, [monthlySummaries])

  const annualExpenseTrendSeries = useMemo<TrendSeriesMeta[]>(() => {
    return [...categoryExpenses]
      .sort((a, b) => b.total - a.total)
      .map((category) => ({
        key: category.category_id,
        name: category.category_name,
        color: getExpenseColor(category.category_id, category.color),
      }))
  }, [categoryExpenses, getExpenseColor])

  const annualIncomeTrendSeries = useMemo<TrendSeriesMeta[]>(() => {
    return [...incomeByCategory]
      .sort((a, b) => b.total - a.total)
      .map((category) => ({
        key: category.income_category_id,
        name: category.category_name,
        color: getIncomeColor(category.income_category_id, category.color),
      }))
  }, [incomeByCategory, getIncomeColor])

  useEffect(() => {
    const validKeys = new Set(annualExpenseTrendSeries.map((series) => series.key))
    setHiddenExpenseSeries((prev) => prev.filter((key) => validKeys.has(key)))
  }, [annualExpenseTrendSeries])

  useEffect(() => {
    const validKeys = new Set(annualIncomeTrendSeries.map((series) => series.key))
    setHiddenIncomeSeries((prev) => prev.filter((key) => validKeys.has(key)))
  }, [annualIncomeTrendSeries])

  const annualExpenseTrendData = useMemo(() => {
    return monthlySummaries.map((summary) => {
      const row: Record<string, string | number> = {
        month: formatMonthShort(summary.month),
      }

      const monthCategories = monthlyCategoryExpenses[summary.month] ?? []
      annualExpenseTrendSeries.forEach((series) => {
        const match = monthCategories.find((item) => item.category_id === series.key)
        row[series.key] = match?.total ?? 0
      })

      return row
    })
  }, [monthlySummaries, monthlyCategoryExpenses, annualExpenseTrendSeries])

  const annualExpenseTrendVisibleData = useMemo(() => {
    if (annualExpenseTrendSeries.length === 0) {
      return [] as Array<Record<string, string | number>>
    }

    return annualExpenseTrendData.filter((row) =>
      annualExpenseTrendSeries.some((series) => Number(row[series.key] ?? 0) > 0)
    )
  }, [annualExpenseTrendData, annualExpenseTrendSeries])

  const annualIncomeTrendData = useMemo(() => {
    return monthlySummaries.map((summary) => {
      const row: Record<string, string | number> = {
        month: formatMonthShort(summary.month),
      }

      const monthCategories = monthlyIncomeByCategory[summary.month] ?? []
      annualIncomeTrendSeries.forEach((series) => {
        const match = monthCategories.find((item) => item.income_category_id === series.key)
        row[series.key] = match?.total ?? 0
      })

      return row
    })
  }, [monthlySummaries, monthlyIncomeByCategory, annualIncomeTrendSeries])

  const annualIncomeTrendVisibleData = useMemo(() => {
    if (annualIncomeTrendSeries.length === 0) {
      return [] as Array<Record<string, string | number>>
    }

    return annualIncomeTrendData.filter((row) =>
      annualIncomeTrendSeries.some((series) => Number(row[series.key] ?? 0) > 0)
    )
  }, [annualIncomeTrendData, annualIncomeTrendSeries])

  const monthSummary = monthlySummaries.find((s) => s.month === selectedMonth)
  const monthExpenseCategories = useMemo(
    () => (selectedMonth ? (monthlyCategoryExpenses[selectedMonth] ?? []) : []),
    [selectedMonth, monthlyCategoryExpenses]
  )
  const monthIncomeCategories = useMemo(
    () => (selectedMonth ? (monthlyIncomeByCategory[selectedMonth] ?? []) : []),
    [selectedMonth, monthlyIncomeByCategory]
  )
  const monthPieExpenses = monthExpenseCategories.map((cat: ExpenseCategorySummary) => ({
    categoryId: cat.category_id,
    name: cat.category_name,
    value: cat.total,
    detailType: 'expense' as DetailType,
    detailPeriod: 'month' as const,
    color: getExpenseColor(cat.category_id, cat.color),
  }))
  const monthPieIncomes = monthIncomeCategories.map((cat: IncomeCategorySummary) => ({
    categoryId: cat.income_category_id,
    name: cat.category_name,
    value: cat.total,
    detailType: 'income' as DetailType,
    detailPeriod: 'month' as const,
    color: getIncomeColor(cat.income_category_id, cat.color),
  }))

  const monthPiePaymentMethods = useMemo(() => {
    const methodsMap = new Map<string, number>()
    const cardsMap = new Map<string, number>()

    monthExpenses.forEach((exp) => {
      const amount = getAmountByMode(exp)
      if (exp.payment_method === 'credit_card' && exp.credit_card_id) {
        cardsMap.set(exp.credit_card_id, (cardsMap.get(exp.credit_card_id) || 0) + amount)
      } else {
        const method = exp.payment_method || 'other'
        methodsMap.set(method, (methodsMap.get(method) || 0) + amount)
      }
    })

    const results: PieDatum[] = []

    Array.from(methodsMap.entries())
      .filter(([method]) => method !== 'credit_card')
      .forEach(([method, total]) => {
        results.push({
          name: PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.other,
          value: total,
          color: PAYMENT_METHOD_COLORS[method] || PAYMENT_METHOD_COLORS.other,
          categoryId: method,
          detailType: 'payment_method' as const,
          detailPeriod: 'month' as const,
        })
      })

    Array.from(cardsMap.entries()).forEach(([cardId, total]) => {
      const card = creditCards.find((c) => c.id === cardId)
      results.push({
        name: card?.name ? `Cartão ${card.name}` : 'Cartão Desconhecido',
        value: total,
        color: card?.color || 'var(--payment-method-credit-card)',
        categoryId: cardId,
        detailType: 'credit_card' as const,
        detailPeriod: 'month' as const,
      })
    })

    return results
  }, [monthExpenses, creditCards, getAmountByMode])

  const monthQuickData = useMemo(() => {
    if (!monthSummary) {
      return []
    }

    return [
      {
        month: formatMonthShort(selectedMonth),
        Rendas: monthSummary.total_income,
        Despesas: monthSummary.total_expenses,
        Investimentos: monthSummary.total_investments,
      },
    ]
  }, [monthSummary, selectedMonth])


  const detailItems = useMemo(() => {
    if (!detailModal.isOpen) {
      return [] as Array<{ id: string; description: string; date: string; amount: number }>
    }

    if (detailModal.type === 'expense') {
      const items = detailModal.period === 'year' ? yearExpenseItems : monthExpenses
      return items
        .filter((item) => item.category_id === detailModal.categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Despesa',
          date: item.date,
          amount: getAmountByMode(item),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (detailModal.type === 'income') {
      const items = detailModal.period === 'year' ? yearIncomeItems : monthIncomes
      return items
        .filter((item) => item.income_category_id === detailModal.categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.income_category?.name || 'Renda',
          date: item.date,
          amount: getAmountByMode(item),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (detailModal.type === 'payment_method') {
      const items = detailModal.period === 'year' ? annualExpenses : monthExpenses
      return items
        .filter((item) => (item.payment_method || 'other') === detailModal.categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Despesa',
          date: item.date,
          amount: getAmountByMode(item),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (detailModal.type === 'credit_card') {
      const items = detailModal.period === 'year' ? annualExpenses : monthExpenses
      return items
        .filter((item) => item.credit_card_id === detailModal.categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Despesa',
          date: item.date,
          amount: getAmountByMode(item),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    return []
  }, [detailModal, monthExpenses, monthIncomes, yearExpenseItems, yearIncomeItems, annualExpenses, getAmountByMode])

  const detailCurrentTotal = useMemo(
    () => detailItems.reduce((sum, item) => sum + item.amount, 0),
    [detailItems]
  )

  const filteredDetailItems = useMemo(() => {
    const search = detailSearch.trim().toLowerCase()
    if (!search) {
      return detailItems
    }

    return detailItems.filter((item) => item.description.toLowerCase().includes(search))
  }, [detailItems, detailSearch])

  const visibleDetailItems = useMemo(
    () => filteredDetailItems.slice(0, detailVisibleCount),
    [filteredDetailItems, detailVisibleCount]
  )

  const hasMoreDetailItems = filteredDetailItems.length > visibleDetailItems.length

  const detailPreviousTotal = useMemo(() => {
    if (!detailModal.isOpen) {
      return 0
    }

    if (detailModal.period === 'year' && detailModal.type === 'expense') {
      return previousYearExpenseItems
        .filter((item) => item.category_id === detailModal.categoryId)
        .reduce((sum, item) => sum + getAmountByMode(item), 0)
    }

    if (detailModal.period === 'year' && detailModal.type === 'income') {
      return previousYearIncomeItems
        .filter((item) => item.income_category_id === detailModal.categoryId)
        .reduce((sum, item) => sum + getAmountByMode(item), 0)
    }

    if (detailModal.type === 'expense') {
      return previousMonthExpenses
        .filter((item) => item.category_id === detailModal.categoryId)
        .reduce((sum, item) => sum + getAmountByMode(item), 0)
    }

    return previousMonthIncomes
      .filter((item) => item.income_category_id === detailModal.categoryId)
      .reduce((sum, item) => sum + getAmountByMode(item), 0)
  }, [detailModal, previousMonthExpenses, previousMonthIncomes, previousYearExpenseItems, previousYearIncomeItems, getAmountByMode])

  const detailDifference = detailCurrentTotal - detailPreviousTotal
  const detailDifferencePct = detailPreviousTotal > 0
    ? (detailDifference / detailPreviousTotal) * 100
    : null

  const detailCategoryColor = useMemo(() => {
    if (!detailModal.isOpen) return 'var(--color-primary)'
    if (detailModal.type === 'expense') {
      return getExpenseColor(detailModal.categoryId, 'var(--color-primary)')
    }
    if (detailModal.type === 'income') {
      return getIncomeColor(detailModal.categoryId, 'var(--color-primary)')
    }
    if (detailModal.type === 'payment_method') {
      return PAYMENT_METHOD_COLORS[detailModal.categoryId] || 'var(--color-primary)'
    }
    if (detailModal.type === 'credit_card') {
      return creditCards.find((c) => c.id === detailModal.categoryId)?.color || 'var(--color-primary)'
    }
    return 'var(--color-primary)'
  }, [detailModal, getExpenseColor, getIncomeColor, creditCards])

  const monthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    monthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [monthExpenseLimits])

  const previousMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [previousMonthExpenseLimits])

  const monthIncomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()
    monthIncomeExpectations.forEach((item) => map.set(item.income_category_id, item.expectation_amount))
    return map
  }, [monthIncomeExpectations])

  const previousMonthIncomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthIncomeExpectations.forEach((item) => map.set(item.income_category_id, item.expectation_amount))
    return map
  }, [previousMonthIncomeExpectations])

  const detailMonthlyGoal = useMemo(() => {
    if (detailModal.period !== 'month' || !detailModal.categoryId) return null

    if (detailModal.type === 'expense') {
      const currentValue = monthExpenseLimitMap.get(detailModal.categoryId)
      const fallbackValue = previousMonthExpenseLimitMap.get(detailModal.categoryId)
      const limitAmount = currentValue !== undefined ? currentValue : fallbackValue

      if (limitAmount === undefined || limitAmount === null) {
        return {
          label: 'Limite',
          configured: false,
        }
      }

      const exceededAmount = Math.max(detailCurrentTotal - limitAmount, 0)
      const remainingAmount = Math.max(limitAmount - detailCurrentTotal, 0)

      return {
        label: 'Limite',
        configured: true,
        targetAmount: limitAmount,
        currentAmount: detailCurrentTotal,
        differenceAmount: exceededAmount > 0 ? exceededAmount : remainingAmount,
        isExceeded: exceededAmount > 0,
      }
    }

    const currentValue = monthIncomeExpectationMap.get(detailModal.categoryId)
    const fallbackValue = previousMonthIncomeExpectationMap.get(detailModal.categoryId)
    const expectationAmount = currentValue !== undefined ? currentValue : fallbackValue

    if (expectationAmount === undefined || expectationAmount === null) {
      return {
        label: 'Expectativa',
        configured: false,
      }
    }

    const exceededAmount = Math.max(detailCurrentTotal - expectationAmount, 0)
    const remainingAmount = Math.max(expectationAmount - detailCurrentTotal, 0)

    return {
      label: 'Expectativa',
      configured: true,
      targetAmount: expectationAmount,
      currentAmount: detailCurrentTotal,
      differenceAmount: exceededAmount > 0 ? exceededAmount : remainingAmount,
      isExceeded: exceededAmount > 0,
    }
  }, [
    detailModal.period,
    detailModal.type,
    detailModal.categoryId,
    detailCurrentTotal,
    monthExpenseLimitMap,
    previousMonthExpenseLimitMap,
    monthIncomeExpectationMap,
    previousMonthIncomeExpectationMap,
  ])

  useEffect(() => {
    setDetailVisibleCount(DETAIL_ITEMS_STEP)
  }, [detailModal.isOpen, detailModal.categoryId, detailModal.type, detailModal.period, detailSearch])

  const openDetailModal = (
    type: DetailType,
    categoryId: string,
    categoryName: string,
    period: 'month' | 'year' = 'month'
  ) => {
    setDetailSearch('')
    setDetailModal({
      isOpen: true,
      type,
      categoryId,
      categoryName,
      period,
    })
  }

  useEffect(() => {
    const yearStart = `${selectedYear}-01-01`
    const yearEnd = `${selectedYear}-12-31`
    const prevYear = selectedYear - 1
    const prevYearStart = `${prevYear}-01-01`
    const prevYearEnd = `${prevYear}-12-31`
    let canceled = false

    const loadYearDetails = async () => {
      setYearDetailLoading(true)

      const [expenseCurrentRes, expensePreviousRes, incomeCurrentRes, incomePreviousRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('id, amount, report_weight, category_id, date, description, category:categories(name)')
          .gte('date', yearStart)
          .lte('date', yearEnd),
        supabase
          .from('expenses')
          .select('id, amount, report_weight, category_id, date, description, category:categories(name)')
          .gte('date', prevYearStart)
          .lte('date', prevYearEnd),
        supabase
          .from('incomes')
          .select('id, amount, report_weight, income_category_id, date, description, income_category:income_categories(name)')
          .gte('date', yearStart)
          .lte('date', yearEnd),
        supabase
          .from('incomes')
          .select('id, amount, report_weight, income_category_id, date, description, income_category:income_categories(name)')
          .gte('date', prevYearStart)
          .lte('date', prevYearEnd),
      ])

      if (canceled) return

      if (!expenseCurrentRes.error) {
        setYearExpenseItems((expenseCurrentRes.data ?? []) as DetailExpenseEntry[])
      }

      if (!expensePreviousRes.error) {
        setPreviousYearExpenseItems((expensePreviousRes.data ?? []) as DetailExpenseEntry[])
      }

      if (!incomeCurrentRes.error) {
        setYearIncomeItems((incomeCurrentRes.data ?? []) as DetailIncomeEntry[])
      }

      if (!incomePreviousRes.error) {
        setPreviousYearIncomeItems((incomePreviousRes.data ?? []) as DetailIncomeEntry[])
      }

      setYearDetailLoading(false)
    }

    loadYearDetails()

    return () => {
      canceled = true
    }
  }, [selectedYear])

  useEffect(() => {
    const detailType = searchParams.get('detailType')
    const detailCategoryId = searchParams.get('detailCategoryId')
    const detailCategoryName = searchParams.get('detailCategoryName')
    const monthParam = searchParams.get('month')
    const viewParam = searchParams.get('view')

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const clampedMonth = clampMonthToAppStart(monthParam)
      setSelectedMonth(clampedMonth)
      const parsedYear = Number(clampedMonth.slice(0, 4))
      if (!Number.isNaN(parsedYear)) {
        setSelectedYear(parsedYear)
      }
    }

    if (viewParam === 'month' || viewParam === 'year') {
      setViewMode(viewParam)
    }

    if ((detailType === 'expense' || detailType === 'income') && detailCategoryId) {
      openDetailModal(detailType, detailCategoryId, detailCategoryName || 'Categoria', viewParam === 'year' ? 'year' : 'month')

      const next = new URLSearchParams(searchParams)
      next.delete('detailType')
      next.delete('detailCategoryId')
      next.delete('detailCategoryName')
      next.delete('view')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const toggleExpenseSeries = (key: string) => {
    setHiddenExpenseSeries((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  const toggleIncomeSeries = (key: string) => {
    setHiddenIncomeSeries((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  const toggleAnnualFlowSeries = (key: string) => {
    setHiddenAnnualFlowSeries((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  const toggleDailyConsolidatedSeries = (key: string) => {
    setHiddenDailyConsolidatedSeries((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  const toggleMonthCompositionSeries = (key: string) => {
    setHiddenMonthCompositionSeries((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }



  const dailyConsolidatedData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)

    if (!year || !month) {
      return []
    }

    const daysInMonth = new Date(year, month, 0).getDate()
    const totalsByDay = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      label: String(index + 1).padStart(2, '0'),
      Rendas: 0,
      Despesas: 0,
      Investimentos: 0,
    }))

    monthExpenses.forEach((expense) => {
      if (!expense.date?.startsWith(selectedMonth)) {
        return
      }

      const day = Number(expense.date.slice(8, 10))
      if (day >= 1 && day <= daysInMonth) {
        totalsByDay[day - 1].Despesas += getAmountByMode(expense)
      }
    })

    monthIncomes.forEach((income) => {
      if (!income.date?.startsWith(selectedMonth)) {
        return
      }

      const day = Number(income.date.slice(8, 10))
      if (day >= 1 && day <= daysInMonth) {
        totalsByDay[day - 1].Rendas += getAmountByMode(income)
      }
    })

    const portfolioByDay = portfolioInvestmentByDay(
      portfolioTransactions,
      selectedMonth,
      daysInMonth
    )
    portfolioByDay.forEach((value, index) => {
      totalsByDay[index].Investimentos += value
    })

    return totalsByDay
  }, [
    monthExpenses,
    monthIncomes,
    portfolioTransactions,
    selectedMonth,
    getAmountByMode,
  ])

  const weekdayExpenseData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const totals = labels.map((label) => ({
      dia: label,
      Despesas: 0,
    }))

    monthExpenses.forEach((expense) => {
      if (!expense.date?.startsWith(selectedMonth)) {
        return
      }

      const localDate = new Date(`${expense.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) {
        return
      }

      const dayOfWeek = localDate.getDay()
      const mondayFirstIndex = (dayOfWeek + 6) % 7
      totals[mondayFirstIndex].Despesas += getAmountByMode(expense)
    })

    return totals
  }, [monthExpenses, selectedMonth, getAmountByMode])

  const topWeekdayExpense = useMemo(() => {
    if (weekdayExpenseData.length === 0) {
      return null
    }

    return weekdayExpenseData.reduce((highest, current) =>
      current.Despesas > highest.Despesas ? current : highest
    )
  }, [weekdayExpenseData])

  const monthExpenseTotal = useMemo(
    () => monthExpenseCategories.reduce((sum, cat) => sum + cat.total, 0),
    [monthExpenseCategories]
  )

  const monthIncomeTotal = useMemo(
    () => monthIncomeCategories.reduce((sum, cat) => sum + cat.total, 0),
    [monthIncomeCategories]
  )

  const yearMonths = useMemo(() => {
    return monthsForSelectedYear.map((monthValue) => ({
      value: monthValue,
      label: formatMonthShort(monthValue),
    }))
  }, [monthsForSelectedYear])

  const loadingState = loading || loadingIncomes || loadingMonthExpenses || loadingMonthIncomes || loadingPreviousMonthExpenses || loadingPreviousMonthIncomes || loadingAvailablePeriods
  const savingsRate = monthSummary && monthSummary.total_income > 0
    ? ((monthSummary.balance / monthSummary.total_income) * 100)
    : 0

  const renderPieCard = (title: string, data: PieDatum[]) => (
    <Card className="h-full flex flex-col chart-interactive-layer">
      <h3 className="text-lg font-semibold text-primary mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-secondary">Sem dados para exibir.</p>
      ) : (
        <>
          <CategoryPieChart
            data={data}
            onClick={(entry: PieDatum) => {
              if (entry.categoryId && entry.detailType) {
                openDetailModal(entry.detailType, entry.categoryId, entry.name, entry.detailPeriod || 'month')
              }
            }}
            outerRadius={100}
          />

          <div className="mt-4 space-y-3">
            {data
              .slice()
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map((item) => {
                const total = data.reduce((sum, current) => sum + current.value, 0)
                const legendItem: ReportsPieLegendItem = {
                  name: item.name,
                  value: item.value,
                  color: item.color,
                  categoryId: item.categoryId,
                  detailType: item.detailType,
                  detailPeriod: item.detailPeriod,
                }

                return (
                  <ReportsPieLegendRow
                    key={item.name}
                    item={legendItem}
                    total={total}
                    onOpen={(row) => {
                      if (row.categoryId && row.detailType) {
                        openDetailModal(row.detailType, row.categoryId, row.name, row.detailPeriod || 'month')
                      }
                    }}
                  />
                )
              })}
          </div>
        </>
      )}
    </Card>
  )

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.reports.title} subtitle={PAGE_HEADERS.reports.description} />

      <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
        <Card className="relative z-20 overflow-visible glass-glow-card">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">Visualização</label>
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="month" className="text-xs">Mês</TabsTrigger>
                  <TabsTrigger value="year" className="text-xs">Ano</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div>
              <Select
                label="Ano"
                value={String(selectedYear)}
                onChange={(event) => {
                  const year = parseInt(event.target.value)
                  setSelectedYear(year)
                  const monthsForYear = availableMonths.filter((month) => month.startsWith(`${year}-`))
                  if (monthsForYear.length > 0) {
                    setSelectedMonth(monthsForYear[0])
                  }
                }}
                options={
                  availableYears.length > 0
                    ? availableYears.map((year) => ({ value: String(year), label: String(year) }))
                    : [{ value: String(selectedYear), label: 'Sem dados' }]
                }
                className="w-full"
              />
            </div>

            <div>
              <Select
                label="Mês"
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value)
                  setViewMode('month')
                }}
                options={
                  yearMonths.length > 0
                    ? yearMonths
                    : [{ value: selectedMonth, label: 'Sem meses com dados' }]
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Pesos</label>
              <Button
                type="button"
                onClick={() => setDashboardReportsWeightsEnabled(!dashboardReportsWeightsEnabled)}
                variant="outline"
                fullWidth
                size="md"
                className="w-full flex items-center justify-center gap-2"
                title={dashboardReportsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
              >
                <Scale size={18} />
                <span className="hidden sm:inline">
                  {dashboardReportsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
                </span>
              </Button>
            </div>
          </div>
          <p className="text-xs text-secondary mt-3">
            {includeReportWeights ? 'Valores ajustados pelos pesos dos lançamentos' : 'Valores brutos, sem aplicação de pesos'}
          </p>
        </Card>

        {loadingState ? (
          <Loader text="Carregando..." className="py-8" />
        ) : (
          <>
            {viewMode === 'year' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  <Card className="h-full animate-stagger-item delay-50">
                    <p className="text-sm text-secondary">Rendas no ano</p>
                    <p className="text-2xl font-bold mt-2 text-income">{formatCurrency(annualTotals.income)}</p>
                  </Card>
                  <Card className="h-full animate-stagger-item delay-100">
                    <p className="text-sm text-secondary">Despesas no ano</p>
                    <p className="text-2xl font-bold mt-2 text-expense">{formatCurrency(annualTotals.expenses)}</p>
                  </Card>
                  <Card className="h-full animate-stagger-item delay-150">
                    <p className="text-sm text-secondary">Investimentos no ano</p>
                    <p className="text-2xl font-bold mt-2 text-balance">{formatCurrency(annualTotals.investments)}</p>
                  </Card>
                  <Card className="h-full animate-stagger-item delay-200">
                    <p className="text-sm text-secondary">Saldo anual</p>
                    <p className={`text-2xl font-bold mt-2 ${annualTotals.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                      {formatCurrency(annualTotals.balance)}
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-4 items-stretch">
                  <Card className="h-full flex flex-col chart-interactive-layer">
                    <h3 className="text-lg font-semibold text-primary mb-4">Fluxo mensal ({selectedYear})</h3>
                    <AnnualFlowChart
                      data={monthlyData}
                      hiddenSeries={hiddenAnnualFlowSeries}
                      onToggleSeries={toggleAnnualFlowSeries}
                    />
                  </Card>

                  <Card className="h-full flex flex-col chart-interactive-layer">
                    <h3 className="text-lg font-semibold text-primary mb-4">Saldo acumulado ({selectedYear})</h3>
                    <CumulativeBalanceChart data={cumulativeBalanceData} />
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                  {renderPieCard(`Despesas por categoria (${selectedYear})`, annualPieExpenses)}
                  {renderPieCard(`Rendas por categoria (${selectedYear})`, annualPieIncomes)}
                  {renderPieCard(`Formas de Pagamento (${selectedYear})`, annualPiePaymentMethods)}
                </div>

                <div className="space-y-4">
                  <Card className="h-full flex flex-col chart-interactive-layer">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <h3 className="text-lg font-semibold text-primary">
                        Evolução mensal por categoria ({evolutionType === 'expense' ? 'despesas' : 'rendas'})
                      </h3>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant={evolutionType === 'expense' ? 'secondary' : 'outline'}
                          className="min-h-0 py-1 px-3 text-xs"
                          onClick={() => setEvolutionType('expense')}
                        >
                          Despesas
                        </Button>
                        <Button
                          size="sm"
                          variant={evolutionType === 'income' ? 'secondary' : 'outline'}
                          className="min-h-0 py-1 px-3 text-xs"
                          onClick={() => setEvolutionType('income')}
                        >
                          Rendas
                        </Button>
                      </div>
                    </div>
                    {((evolutionType === 'expense' ? annualExpenseTrendSeries : annualIncomeTrendSeries).length === 0 || 
                      (evolutionType === 'expense' ? annualExpenseTrendVisibleData : annualIncomeTrendVisibleData).length === 0) ? (
                      <p className="text-sm text-secondary">Sem {evolutionType === 'expense' ? 'despesas' : 'rendas'} no ano selecionado.</p>
                    ) : (
                      <CategoryTrendChart
                        data={evolutionType === 'expense' ? annualExpenseTrendVisibleData : annualIncomeTrendVisibleData}
                        series={evolutionType === 'expense' ? annualExpenseTrendSeries : annualIncomeTrendSeries}
                        hiddenSeries={evolutionType === 'expense' ? hiddenExpenseSeries : hiddenIncomeSeries}
                        onToggleSeries={evolutionType === 'expense' ? toggleExpenseSeries : toggleIncomeSeries}
                      />
                    )}
                  </Card>
                </div>

              </div>
            ) : monthSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  <Card className="h-full animate-stagger-item delay-50">
                    <p className="text-sm text-secondary">Rendas de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-income">{formatCurrency(monthSummary.total_income)}</p>
                  </Card>
                  <Card className="h-full animate-stagger-item delay-100">
                    <p className="text-sm text-secondary">Despesas de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-expense">{formatCurrency(monthSummary.total_expenses)}</p>
                  </Card>
                  <Card className="h-full animate-stagger-item delay-150">
                    <p className="text-sm text-secondary">Investimentos de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-balance">{formatCurrency(monthSummary.total_investments)}</p>
                  </Card>
                  <Card className="h-full animate-stagger-item delay-200">
                    <p className="text-sm text-secondary">Taxa de saldo do mês</p>
                    <p className={`text-2xl font-bold mt-2 ${savingsRate >= 0 ? 'text-income' : 'text-expense'}`}>
                      {`${formatNumberWithTwoDecimalsBR(savingsRate)}%`}
                    </p>
                  </Card>
                </div>

                <Card className="chart-interactive-layer">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-primary">Fluxo diário consolidado ({formatMonth(selectedMonth)})</h3>
                    <span className="text-sm text-secondary">Rendas, despesas e investimentos por dia</span>
                  </div>
                  <DailyFlowChart
                    data={dailyConsolidatedData}
                    hiddenSeries={hiddenDailyConsolidatedSeries}
                    onToggleSeries={toggleDailyConsolidatedSeries}
                    xAxisKey="label"
                  />
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <Card className="h-full flex flex-col chart-interactive-layer">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-primary lg:whitespace-nowrap">Composição do mês</h3>
                      <div className="text-sm text-secondary">
                        <span>Saldo do mês: </span>
                        <span
                          className="font-bold"
                          style={{ color: monthSummary.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
                        >
                          {formatCurrency(monthSummary.balance)}
                        </span>
                      </div>
                    </div>
                    <MonthCompositionChart
                      data={monthQuickData}
                      hiddenSeries={hiddenMonthCompositionSeries}
                      onToggleSeries={toggleMonthCompositionSeries}
                    />
                  </Card>

                  <Card className="h-full flex flex-col chart-interactive-layer">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-primary lg:whitespace-nowrap">Gastos por dia da semana</h3>
                      <div className="text-sm text-secondary">
                        {topWeekdayExpense && topWeekdayExpense.Despesas > 0
                          ? `Maior gasto: ${topWeekdayExpense.dia} (${formatCurrency(topWeekdayExpense.Despesas)})`
                          : `Distribuição semanal de despesas em ${formatMonth(selectedMonth)}`}
                      </div>
                    </div>
                    <WeekdayExpenseChart data={weekdayExpenseData} />
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                  {renderPieCard(`Despesas por categoria (${formatMonth(selectedMonth)})`, monthPieExpenses)}
                  {renderPieCard(`Rendas por categoria (${formatMonth(selectedMonth)})`, monthPieIncomes)}
                  {renderPieCard(`Formas de Pagamento (${formatMonth(selectedMonth)})`, monthPiePaymentMethods)}
                </div>

                <div className="grid grid-cols-1 gap-4 items-stretch">
                  <Card className="h-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-primary">Detalhamento por categoria ({drilldownSectionType === 'expense' ? 'despesas' : 'rendas'})</h3>
                        <p className="text-xs text-secondary">Categorias do mês com distribuição proporcional.</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant={drilldownSectionType === 'expense' ? 'secondary' : 'outline'}
                          className="min-h-0 py-1 px-3 text-xs"
                          onClick={() => setDrilldownSectionType('expense')}
                        >
                          Despesas
                        </Button>
                        <Button
                          size="sm"
                          variant={drilldownSectionType === 'income' ? 'secondary' : 'outline'}
                          className="min-h-0 py-1 px-3 text-xs"
                          onClick={() => setDrilldownSectionType('income')}
                        >
                          Rendas
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[...(drilldownSectionType === 'expense' ? monthExpenseCategories : monthIncomeCategories)]
                        .sort((a, b) => b.total - a.total)
                        .map((category, index) => {
                          const isExpense = drilldownSectionType === 'expense'
                          const id = isExpense ? (category as ExpenseCategorySummary).category_id : (category as IncomeCategorySummary).income_category_id
                          const color = isExpense 
                            ? getExpenseColor(id, category.color)
                            : getIncomeColor(id, category.color)
                          const totalBase = isExpense ? monthExpenseTotal : monthIncomeTotal
                          const staggerClass = index < 8 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300', 'delay-350', 'delay-400'][index] : ''

                          return (
                            <ReportsCategoryRowButton
                              key={id}
                              categoryId={id}
                              categoryName={category.category_name}
                              total={category.total}
                              color={color}
                              totalBase={totalBase}
                              staggerClass={staggerClass}
                              onOpen={(categoryId, categoryName) =>
                                openDetailModal(isExpense ? 'expense' : 'income', categoryId, categoryName, 'month')
                              }
                            />
                          )
                        })}
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <p className="text-secondary">Sem dados para o mês selecionado.</p>
              </Card>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={detailModal.isOpen}
        onClose={() => {
          setDetailSearch('')
          setDetailModal((prev) => ({ ...prev, isOpen: false }))
        }}
        title={`${
          detailModal.type === 'expense' ? 'Despesas' :
          detailModal.type === 'income' ? 'Rendas' :
          detailModal.type === 'payment_method' ? 'Pagamentos' :
          'Cartão de Crédito'
        } • ${detailModal.categoryName}`}
      >
        <div className="modal-body-stack">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Comparação mensal</p>
            <div className="rounded-xl border border-glass surface-glass p-3">
              <p className="text-sm text-secondary">Total em {detailModal.period === 'year' ? selectedYear : formatMonth(selectedMonth)}</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(detailCurrentTotal)}</p>
              <p className="text-sm text-secondary mt-2">Comparação com {detailModal.period === 'year' ? selectedYear - 1 : formatMonth(previousMonth)}</p>
              <p className="text-sm text-primary">
                {formatCurrency(detailPreviousTotal)}
                {' • '}
                <span className={detailDifference >= 0 ? 'text-income' : 'text-expense'}>
                  {detailDifference >= 0 ? '+' : ''}{formatCurrency(detailDifference)}
                  {detailDifferencePct !== null ? ` (${detailDifferencePct >= 0 ? '+' : ''}${formatNumberWithTwoDecimalsBR(detailDifferencePct)}%)` : ''}
                </span>
              </p>
            </div>
          </div>

          {detailModal.period === 'month' && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-secondary">Metas do mês</p>
              <div className="rounded-xl border border-glass surface-glass p-3">
                {detailMonthlyGoal?.configured ? (
                  <>
                    <p className="text-sm text-primary">{detailMonthlyGoal.label}: {formatCurrency(detailMonthlyGoal.targetAmount ?? 0)}</p>
                    <p className="text-sm text-primary">Atual: {formatCurrency(detailMonthlyGoal.currentAmount ?? 0)}</p>
                    <p className={`text-sm font-medium ${(detailMonthlyGoal.isExceeded ?? false) ? 'text-expense' : 'text-income'}`}>
                      {(detailMonthlyGoal.isExceeded ?? false)
                        ? `Acima da meta: ${formatCurrency(detailMonthlyGoal.differenceAmount ?? 0)}`
                        : `Faltam: ${formatCurrency(detailMonthlyGoal.differenceAmount ?? 0)}`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-secondary">Sem meta configurada para esta categoria no mês.</p>
                )}
              </div>
            </div>
          )}

          {detailModal.isOpen && (
            <CategoryDetailMiniChart
              detailItems={detailItems}
              period={detailModal.period}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              color={detailCategoryColor}
            />
          )}

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-secondary mb-2">Buscar lançamento</label>
            <Input
              type="text"
              value={detailSearch}
              onChange={(event) => setDetailSearch(event.target.value)}
              placeholder="Digite parte da descrição"
            />
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Lançamentos do mês</p>

          {filteredDetailItems.length === 0 ? (
            <p className="text-sm text-secondary">
              {yearDetailLoading && detailModal.period === 'year'
                ? (
                  <div className="flex items-center gap-2 text-sm text-secondary">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Carregando lançamentos do ano...</span>
                  </div>
                )
                : `Nenhum lançamento encontrado para esta categoria no ${detailModal.period === 'year' ? 'ano' : 'mês'} selecionado.`}
            </p>
          ) : (
            <div className="space-y-2">
              {visibleDetailItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`rounded-xl border border-glass surface-glass p-3 animate-stagger-item ${index < 8 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300', 'delay-350', 'delay-400'][index] : ''
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{item.description}</p>
                      <p className="text-xs text-secondary mt-1">{formatDate(item.date)}</p>
                    </div>
                    <p className="text-sm font-semibold text-primary whitespace-nowrap">{formatCurrency(item.amount)}</p>
                  </div>
                </div>
              ))}

              {hasMoreDetailItems && (
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDetailVisibleCount((prev) => prev + DETAIL_ITEMS_STEP)}
                  >
                    Ver mais
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
