import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import YearSelector from '@/components/YearSelector'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useSwipeYear } from '@/hooks/useSwipeYear'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import Input from '@/components/Input'
import ReportsCategoryRowButton from '@/components/reports/ReportsCategoryRowButton'
import ReportsTabButton from '@/components/reports/ReportsTabButton'
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
import { Scale, Loader2, TrendingUp, TrendingDown, Wallet, Percent, Calendar, CalendarDays, GitCompareArrows, CreditCard, Coins, ArrowLeftRight, QrCode, Landmark } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSearchParams } from 'react-router-dom'
import { Sparkline } from '@/components/reports/reportsChartShared'
import FinancialInsights from '@/components/reports/FinancialInsights'


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
  const [compareWithPrevious, setCompareWithPrevious] = useState(false)
  const [modalTab, setModalTab] = useState<'summary' | 'transactions'>('summary')
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
  const [monthChartTab, setMonthChartTab] = useState<'daily' | 'weekly' | 'composition'>('daily')
  const [compositionPieType, setCompositionPieType] = useState<'expense' | 'income' | 'payment'>('expense')
  const [annualCompositionPieType, setAnnualCompositionPieType] = useState<'expense' | 'income' | 'payment'>('expense')
  const [annualChartType, setAnnualChartType] = useState<'flow' | 'balance' | 'trend'>('flow')
  const {
    dashboardReportsWeightsEnabled,
    setDashboardReportsWeightsEnabled,
  } = useAppSettings()

  // Swipe de mês — ativo quando no modo mês
  const monthSwipe = useSwipeMonth(selectedMonth, setSelectedMonth)

  // Swipe de ano — ativo quando no modo ano
  const yearSwipe = useSwipeYear(
    selectedYear,
    (year) => {
      setSelectedYear(year)
      const monthsForYear = availableMonths.filter((m) => m.startsWith(`${year}-`))
      if (monthsForYear.length > 0) setSelectedMonth(monthsForYear[0])
    }
  )

  // Handler combinado: delega ao hook correto conforme o modo ativo
  const swipeHandlers = viewMode === 'month' ? monthSwipe : yearSwipe

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
  
  const previousYear = selectedYear - 1
  const { 
    monthlySummaries: prevMonthlySummaries, 
    loading: loadingPrevReports 
  } = useReports(previousYear, includeReportWeights)

  const { expenses: monthExpenses, loading: loadingMonthExpenses } = useExpenses(selectedMonth)
  const { creditCards } = useCreditCards()
  const { incomes: monthIncomes, loading: loadingMonthIncomes } = useIncomes(selectedMonth)
  const { expenses: previousMonthExpenses, loading: loadingPreviousMonthExpenses } = useExpenses(previousMonth)
  const { incomes: previousMonthIncomes, loading: loadingPreviousMonthIncomes } = useIncomes(previousMonth)
  const { isOnline } = useNetworkStatus()

  const [portfolioTransactions, setPortfolioTransactions] = useState<
    Pick<PortfolioTransaction, 'date' | 'operation_type' | 'quantity' | 'price'>[]
  >([])
  const [previousPortfolioTransactions, setPreviousPortfolioTransactions] = useState<
    Pick<PortfolioTransaction, 'date' | 'operation_type' | 'quantity' | 'price'>[]
  >([])

  useEffect(() => {
    let canceled = false

    const loadPortfolioTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!canceled) {
          setPortfolioTransactions([])
          setPreviousPortfolioTransactions([])
        }
        return
      }

      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle()

      if (!portfolio) {
        if (!canceled) {
          setPortfolioTransactions([])
          setPreviousPortfolioTransactions([])
        }
        return
      }

      // Mês Atual
      const [year, month] = selectedMonth.split('-').map(Number)
      const daysInMonth = new Date(year, month, 0).getDate()
      const rangeEnd = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`

      // Mês Anterior
      const [prevYear, prevMonthVal] = previousMonth.split('-').map(Number)
      const prevDaysInMonth = new Date(prevYear, prevMonthVal, 0).getDate()
      const prevRangeEnd = `${previousMonth}-${String(prevDaysInMonth).padStart(2, '0')}`

      const [currentRes, previousRes] = await Promise.all([
        supabase
          .from('portfolio_transactions')
          .select('date, operation_type, quantity, price')
          .eq('portfolio_id', portfolio.id)
          .gte('date', `${selectedMonth}-01`)
          .lte('date', rangeEnd),
        supabase
          .from('portfolio_transactions')
          .select('date, operation_type, quantity, price')
          .eq('portfolio_id', portfolio.id)
          .gte('date', `${previousMonth}-01`)
          .lte('date', prevRangeEnd)
      ])

      if (!canceled) {
        setPortfolioTransactions(currentRes.data || [])
        setPreviousPortfolioTransactions(previousRes.data || [])
      }
    }

    if (isOnline) {
      void loadPortfolioTransactions()
    } else {
      setPortfolioTransactions([])
      setPreviousPortfolioTransactions([])
    }

    const onDataChanged = () => {
      if (isOnline) void loadPortfolioTransactions()
    }
    window.addEventListener('local-data-changed', onDataChanged)
    return () => {
      canceled = true
      window.removeEventListener('local-data-changed', onDataChanged)
    }
  }, [selectedMonth, previousMonth, isOnline])

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
      monthlySummaries.map((s: MonthlySummary, idx) => {
        const prev = prevMonthlySummaries[idx]
        return {
          month: formatMonthShort(s.month),
          Rendas: s.total_income,
          Despesas: s.total_expenses,
          Investimentos: Math.max(0, s.total_investments),
          Saldo: s.balance,
          ...(compareWithPrevious && prev ? {
            'Rendas (Ano Ant.)': prev.total_income,
            'Despesas (Ano Ant.)': prev.total_expenses,
            'Investimentos (Ano Ant.)': Math.max(0, prev.total_investments),
          } : {})
        }
      }),
    [monthlySummaries, prevMonthlySummaries, compareWithPrevious]
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
    let prevCumulative = 0
    return monthlySummaries.map((item: MonthlySummary, idx) => {
      cumulative += item.balance
      const prevItem = prevMonthlySummaries[idx]
      if (prevItem) {
        prevCumulative += prevItem.balance
      }
      return {
        month: formatMonthShort(item.month),
        SaldoAcumulado: cumulative,
        ...(compareWithPrevious && prevItem ? {
          'Saldo Acumulado (Ano Ant.)': prevCumulative,
        } : {})
      }
    })
  }, [monthlySummaries, prevMonthlySummaries, compareWithPrevious])

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

  const previousYearTotals = useMemo(() => {
    return prevMonthlySummaries.reduce(
      (acc: { income: number; expenses: number; investments: number; balance: number }, month: MonthlySummary) => ({
        income: acc.income + month.total_income,
        expenses: acc.expenses + month.total_expenses,
        investments: acc.investments + month.total_investments,
        balance: acc.balance + month.balance,
      }),
      { income: 0, expenses: 0, investments: 0, balance: 0 }
    )
  }, [prevMonthlySummaries])

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
    setModalTab('summary')
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
    })) as Array<{
      day: number
      label: string
      Rendas: number
      Despesas: number
      Investimentos: number
      'Rendas (Mês Ant.)'?: number
      'Despesas (Mês Ant.)'?: number
      'Investimentos (Mês Ant.)'?: number
    }>

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

    // Adicionar comparação do mês anterior se habilitado
    if (compareWithPrevious && previousMonth) {
      const [prevYear, prevMonthVal] = previousMonth.split('-').map(Number)
      const prevDaysInMonth = new Date(prevYear, prevMonthVal, 0).getDate()
      
      const prevTotalsByDay = Array.from({ length: prevDaysInMonth }, () => ({
        Rendas: 0,
        Despesas: 0,
        Investimentos: 0,
      }))

      previousMonthExpenses.forEach((expense) => {
        if (!expense.date?.startsWith(previousMonth)) return
        const day = Number(expense.date.slice(8, 10))
        if (day >= 1 && day <= prevDaysInMonth) {
          prevTotalsByDay[day - 1].Despesas += getAmountByMode(expense)
        }
      })

      previousMonthIncomes.forEach((income) => {
        if (!income.date?.startsWith(previousMonth)) return
        const day = Number(income.date.slice(8, 10))
        if (day >= 1 && day <= prevDaysInMonth) {
          prevTotalsByDay[day - 1].Rendas += getAmountByMode(income)
        }
      })

      const prevPortfolioByDay = portfolioInvestmentByDay(
        previousPortfolioTransactions,
        previousMonth,
        prevDaysInMonth
      )
      prevPortfolioByDay.forEach((value, index) => {
        prevTotalsByDay[index].Investimentos += value
      })

      // Injetar dados pareados dia a dia
      totalsByDay.forEach((dayData, index) => {
        const prevDayData = prevTotalsByDay[index]
        if (prevDayData) {
          dayData['Rendas (Mês Ant.)'] = prevDayData.Rendas
          dayData['Despesas (Mês Ant.)'] = prevDayData.Despesas
          dayData['Investimentos (Mês Ant.)'] = prevDayData.Investimentos
        } else {
          dayData['Rendas (Mês Ant.)'] = 0
          dayData['Despesas (Mês Ant.)'] = 0
          dayData['Investimentos (Mês Ant.)'] = 0
        }
      })
    }

    return totalsByDay
  }, [
    monthExpenses,
    monthIncomes,
    portfolioTransactions,
    selectedMonth,
    getAmountByMode,
    compareWithPrevious,
    previousMonth,
    previousMonthExpenses,
    previousMonthIncomes,
    previousPortfolioTransactions
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





  const loadingState = loading || loadingIncomes || loadingMonthExpenses || loadingMonthIncomes || loadingPreviousMonthExpenses || loadingPreviousMonthIncomes || loadingAvailablePeriods || loadingPrevReports
  const savingsRate = monthSummary && monthSummary.total_income > 0
    ? ((monthSummary.balance / monthSummary.total_income) * 100)
    : 0

  const previousMonthIncomeTotal = useMemo(() => {
    return previousMonthIncomes.reduce((sum, item) => sum + getAmountByMode(item), 0)
  }, [previousMonthIncomes, getAmountByMode])

  const previousMonthExpenseTotal = useMemo(() => {
    return previousMonthExpenses.reduce((sum, item) => sum + getAmountByMode(item), 0)
  }, [previousMonthExpenses, getAmountByMode])

  const previousMonthInvestmentTotal = useMemo(() => {
    const [year, month] = previousMonth.split('-').map(Number)
    if (!year || !month) return 0
    const daysInMonth = new Date(year, month, 0).getDate()
    const prevPortfolioByDay = portfolioInvestmentByDay(
      previousPortfolioTransactions,
      previousMonth,
      daysInMonth
    )
    return prevPortfolioByDay.reduce((sum, val) => sum + val, 0)
  }, [previousPortfolioTransactions, previousMonth])

  const previousMonthBalance = previousMonthIncomeTotal - previousMonthExpenseTotal - previousMonthInvestmentTotal
  const previousMonthSavingsRate = previousMonthIncomeTotal > 0
    ? (previousMonthBalance / previousMonthIncomeTotal) * 100
    : 0

  const limitsExceededCount = useMemo(() => {
    if (viewMode !== 'month') return 0
    let count = 0
    monthExpenseCategories.forEach((cat) => {
      const limit = monthExpenseLimitMap.get(cat.category_id)
      if (limit && cat.total > limit) {
        count++
      }
    })
    return count
  }, [viewMode, monthExpenseCategories, monthExpenseLimitMap])

  const renderKPICard = useCallback(({
    title,
    value,
    subtext,
    icon,
    glowColor,
    sparklineData,
    trendPercent,
  }: {
    title: string
    value: string
    subtext: string
    icon: React.ReactNode
    glowColor: string
    sparklineData: number[]
    trendPercent?: number | null
  }) => {
    const isDespesa = title.toLowerCase().includes('despesa')
    const isTrendPositive = trendPercent !== undefined && trendPercent !== null && trendPercent >= 0

    return (
      <Card className="h-full relative overflow-hidden flex flex-col p-4 sm:p-5 border border-glass surface-glass transition-all hover:scale-[1.015] hover:border-glass-strong hover:shadow-md group animate-stagger-item">
        {/* Glow Halo */}
        <div 
          className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl pointer-events-none opacity-[0.08] group-hover:opacity-[0.14] transition-opacity duration-300" 
          style={{ backgroundColor: glowColor }}
        />
        
        <div className="flex items-start justify-between gap-3 w-full">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary leading-tight">
              {title}
            </p>
            <p className="text-lg font-extrabold font-mono text-primary mt-2.5 leading-none">
              {value}
            </p>
          </div>
          
          <span 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
            style={{ 
              backgroundColor: `${glowColor}15`, 
              color: glowColor,
              boxShadow: `0 0 8px ${glowColor}0a` 
            }}
          >
            {icon}
          </span>
        </div>

        {/* Embedded Sparkline */}
        <div className="mt-3.5 h-8 w-full overflow-hidden flex items-end">
          <Sparkline data={sparklineData} color={glowColor} height={28} />
        </div>

        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-glass/40 text-[10px] font-semibold">
          <span className="text-secondary truncate">{subtext}</span>
          {trendPercent !== undefined && trendPercent !== null ? (
            <span 
              className={`shrink-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold ${
                isDespesa
                  ? (isTrendPositive ? 'text-expense bg-expense/10' : 'text-income bg-income/10')
                  : (isTrendPositive ? 'text-income bg-income/10' : 'text-expense bg-expense/10')
              }`}
            >
              {isTrendPositive ? '+' : ''}
              {formatNumberWithTwoDecimalsBR(trendPercent)}
              {title.toLowerCase().includes('taxa') ? ' pp' : '%'}
            </span>
          ) : null}
        </div>
      </Card>
    )
  }, [])

  const getPaymentMethodIcon = (categoryId: string) => {
    const norm = categoryId.toLowerCase()
    if (norm.includes('cash') || norm.includes('dinheiro')) return <Coins size={12} />
    if (norm.includes('credit') || norm.includes('cartao') || norm.includes('card')) return <CreditCard size={12} />
    if (norm.includes('pix')) return <QrCode size={12} />
    if (norm.includes('debit') || norm.includes('debito')) return <CreditCard size={12} />
    if (norm.includes('transfer') || norm.includes('transferencia')) return <ArrowLeftRight size={12} />
    return <Landmark size={12} />
  }

  const renderUnifiedCompositionCard = (
    activeType: 'expense' | 'income' | 'payment',
    setActiveType: (val: 'expense' | 'income' | 'payment') => void,
    periodLabel: string,
    expensesData: PieDatum[],
    incomesData: PieDatum[],
    paymentsData: PieDatum[],
    isYear: boolean = false
  ) => {
    const activeData = {
      expense: expensesData,
      income: incomesData,
      payment: paymentsData,
    }[activeType]

    const total = activeData.reduce((sum, current) => sum + current.value, 0)

    return (
      <Card className="border border-glass surface-glass shadow-sm transition-all duration-300 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-glass/40 pb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              Composição detalhada
            </h3>
            <p className="text-[10px] text-secondary mt-0.5">
              Visualização de progresso e limites em {periodLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-auto">
            <div className="flex items-center gap-1 bg-secondary/10 p-0.5 rounded-lg border border-glass">
              <ReportsTabButton
                active={activeType === 'expense'}
                onClick={() => setActiveType('expense')}
              >
                Despesas
              </ReportsTabButton>
              <ReportsTabButton
                active={activeType === 'income'}
                onClick={() => setActiveType('income')}
              >
                Rendas
              </ReportsTabButton>
              <ReportsTabButton
                active={activeType === 'payment'}
                onClick={() => setActiveType('payment')}
              >
                Meios
              </ReportsTabButton>
            </div>
          </div>
        </div>

        {activeData.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-secondary italic">Sem dados detalhados para exibir nesta visão.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lado Esquerdo: Gráfico de Pizza (1/3 da largura no desktop) */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-glass/40 pb-6 lg:pb-0 lg:pr-6 min-h-[260px]">
              <CategoryPieChart
                data={activeData}
                onClick={(entry: PieDatum) => {
                  if (entry.categoryId && entry.detailType) {
                    openDetailModal(entry.detailType, entry.categoryId, entry.name, entry.detailPeriod || 'month')
                  }
                }}
                outerRadius={80}
                innerRadius={58}
              />
            </div>

            {/* Lado Direito: Listagem Detalhada (2/3 da largura no desktop) */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {activeData
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((item, index) => {
                    const staggerClass = index < 8 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300', 'delay-350', 'delay-400'][index] : ''
                    
                    if (activeType === 'payment') {
                      const pct = total > 0 ? (item.value / total) * 100 : 0
                      const pmIcon = getPaymentMethodIcon(item.categoryId || '')
                      return (
                        <Button
                          key={item.name}
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (item.categoryId && item.detailType) {
                              openDetailModal(item.detailType, item.categoryId, item.name, item.detailPeriod || 'month')
                            }
                          }}
                          className={`w-full h-auto text-left flex-col items-stretch p-2.5 animate-stagger-item transition-all hover:scale-[1.005] hover:border-glass-strong surface-glass ${staggerClass}`}
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" 
                                style={{ backgroundColor: `${item.color}15`, color: item.color }}
                              >
                                {pmIcon}
                              </span>
                              <span className="text-xs font-semibold text-primary truncate">{item.name}</span>
                            </div>
                            <span className="text-xs font-bold text-primary font-mono shrink-0">
                              {formatCurrency(item.value)}
                            </span>
                          </div>
                          
                          <div className="text-[9px] text-secondary font-medium mt-1 truncate">
                            {formatNumberWithTwoDecimalsBR(pct)}% do total
                          </div>
                          
                          <div className="w-full h-1 rounded-full bg-secondary/20 mt-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                          </div>
                        </Button>
                      )
                    }

                    const id = item.categoryId || ''
                    const isExpense = activeType === 'expense'
                    const target = isYear ? null : (
                      isExpense 
                        ? monthExpenseLimitMap.get(id) 
                        : monthIncomeExpectationMap.get(id)
                    )

                    return (
                      <ReportsCategoryRowButton
                        key={id}
                        categoryId={id}
                        categoryName={item.name}
                        total={item.value}
                        color={item.color}
                        totalBase={total}
                        targetAmount={target}
                        isExpense={isExpense}
                        staggerClass={staggerClass}
                        onOpen={(catId, catName) =>
                          openDetailModal(isExpense ? 'expense' : 'income', catId, catName, isYear ? 'year' : 'month')
                        }
                      />
                    )
                  })}
              </div>
            </div>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
      <PageHeader
        title={PAGE_HEADERS.reports.title}
        subtitle={PAGE_HEADERS.reports.description}
        action={
          <PageHeaderActions>
            {/* Modo mês = padrão (cinza), modo ano = ativo (colorido) */}
            <PageHeaderActionButton
              intent={viewMode === 'year' ? 'balance' : 'neutral'}
              icon={viewMode === 'month' ? CalendarDays : Calendar}
              label={viewMode === 'month' ? 'Visualizar por Ano' : 'Visualizar por Mês'}
              onClick={() => setViewMode(viewMode === 'month' ? 'year' : 'month')}
              title={viewMode === 'month' ? 'Visualizar por Ano' : 'Visualizar por Mês'}
            />
            {/* Pesos: cinza quando desativado, âmbar quando ativo */}
            <PageHeaderActionButton
              intent={dashboardReportsWeightsEnabled ? 'warning' : 'neutral'}
              icon={Scale}
              label={dashboardReportsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
              onClick={() => setDashboardReportsWeightsEnabled(!dashboardReportsWeightsEnabled)}
              title={dashboardReportsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
            />
            {/* Comparar: ícone fixo GitCompareArrows, cinza quando inativo, verde quando ativo */}
            <PageHeaderActionButton
              intent={compareWithPrevious ? 'income' : 'neutral'}
              icon={GitCompareArrows}
              label={compareWithPrevious ? 'Desativar comparação histórica' : 'Ativar comparação histórica'}
              onClick={() => setCompareWithPrevious(!compareWithPrevious)}
              title={compareWithPrevious ? 'Desativar comparação histórica' : 'Ativar comparação histórica'}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
        {/* Seletor de período — mesmo padrão das páginas de despesas e rendimentos */}
        {viewMode === 'month' ? (
          <MonthSelector
            value={selectedMonth}
            onChange={(month) => {
              setSelectedMonth(month)
              setViewMode('month')
            }}
            isOnline={isOnline}
          />
        ) : (
          <YearSelector
            value={selectedYear}
            onChange={(year) => {
              setSelectedYear(year)
              const monthsForYear = availableMonths.filter((month) => month.startsWith(`${year}-`))
              if (monthsForYear.length > 0) {
                setSelectedMonth(monthsForYear[0])
              }
            }}
            availableYears={availableYears}
          />
        )}

        <MonthTransitionView month={viewMode === 'month' ? selectedMonth : String(selectedYear)}>
        {loadingState ? (
          <Loader text="Carregando dados..." className="py-12" />
        ) : (
          <>
            {viewMode === 'year' ? (
              <div className="space-y-6 animate-stagger">
                {/* KPIs Anuais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  {renderKPICard({
                    title: 'Rendas no ano',
                    value: formatCurrency(annualTotals.income),
                    subtext: `Total acumulado em ${selectedYear}`,
                    icon: <TrendingUp size={16} />,
                    glowColor: 'var(--color-income)',
                    sparklineData: monthlySummaries.map((s) => s.total_income),
                    trendPercent: previousYearTotals.income > 0 
                      ? ((annualTotals.income - previousYearTotals.income) / previousYearTotals.income) * 100 
                      : null
                  })}
                  {renderKPICard({
                    title: 'Despesas no ano',
                    value: formatCurrency(annualTotals.expenses),
                    subtext: `Total acumulado em ${selectedYear}`,
                    icon: <TrendingDown size={16} />,
                    glowColor: 'var(--color-expense)',
                    sparklineData: monthlySummaries.map((s) => s.total_expenses),
                    trendPercent: previousYearTotals.expenses > 0 
                      ? ((annualTotals.expenses - previousYearTotals.expenses) / previousYearTotals.expenses) * 100 
                      : null
                  })}
                  {renderKPICard({
                    title: 'Investimentos no ano',
                    value: formatCurrency(annualTotals.investments),
                    subtext: `Total acumulado em ${selectedYear}`,
                    icon: <Wallet size={16} />,
                    glowColor: 'var(--color-balance)',
                    sparklineData: monthlySummaries.map((s) => s.total_investments),
                    trendPercent: previousYearTotals.investments > 0 
                      ? ((annualTotals.investments - previousYearTotals.investments) / previousYearTotals.investments) * 100 
                      : null
                  })}
                  {renderKPICard({
                    title: 'Saldo anual',
                    value: formatCurrency(annualTotals.balance),
                    subtext: `Balanço final consolidado`,
                    icon: <Percent size={16} />,
                    glowColor: annualTotals.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                    sparklineData: monthlySummaries.map((s) => s.balance),
                    trendPercent: previousYearTotals.balance !== 0
                      ? ((annualTotals.balance - previousYearTotals.balance) / Math.abs(previousYearTotals.balance)) * 100
                      : null
                  })}
                </div>

                {/* Insights Anuais */}
                <FinancialInsights
                  viewMode="year"
                  periodLabel={String(selectedYear)}
                  incomeTotal={annualTotals.income}
                  expenseTotal={annualTotals.expenses}
                  savingsRate={annualTotals.income > 0 ? (annualTotals.balance / annualTotals.income) * 100 : 0}
                  categoryExpenses={categoryExpenses}
                  previousExpenseTotal={previousYearTotals.expenses}
                />

                <div className="space-y-6">
                  {/* Gráficos de Fluxo/Evolução (Full Width) */}
                  <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 border-b border-glass/40 pb-3">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                          {
                            annualChartType === 'flow' ? 'Fluxo Mensal' :
                            annualChartType === 'balance' ? 'Saldo Acumulado' :
                            `Evolução por Categoria`
                          }
                        </h3>
                        <p className="text-[10px] text-secondary mt-0.5">
                          {
                            annualChartType === 'flow' ? `Entradas, saídas e investimentos mensais em ${selectedYear}` :
                            annualChartType === 'balance' ? `Evolução do patrimônio líquido acumulado em ${selectedYear}` :
                            `Histórico mensal detalhado de ${evolutionType === 'expense' ? 'despesas' : 'rendas'} em ${selectedYear}`
                          }
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
                        {/* Sub-seletor condicional para Despesas/Rendas na Evolução */}
                        {annualChartType === 'trend' && (
                          <div className="flex items-center gap-1 mr-2 border-r border-glass/40 pr-2">
                            <ReportsTabButton
                              active={evolutionType === 'expense'}
                              onClick={() => setEvolutionType('expense')}
                            >
                              Despesas
                            </ReportsTabButton>
                            <ReportsTabButton
                              active={evolutionType === 'income'}
                              onClick={() => setEvolutionType('income')}
                            >
                              Rendas
                            </ReportsTabButton>
                          </div>
                        )}

                        <div className="flex items-center gap-1 bg-secondary/10 p-0.5 rounded-lg border border-glass">
                          <ReportsTabButton
                            active={annualChartType === 'flow'}
                            onClick={() => setAnnualChartType('flow')}
                          >
                            Fluxo
                          </ReportsTabButton>
                          <ReportsTabButton
                            active={annualChartType === 'balance'}
                            onClick={() => setAnnualChartType('balance')}
                          >
                            Saldo
                          </ReportsTabButton>
                          <ReportsTabButton
                            active={annualChartType === 'trend'}
                            onClick={() => setAnnualChartType('trend')}
                          >
                            Evolução
                          </ReportsTabButton>
                        </div>
                      </div>
                    </div>

                    <div className="w-full mt-2">
                      {annualChartType === 'flow' && (
                        <AnnualFlowChart
                          data={monthlyData}
                          hiddenSeries={hiddenAnnualFlowSeries}
                          onToggleSeries={toggleAnnualFlowSeries}
                        />
                      )}
                      {annualChartType === 'balance' && (
                        <CumulativeBalanceChart data={cumulativeBalanceData} />
                      )}
                      {annualChartType === 'trend' && (
                        <>
                          {((evolutionType === 'expense' ? annualExpenseTrendSeries : annualIncomeTrendSeries).length === 0 || 
                            (evolutionType === 'expense' ? annualExpenseTrendVisibleData : annualIncomeTrendVisibleData).length === 0) ? (
                            <p className="text-sm text-secondary py-12 text-center italic">
                              Sem {evolutionType === 'expense' ? 'despesas' : 'rendas'} no ano selecionado.
                            </p>
                          ) : (
                            <CategoryTrendChart
                              data={evolutionType === 'expense' ? annualExpenseTrendVisibleData : annualIncomeTrendVisibleData}
                              series={evolutionType === 'expense' ? annualExpenseTrendSeries : annualIncomeTrendSeries}
                              hiddenSeries={evolutionType === 'expense' ? hiddenExpenseSeries : hiddenIncomeSeries}
                              onToggleSeries={evolutionType === 'expense' ? toggleExpenseSeries : toggleIncomeSeries}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </Card>

                  {/* Painel Unificado de Composição & Detalhamento */}
                  {renderUnifiedCompositionCard(
                    annualCompositionPieType,
                    setAnnualCompositionPieType,
                    String(selectedYear),
                    annualPieExpenses,
                    annualPieIncomes,
                    annualPiePaymentMethods,
                    true
                  )}
                </div>
              </div>
            ) : monthSummary ? (
              <div className="space-y-6 animate-stagger">
                {/* KPIs Mensais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  {renderKPICard({
                    title: 'Rendas do mês',
                    value: formatCurrency(monthSummary.total_income),
                    subtext: `Receitas consolidadas`,
                    icon: <TrendingUp size={16} />,
                    glowColor: 'var(--color-income)',
                    sparklineData: dailyConsolidatedData.map((d) => d.Rendas),
                    trendPercent: previousMonthIncomeTotal > 0 
                      ? ((monthSummary.total_income - previousMonthIncomeTotal) / previousMonthIncomeTotal) * 100 
                      : null
                  })}
                  {renderKPICard({
                    title: 'Despesas do mês',
                    value: formatCurrency(monthSummary.total_expenses),
                    subtext: `Despesas consolidadas`,
                    icon: <TrendingDown size={16} />,
                    glowColor: 'var(--color-expense)',
                    sparklineData: dailyConsolidatedData.map((d) => d.Despesas),
                    trendPercent: previousMonthExpenseTotal > 0 
                      ? ((monthSummary.total_expenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100 
                      : null
                  })}
                  {renderKPICard({
                    title: 'Investimentos do mês',
                    value: formatCurrency(monthSummary.total_investments),
                    subtext: `Investimentos em ativos`,
                    icon: <Wallet size={16} />,
                    glowColor: 'var(--color-balance)',
                    sparklineData: dailyConsolidatedData.map((d) => d.Investimentos),
                    trendPercent: previousMonthInvestmentTotal > 0 
                      ? ((monthSummary.total_investments - previousMonthInvestmentTotal) / previousMonthInvestmentTotal) * 100 
                      : null
                  })}
                  {renderKPICard({
                    title: 'Taxa de saldo',
                    value: `${formatNumberWithTwoDecimalsBR(savingsRate)}%`,
                    subtext: `Saldo líquido: ${formatCurrency(monthSummary.balance)}`,
                    icon: <Percent size={16} />,
                    glowColor: savingsRate >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                    sparklineData: dailyConsolidatedData.map((d) => d.Rendas - d.Despesas - d.Investimentos),
                    trendPercent: previousMonthIncomeTotal > 0 
                      ? savingsRate - previousMonthSavingsRate 
                      : null
                  })}
                </div>

                {/* Insights Mensais */}
                <FinancialInsights
                  viewMode="month"
                  periodLabel={formatMonth(selectedMonth)}
                  incomeTotal={monthSummary.total_income}
                  expenseTotal={monthSummary.total_expenses}
                  savingsRate={savingsRate}
                  categoryExpenses={monthExpenseCategories}
                  previousExpenseTotal={previousMonthExpenseTotal}
                  weekdayExpenses={weekdayExpenseData}
                  limitsExceededCount={limitsExceededCount}
                />

                <div className="space-y-6">
                  {/* Estação de Gráficos (Full Width) */}
                  <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 border-b border-glass/40 pb-3">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                          {monthChartTab === 'daily' ? 'Fluxo Diário Consolidado' :
                           monthChartTab === 'weekly' ? 'Gastos por Dia da Semana' :
                           'Composição de Saldo'}
                        </h3>
                         <p className="text-[10px] text-secondary mt-0.5">
                           {monthChartTab === 'daily' ? `Rendas, despesas e investimentos por dia em ${formatMonth(selectedMonth)}` :
                            monthChartTab === 'weekly' ? (topWeekdayExpense && topWeekdayExpense.Despesas > 0
                              ? `Maior gasto: ${topWeekdayExpense.dia} (${formatCurrency(topWeekdayExpense.Despesas)})`
                              : `Distribuição semanal de despesas em ${formatMonth(selectedMonth)}`) :
                            `Proporções e saldos consolidados no mês`}
                         </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 bg-secondary/10 p-0.5 rounded-lg border border-glass self-start sm:self-auto">
                        <ReportsTabButton
                          active={monthChartTab === 'daily'}
                          onClick={() => setMonthChartTab('daily')}
                        >
                          Fluxo Diário
                        </ReportsTabButton>
                        <ReportsTabButton
                          active={monthChartTab === 'weekly'}
                          onClick={() => setMonthChartTab('weekly')}
                        >
                          Semana
                        </ReportsTabButton>
                        <ReportsTabButton
                          active={monthChartTab === 'composition'}
                          onClick={() => setMonthChartTab('composition')}
                        >
                          Composição
                        </ReportsTabButton>
                      </div>
                    </div>

                    <div className="w-full mt-2">
                      {monthChartTab === 'daily' && (
                        <DailyFlowChart
                          data={dailyConsolidatedData}
                          hiddenSeries={hiddenDailyConsolidatedSeries}
                          onToggleSeries={toggleDailyConsolidatedSeries}
                          xAxisKey="label"
                        />
                      )}
                      {monthChartTab === 'weekly' && (
                        <WeekdayExpenseChart data={weekdayExpenseData} />
                      )}
                      {monthChartTab === 'composition' && (
                        <MonthCompositionChart
                          data={monthQuickData}
                          hiddenSeries={hiddenMonthCompositionSeries}
                          onToggleSeries={toggleMonthCompositionSeries}
                        />
                      )}
                    </div>
                  </Card>

                  {/* Painel Unificado de Composição & Detalhamento */}
                  {renderUnifiedCompositionCard(
                    compositionPieType,
                    setCompositionPieType,
                    formatMonth(selectedMonth),
                    monthPieExpenses,
                    monthPieIncomes,
                    monthPiePaymentMethods,
                    false
                  )}
                </div>
              </div>
            ) : (
              <Card className="border border-glass surface-glass text-center py-10">
                <p className="text-secondary">Sem dados consolidados para o mês selecionado.</p>
              </Card>
            )}
          </>
        )}
        </MonthTransitionView>
      </div>

      {/* Modal Refatorado de Detalhamento com Abas */}
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
          {/* Alternador de abas no modal */}
          <Tabs value={modalTab} onValueChange={(value) => setModalTab(value as 'summary' | 'transactions')} className="mb-2">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="summary" className="text-xs">Resumo e Metas</TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs">Lançamentos ({filteredDetailItems.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {modalTab === 'summary' ? (
            <div className="space-y-4">
              {/* Comparador de Período */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Comparativo Histórico</p>
                <div className="rounded-xl border border-glass surface-glass p-3.5 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-secondary">Total em {detailModal.period === 'year' ? selectedYear : formatMonth(selectedMonth)}</p>
                      <p className="text-lg font-bold text-primary font-mono">{formatCurrency(detailCurrentTotal)}</p>
                    </div>
                    {detailDifferencePct !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        detailDifference >= 0 
                          ? (detailModal.type === 'expense' ? 'text-expense bg-expense/10' : 'text-income bg-income/10')
                          : (detailModal.type === 'expense' ? 'text-income bg-income/10' : 'text-expense bg-expense/10')
                      }`}>
                        {detailDifference >= 0 ? '+' : ''}{formatNumberWithTwoDecimalsBR(detailDifferencePct)}%
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 pt-2.5 border-t border-glass flex justify-between text-xs text-secondary">
                    <span>Período anterior:</span>
                    <span className="font-semibold text-primary font-mono">{formatCurrency(detailPreviousTotal)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-secondary">
                    <span>Variação absoluta:</span>
                    <span className={`font-semibold ${
                      detailDifference >= 0 
                        ? (detailModal.type === 'expense' ? 'text-expense' : 'text-income')
                        : (detailModal.type === 'expense' ? 'text-income' : 'text-expense')
                    }`}>
                      {detailDifference >= 0 ? '+' : ''}{formatCurrency(detailDifference)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metas/Expectativas se aplicável */}
              {detailModal.period === 'month' && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Metas Orçamentárias</p>
                  <div className="rounded-xl border border-glass surface-glass p-3.5 shadow-sm">
                    {detailMonthlyGoal?.configured ? (
                      <div>
                        <div className="flex justify-between text-xs text-secondary mb-1">
                          <span>Consumo do Limite</span>
                          <span className="font-semibold text-primary font-mono">
                            {formatCurrency(detailMonthlyGoal.currentAmount ?? 0)} de {formatCurrency(detailMonthlyGoal.targetAmount ?? 0)}
                          </span>
                        </div>
                        {/* Barra de Progresso */}
                        <div className="w-full h-1.5 rounded-full bg-secondary/20 overflow-hidden mb-2">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              detailMonthlyGoal.isExceeded ? 'bg-expense' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(((detailMonthlyGoal.currentAmount ?? 0) / (detailMonthlyGoal.targetAmount ?? 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <p className={`text-xs font-semibold ${detailMonthlyGoal.isExceeded ? 'text-expense' : 'text-income'}`}>
                          {detailMonthlyGoal.isExceeded
                            ? `Excedido em ${formatCurrency(detailMonthlyGoal.differenceAmount ?? 0)}`
                            : `Restam ${formatCurrency(detailMonthlyGoal.differenceAmount ?? 0)} para o limite`
                          }
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-secondary text-center py-2">Sem meta ou limite de orçamento configurado no mês.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Mini gráfico */}
              {detailModal.isOpen && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Tendência da Categoria</p>
                  <div className="rounded-xl border border-glass surface-glass p-3 shadow-sm">
                    <CategoryDetailMiniChart
                      detailItems={detailItems}
                      period={detailModal.period}
                      selectedMonth={selectedMonth}
                      selectedYear={selectedYear}
                      color={detailCategoryColor}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Buscador */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">Buscar por descrição</label>
                <Input
                  type="text"
                  value={detailSearch}
                  onChange={(event) => setDetailSearch(event.target.value)}
                  placeholder="Digite parte da descrição do lançamento..."
                />
              </div>

              {/* Lista de transações */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredDetailItems.length === 0 ? (
                  <p className="text-xs text-secondary py-6 text-center">
                    {yearDetailLoading && detailModal.period === 'year' ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-primary" />
                        Buscando lançamentos...
                      </span>
                    ) : (
                      'Nenhum lançamento encontrado para os filtros.'
                    )}
                  </p>
                ) : (
                  <>
                    {visibleDetailItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`rounded-xl border border-glass surface-glass-strong p-3.5 transition-all flex items-center justify-between gap-3 hover:scale-[1.005] hover:border-glass-strong animate-stagger-item ${
                          index < 8 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300', 'delay-350', 'delay-400'][index] : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-primary truncate">{item.description}</p>
                          <p className="text-[9px] font-mono text-secondary mt-1">{formatDate(item.date)}</p>
                        </div>
                        <p className="text-xs font-bold text-primary font-mono whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    ))}

                    {hasMoreDetailItems && (
                      <div className="pt-2 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailVisibleCount((prev) => prev + DETAIL_ITEMS_STEP)}
                          className="w-full"
                        >
                          Carregar mais lançamentos
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
