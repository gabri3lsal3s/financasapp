import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import { PAGE_HEADERS } from '@/constants/pages'
import { useReports } from '@/hooks/useReports'
import { useIncomeReports } from '@/hooks/useIncomeReports'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useInvestments } from '@/hooks/useInvestments'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useIncomeCategoryExpectations } from '@/hooks/useIncomeCategoryExpectations'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { supabase } from '@/lib/supabase'
import { addMonths, clampMonthToAppStart, formatCurrency, formatDate, formatMonth, formatMonthShort, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'
import { useSearchParams } from 'react-router-dom'
type ViewMode = 'year' | 'month'
type ReportDataMode = 'weighted' | 'raw'
type DetailType = 'expense' | 'income'

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

function ChartTooltip({ active, payload, formatValue = formatCurrency }: { active?: boolean; payload?: any[]; formatValue?: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="text-sm font-medium">
          {entry.name}: {formatValue(Number(entry.value))}
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload

  return (
    <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
      <p className="text-sm font-medium text-primary">{point.name}</p>
      <p className="text-sm text-secondary">{formatCurrency(point.value)}</p>
    </div>
  )
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentYear = new Date().getFullYear()
  const currentMonth = getCurrentMonthString()

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loadingAvailablePeriods, setLoadingAvailablePeriods] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('year')
  const [reportDataMode, setReportDataMode] = useState<ReportDataMode>('weighted')
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

  useEffect(() => {
    let canceled = false

    const loadAvailablePeriods = async () => {
      setLoadingAvailablePeriods(true)

      const [expenseDatesRes, incomeDatesRes, investmentMonthsRes] = await Promise.all([
        supabase.from('expenses').select('date'),
        supabase.from('incomes').select('date'),
        supabase.from('investments').select('month'),
      ])

      if (canceled) return

      const monthSet = new Set<string>()

      ;(expenseDatesRes.data ?? []).forEach((row: { date?: string | null }) => {
        const month = row.date?.slice(0, 7)
        if (month && /^\d{4}-\d{2}$/.test(month)) {
          monthSet.add(month)
        }
      })

      ;(incomeDatesRes.data ?? []).forEach((row: { date?: string | null }) => {
        const month = row.date?.slice(0, 7)
        if (month && /^\d{4}-\d{2}$/.test(month)) {
          monthSet.add(month)
        }
      })

      ;(investmentMonthsRes.data ?? []).forEach((row: { month?: string | null }) => {
        const month = row.month
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
  const includeReportWeights = reportDataMode === 'weighted'
  const previousMonth = useMemo(() => addMonths(selectedMonth, -1), [selectedMonth])
  const { monthlySummaries, categoryExpenses, monthlyCategoryExpenses, loading } = useReports(selectedYear, includeReportWeights)
  const { incomeByCategory, monthlyIncomeByCategory, loading: loadingIncomes } = useIncomeReports(selectedYear, includeReportWeights)
  const { expenses: monthExpenses, loading: loadingMonthExpenses } = useExpenses(selectedMonth)
  const { incomes: monthIncomes, loading: loadingMonthIncomes } = useIncomes(selectedMonth)
  const { expenses: previousMonthExpenses, loading: loadingPreviousMonthExpenses } = useExpenses(previousMonth)
  const { incomes: previousMonthIncomes, loading: loadingPreviousMonthIncomes } = useIncomes(previousMonth)
  const { investments: monthInvestments, loading: loadingMonthInvestments } = useInvestments(selectedMonth)
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

  const getExpenseColor = (categoryId: string, fallback: string) =>
    expenseCategoryIdToColor[categoryId] ?? fallback
  const getIncomeColor = (categoryId: string, fallback: string) =>
    incomeCategoryIdToColor[categoryId] ?? fallback

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
    [categoryExpenses, expenseCategoryIdToColor]
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
    [incomeByCategory, incomeCategoryIdToColor]
  )

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
  }, [categoryExpenses, expenseCategoryIdToColor])

  const annualIncomeTrendSeries = useMemo<TrendSeriesMeta[]>(() => {
    return [...incomeByCategory]
      .sort((a, b) => b.total - a.total)
      .map((category) => ({
        key: category.income_category_id,
        name: category.category_name,
        color: getIncomeColor(category.income_category_id, category.color),
      }))
  }, [incomeByCategory, incomeCategoryIdToColor])

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

  const visibleExpenseTrendSeries = useMemo(
    () => annualExpenseTrendSeries.filter((series) => !hiddenExpenseSeries.includes(series.key)),
    [annualExpenseTrendSeries, hiddenExpenseSeries]
  )

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

  const visibleIncomeTrendSeries = useMemo(
    () => annualIncomeTrendSeries.filter((series) => !hiddenIncomeSeries.includes(series.key)),
    [annualIncomeTrendSeries, hiddenIncomeSeries]
  )

  const monthSummary = monthlySummaries.find((s) => s.month === selectedMonth)
  const monthExpenseCategories = selectedMonth ? (monthlyCategoryExpenses[selectedMonth] ?? []) : []
  const monthIncomeCategories = selectedMonth ? (monthlyIncomeByCategory[selectedMonth] ?? []) : []
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

  const getAmountByMode = (entry: { amount: number; report_weight?: number | null }) =>
    includeReportWeights ? entry.amount * (entry.report_weight ?? 1) : entry.amount

  const detailItems = useMemo(() => {
    if (!detailModal.isOpen) {
      return [] as Array<{ id: string; description: string; date: string; amount: number }>
    }

    if (detailModal.period === 'year' && detailModal.type === 'expense') {
      return yearExpenseItems
        .filter((item) => item.category_id === detailModal.categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Sem descrição',
          date: item.date,
          amount: getAmountByMode(item),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (detailModal.period === 'year' && detailModal.type === 'income') {
      return yearIncomeItems
        .filter((item) => item.income_category_id === detailModal.categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.income_category?.name || 'Sem descrição',
          date: item.date,
          amount: getAmountByMode(item),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (detailModal.type === 'expense') {
      return monthExpenses
        .filter((item) => item.category_id === detailModal.categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Sem descrição',
          date: item.date,
          amount: getAmountByMode(item),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    return monthIncomes
      .filter((item) => item.income_category_id === detailModal.categoryId)
      .map((item) => ({
        id: item.id,
        description: item.description || item.income_category?.name || 'Sem descrição',
        date: item.date,
        amount: getAmountByMode(item),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [detailModal, monthExpenses, monthIncomes, yearExpenseItems, yearIncomeItems, includeReportWeights])

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
  }, [detailModal, previousMonthExpenses, previousMonthIncomes, previousYearExpenseItems, previousYearIncomeItems, includeReportWeights])

  const detailDifference = detailCurrentTotal - detailPreviousTotal
  const detailDifferencePct = detailPreviousTotal > 0
    ? (detailDifference / detailPreviousTotal) * 100
    : null

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

  const renderInteractiveLegend = (
    hiddenSeries: string[],
    onToggle: (key: string) => void,
  ) => ({ payload }: { payload?: any[] }) => {
    if (!payload?.length) return null

    return (
      <div className="flex flex-wrap gap-2 pt-2">
        {payload.map((entry: any) => {
          const dataKey = String(entry.dataKey ?? entry.value ?? '')
          const isHidden = hiddenSeries.includes(dataKey)

          return (
            <button
              key={dataKey}
              type="button"
              onClick={() => onToggle(dataKey)}
              className={`px-2 py-1 rounded-md border border-primary text-xs flex items-center gap-2 motion-standard hover-lift-subtle press-subtle ${
                isHidden ? 'opacity-50 bg-secondary' : 'bg-primary'
              }`}
              aria-pressed={!isHidden}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-primary">{entry.value}</span>
            </button>
          )
        })}
      </div>
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

    monthInvestments.forEach((investment) => {
      if (!investment.created_at) {
        return
      }

      const createdDate = new Date(investment.created_at)
      if (Number.isNaN(createdDate.getTime())) {
        return
      }

      const yearPart = createdDate.getFullYear()
      const monthPart = createdDate.getMonth() + 1

      if (yearPart !== year || monthPart !== month) {
        return
      }

      const day = createdDate.getDate()
      if (day >= 1 && day <= daysInMonth) {
        totalsByDay[day - 1].Investimentos += investment.amount
      }
    })

    return totalsByDay
  }, [monthExpenses, monthIncomes, monthInvestments, selectedMonth, includeReportWeights])

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
  }, [monthExpenses, selectedMonth, includeReportWeights])

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

  const loadingState = loading || loadingIncomes || loadingMonthExpenses || loadingMonthIncomes || loadingMonthInvestments || loadingPreviousMonthExpenses || loadingPreviousMonthIncomes || loadingAvailablePeriods
  const savingsRate = monthSummary && monthSummary.total_income > 0
    ? ((monthSummary.balance / monthSummary.total_income) * 100)
    : 0

  const controlButtonClasses = (mode: ViewMode) =>
    `px-3 py-2 rounded-lg text-sm font-medium motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
      viewMode === mode
        ? 'bg-tertiary accent-primary border border-primary'
        : 'text-primary hover:bg-tertiary border border-primary'
    }`

  const selectClasses = 'w-full px-4 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'
  const interactiveRowButtonClasses =
    'w-full rounded-lg p-2 -m-2 text-left motion-standard hover-lift-subtle press-subtle hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'

  const renderPieCard = (title: string, data: PieDatum[]) => (
    <Card className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-primary mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-secondary">Sem dados para exibir.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={86}
                labelLine={false}
                label={false}
                fill="var(--color-primary)"
                onClick={(entry: PieDatum) => {
                  if (entry.categoryId && entry.detailType) {
                    openDetailModal(entry.detailType, entry.categoryId, entry.name, entry.detailPeriod || 'month')
                  }
                }}
              >
                {data.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2 mt-3">
            {data
              .slice()
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map((item) => {
                const total = data.reduce((sum, current) => sum + current.value, 0)
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      if (item.categoryId && item.detailType) {
                        openDetailModal(item.detailType, item.categoryId, item.name, item.detailPeriod || 'month')
                      }
                    }}
                    className={`${interactiveRowButtonClasses} flex items-center justify-between gap-3 text-sm`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-primary truncate">{item.name}</span>
                    </div>
                    <span className="text-secondary flex-shrink-0">{pct}%</span>
                  </button>
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

      <div className="p-4 lg:p-6 space-y-6">
        <Card>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">Visualização</label>
              <div className="flex items-center gap-2">
                <button type="button" className={controlButtonClasses('year')} onClick={() => setViewMode('year')}>
                  Ano
                </button>
                <button type="button" className={controlButtonClasses('month')} onClick={() => setViewMode('month')}>
                  Mês
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Ano</label>
              <select
                value={selectedYear}
                onChange={(event) => {
                  const year = parseInt(event.target.value)
                  setSelectedYear(year)
                  const monthsForYear = availableMonths.filter((month) => month.startsWith(`${year}-`))
                  if (monthsForYear.length > 0) {
                    setSelectedMonth(monthsForYear[0])
                  }
                }}
                className={selectClasses}
              >
                {availableYears.length > 0 ? (
                  availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))
                ) : (
                  <option value={selectedYear}>Sem dados</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Modo dos dados</label>
              <select
                value={reportDataMode}
                onChange={(event) => setReportDataMode(event.target.value as ReportDataMode)}
                className={selectClasses}
              >
                <option value="weighted">Considerando pesos</option>
                <option value="raw">Sem considerar pesos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Mês</label>
              <select
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value)
                  setViewMode('month')
                }}
                className={selectClasses}
              >
                {yearMonths.length > 0 ? (
                  yearMonths.map((monthOption) => (
                    <option key={monthOption.value} value={monthOption.value}>{monthOption.label}</option>
                  ))
                ) : (
                  <option value={selectedMonth}>Sem meses com dados</option>
                )}
              </select>
            </div>
          </div>
          <p className="text-xs text-secondary mt-3">
            {includeReportWeights ? 'Valores ajustados pelos pesos dos lançamentos' : 'Valores brutos, sem aplicação de pesos'}
          </p>
        </Card>

        {loadingState ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : (
          <>
            {viewMode === 'year' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Rendas no ano</p>
                    <p className="text-2xl font-bold mt-2 text-income">{formatCurrency(annualTotals.income)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Despesas no ano</p>
                    <p className="text-2xl font-bold mt-2 text-expense">{formatCurrency(annualTotals.expenses)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Investimentos no ano</p>
                    <p className="text-2xl font-bold mt-2 text-balance">{formatCurrency(annualTotals.investments)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Saldo anual</p>
                    <p className="text-2xl font-bold mt-2" style={{ color: annualTotals.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                      {formatCurrency(annualTotals.balance)}
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <Card className="h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-primary mb-4">Fluxo mensal ({selectedYear})</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                        <YAxis
                          stroke="var(--color-text-secondary)"
                          fontSize={12}
                          tick={{ fill: 'var(--color-text-secondary)' }}
                          tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend content={renderInteractiveLegend(hiddenAnnualFlowSeries, toggleAnnualFlowSeries)} />
                        <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={{ r: 3 }} hide={hiddenAnnualFlowSeries.includes('Rendas')} />
                        <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={{ r: 3 }} hide={hiddenAnnualFlowSeries.includes('Despesas')} />
                        <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={{ r: 3 }} hide={hiddenAnnualFlowSeries.includes('Investimentos')} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-primary mb-4">Saldo acumulado ({selectedYear})</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={cumulativeBalanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                        <YAxis
                          stroke="var(--color-text-secondary)"
                          fontSize={12}
                          tick={{ fill: 'var(--color-text-secondary)' }}
                          tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="SaldoAcumulado" stroke="var(--color-primary)" fill="var(--color-hover)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                  {renderPieCard(`Despesas por categoria (${selectedYear})`, annualPieExpenses)}
                  {renderPieCard(`Rendas por categoria (${selectedYear})`, annualPieIncomes)}
                </div>

                <div className="space-y-4">
                  <Card className="h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-primary mb-4">Evolução mensal por categoria (despesas)</h3>
                    {annualExpenseTrendSeries.length === 0 || annualExpenseTrendVisibleData.length === 0 ? (
                      <p className="text-sm text-secondary">Sem despesas no ano selecionado.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={annualExpenseTrendVisibleData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                          <YAxis
                            stroke="var(--color-text-secondary)"
                            fontSize={12}
                            tick={{ fill: 'var(--color-text-secondary)' }}
                            tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend content={renderInteractiveLegend(hiddenExpenseSeries, toggleExpenseSeries)} />
                          {annualExpenseTrendSeries.map((series) => (
                            <Line
                              key={series.key}
                              type="monotone"
                              dataKey={series.key}
                              name={series.name}
                              stroke={series.color}
                              strokeWidth={2}
                              dot={false}
                              hide={!visibleExpenseTrendSeries.some((visible) => visible.key === series.key)}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  <Card className="h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-primary mb-4">Evolução mensal por categoria (rendas)</h3>
                    {annualIncomeTrendSeries.length === 0 || annualIncomeTrendVisibleData.length === 0 ? (
                      <p className="text-sm text-secondary">Sem rendas no ano selecionado.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={annualIncomeTrendVisibleData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                          <YAxis
                            stroke="var(--color-text-secondary)"
                            fontSize={12}
                            tick={{ fill: 'var(--color-text-secondary)' }}
                            tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend content={renderInteractiveLegend(hiddenIncomeSeries, toggleIncomeSeries)} />
                          {annualIncomeTrendSeries.map((series) => (
                            <Line
                              key={series.key}
                              type="monotone"
                              dataKey={series.key}
                              name={series.name}
                              stroke={series.color}
                              strokeWidth={2}
                              dot={false}
                              hide={!visibleIncomeTrendSeries.some((visible) => visible.key === series.key)}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
                </div>

              </div>
            ) : monthSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Rendas de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-income">{formatCurrency(monthSummary.total_income)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Despesas de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-expense">{formatCurrency(monthSummary.total_expenses)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Investimentos de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-balance">{formatCurrency(monthSummary.total_investments)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Taxa de saldo do mês</p>
                    <p className="text-2xl font-bold mt-2" style={{ color: savingsRate >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                      {`${savingsRate.toFixed(1)}%`}
                    </p>
                  </Card>
                </div>

                <Card>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-primary">Fluxo diário consolidado ({formatMonth(selectedMonth)})</h3>
                    <span className="text-sm text-secondary">Rendas, despesas e investimentos por dia</span>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyConsolidatedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        minTickGap={12}
                      />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend content={renderInteractiveLegend(hiddenDailyConsolidatedSeries, toggleDailyConsolidatedSeries)} />
                      <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} hide={hiddenDailyConsolidatedSeries.includes('Rendas')} />
                      <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} hide={hiddenDailyConsolidatedSeries.includes('Despesas')} />
                      <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} hide={hiddenDailyConsolidatedSeries.includes('Investimentos')} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <Card className="h-full flex flex-col">
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
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthQuickData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                        <YAxis
                          stroke="var(--color-text-secondary)"
                          fontSize={12}
                          tick={{ fill: 'var(--color-text-secondary)' }}
                          tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend content={renderInteractiveLegend(hiddenMonthCompositionSeries, toggleMonthCompositionSeries)} />
                        <Bar dataKey="Rendas" fill="var(--color-income)" radius={[4, 4, 0, 0]} hide={hiddenMonthCompositionSeries.includes('Rendas')} />
                        <Bar dataKey="Despesas" fill="var(--color-expense)" radius={[4, 4, 0, 0]} hide={hiddenMonthCompositionSeries.includes('Despesas')} />
                        <Bar dataKey="Investimentos" fill="var(--color-balance)" radius={[4, 4, 0, 0]} hide={hiddenMonthCompositionSeries.includes('Investimentos')} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="h-full flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-primary lg:whitespace-nowrap">Gastos por dia da semana</h3>
                      <div className="text-sm text-secondary">
                        {topWeekdayExpense && topWeekdayExpense.Despesas > 0
                          ? `Maior gasto: ${topWeekdayExpense.dia} (${formatCurrency(topWeekdayExpense.Despesas)})`
                          : `Distribuição semanal de despesas em ${formatMonth(selectedMonth)}`}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={weekdayExpenseData}>
                        <PolarGrid stroke="var(--color-border)" />
                        <PolarAngleAxis dataKey="dia" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Radar
                          name="Despesas"
                          dataKey="Despesas"
                          stroke="var(--color-expense)"
                          fill="var(--color-expense)"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                  {renderPieCard(`Despesas por categoria (${formatMonth(selectedMonth)})`, monthPieExpenses)}
                  {renderPieCard(`Rendas por categoria (${formatMonth(selectedMonth)})`, monthPieIncomes)}
                </div>

                <div className="grid grid-cols-1 gap-4 items-stretch">
                  <Card className="h-full">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-primary">Detalhamento despesas</h3>
                      <p className="text-xs text-secondary">Categorias do mês com distribuição proporcional.</p>
                    </div>
                    <div className="space-y-2">
                      {[...monthExpenseCategories]
                        .sort((a, b) => b.total - a.total)
                        .map((category) => {
                          const color = getExpenseColor(category.category_id, category.color)
                          const pct = monthExpenseTotal > 0 ? (category.total / monthExpenseTotal) * 100 : 0

                          return (
                            <button
                              key={category.category_id}
                              type="button"
                              onClick={() => openDetailModal('expense', category.category_id, category.category_name, 'month')}
                              className={`${interactiveRowButtonClasses} p-2.5`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-primary truncate">{category.category_name}</span>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-primary font-semibold flex-shrink-0">
                                  {formatCurrency(category.total)}
                                </span>
                              </div>

                              <div className="w-full h-1.5 rounded-full bg-secondary mt-2">
                                <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>

                              <p className="text-[11px] text-secondary mt-1.5">{pct.toFixed(1)}% do total</p>
                            </button>
                          )
                        })}
                    </div>
                  </Card>

                  <Card className="h-full">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-primary">Detalhamento rendas</h3>
                      <p className="text-xs text-secondary">Categorias do mês com distribuição proporcional.</p>
                    </div>
                    <div className="space-y-2">
                      {[...monthIncomeCategories]
                        .sort((a, b) => b.total - a.total)
                        .map((category) => {
                          const color = getIncomeColor(category.income_category_id, category.color)
                          const pct = monthIncomeTotal > 0 ? (category.total / monthIncomeTotal) * 100 : 0

                          return (
                            <button
                              key={category.income_category_id}
                              type="button"
                              onClick={() => openDetailModal('income', category.income_category_id, category.category_name, 'month')}
                              className={`${interactiveRowButtonClasses} p-2.5`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-primary truncate">{category.category_name}</span>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-primary font-semibold flex-shrink-0">
                                  {formatCurrency(category.total)}
                                </span>
                              </div>

                              <div className="w-full h-1.5 rounded-full bg-secondary mt-2">
                                <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>

                              <p className="text-[11px] text-secondary mt-1.5">{pct.toFixed(1)}% do total</p>
                            </button>
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
        title={`${detailModal.type === 'expense' ? 'Despesas' : 'Rendas'} • ${detailModal.categoryName}`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Comparação Mensal</p>
            <div className="rounded-lg border border-primary p-3 bg-secondary">
              <p className="text-sm text-secondary">Total em {detailModal.period === 'year' ? selectedYear : formatMonth(selectedMonth)}</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(detailCurrentTotal)}</p>
              <p className="text-sm text-secondary mt-2">Comparação com {detailModal.period === 'year' ? selectedYear - 1 : formatMonth(previousMonth)}</p>
              <p className="text-sm text-primary">
                {formatCurrency(detailPreviousTotal)}
                {' • '}
                <span style={{ color: detailDifference >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                  {detailDifference >= 0 ? '+' : ''}{formatCurrency(detailDifference)}
                  {detailDifferencePct !== null ? ` (${detailDifferencePct >= 0 ? '+' : ''}${detailDifferencePct.toFixed(1)}%)` : ''}
                </span>
              </p>
            </div>
          </div>

          {detailModal.period === 'month' && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-secondary">Metas do Mês</p>
              <div className="rounded-lg border border-primary p-3 bg-secondary">
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

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-secondary mb-2">Buscar lançamento</label>
            <input
              type="text"
              value={detailSearch}
              onChange={(event) => setDetailSearch(event.target.value)}
              placeholder="Digite parte da descrição"
              className="w-full px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            />
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Lançamentos do Mês</p>

          {filteredDetailItems.length === 0 ? (
            <p className="text-sm text-secondary">
              {yearDetailLoading && detailModal.period === 'year'
                ? 'Carregando lançamentos do ano...'
                : `Nenhum lançamento encontrado para esta categoria no ${detailModal.period === 'year' ? 'ano' : 'mês'} selecionado.`}
            </p>
          ) : (
            <div className="space-y-2">
              {visibleDetailItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-primary p-3">
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
                  <button
                    type="button"
                    onClick={() => setDetailVisibleCount((prev) => prev + DETAIL_ITEMS_STEP)}
                    className="text-xs text-secondary hover:text-primary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] rounded-md px-2 py-1"
                  >
                    Ver mais
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
