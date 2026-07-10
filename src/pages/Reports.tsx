import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePageActions, type PageActionIntent } from '@/hooks/usePageActions'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import YearSelector from '@/components/YearSelector'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useSwipeYear } from '@/hooks/useSwipeYear'
import EmptyState from '@/components/EmptyState'
import { SkeletonReports } from '@/components/Skeleton'
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
import { useDebts } from '@/hooks/useDebts'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction } from '@/types'
import { portfolioInvestmentByDay, transactionInvestmentAmount } from '@/utils/portfolioMonthlyFlow'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { addMonths, clampMonthToAppStart, formatMonth, formatMonthShort, getCurrentMonthString } from '@/utils/format'
import { Calendar, CalendarDays, GitCompareArrows, Scale } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSearchParams } from 'react-router-dom'

import CategoryDetailModal from '@/components/reports/CategoryDetailModal'
import type {
  ViewMode,
  DetailType,
  ExpenseCategorySummary,
  IncomeCategorySummary,
  TrendSeriesMeta,
  DetailModalState,
  DetailExpenseEntry,
  DetailIncomeEntry,
} from '@/types/reports'
import {
  mergeSummariesWithDebts,
  buildMonthlyFlowData,
  buildCumulativeBalanceData,
  computeAnnualTotals,
  buildPaymentMethodsBreakdown,
  buildExpenseCategoryColorMap,
  buildIncomeCategoryColorMap,
  computePeriodPending,
} from '@/utils/reportAggregation'
import { useReportCustomPeriod } from '@/hooks/useReportCustomPeriod'

import ReportCustomDateFilter from '@/components/reports/ReportCustomDateFilter'
import AnnualReportView from '@/components/reports/AnnualReportView'
import MonthlyReportView from '@/components/reports/MonthlyReportView'



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
  const [includeReportWeights, setIncludeReportWeights] = useState(true)
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    isOpen: false,
    type: 'expense',
    categoryId: '',
    categoryName: '',
    period: 'month',
  })
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
  const [monthChartTab, setMonthChartTab] = useState<'daily' | 'weekly' | 'composition' | 'balance' | 'trend'>('daily')
  const [compositionPieType, setCompositionPieType] = useState<'expense' | 'income' | 'payment'>('expense')
  const [annualCompositionPieType, setAnnualCompositionPieType] = useState<'expense' | 'income' | 'payment'>('expense')
  const [annualChartType, setAnnualChartType] = useState<'flow' | 'balance' | 'trend'>('flow')

  usePageActions([
    ...(viewMode !== 'custom'
      ? [
          {
            icon: GitCompareArrows,
            label: 'Comparação Histórica',
            intent: (compareWithPrevious ? 'income' : 'neutral') as PageActionIntent,
            onClick: () => setCompareWithPrevious(!compareWithPrevious),
            title: compareWithPrevious ? 'Desativar comparação histórica' : 'Ativar comparação histórica',
            compactOnMobile: true,
          },
        ]
      : []),
    {
      icon: Scale,
      label: includeReportWeights ? 'Desconsiderar Pesos' : 'Considerar Pesos',
      intent: (includeReportWeights ? 'balance' : 'neutral') as PageActionIntent,
      onClick: () => setIncludeReportWeights(!includeReportWeights),
      title: includeReportWeights ? 'Desconsiderar pesos nos relatórios' : 'Considerar pesos nos relatórios',
      compactOnMobile: true,
    },
  ])

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
  const swipeHandlers = viewMode === 'month' ? monthSwipe : (viewMode === 'year' ? yearSwipe : {})

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

  // WHY: efeito unificado para validar e corrigir selectedYear/selectedMonth
  // quando os períodos disponíveis mudam ou o ano selecionado fica inválido
  useEffect(() => {
    if (availableYears.length === 0) return

    // 1. Se o ano selecionado não está mais disponível, resetar
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
      return
    }

    // 2. Se o mês atual não existe no ano selecionado, encontrar fallback
    if (monthsForSelectedYear.length === 0) {
      const fallbackYear = availableYears[0]
      const fallbackMonths = availableMonths.filter((m) => m.startsWith(`${fallbackYear}-`))
      if (fallbackMonths.length > 0) {
        setSelectedYear(fallbackYear)
        if (selectedMonth !== fallbackMonths[0]) {
          setSelectedMonth(fallbackMonths[0])
        }
      }
      return
    }

    // 3. Se o mês selecionado não pertence ao ano selecionado, corrigir
    if (!monthsForSelectedYear.includes(selectedMonth)) {
      setSelectedMonth(monthsForSelectedYear[0])
    }
  }, [availableMonths, availableYears, monthsForSelectedYear, selectedMonth, selectedYear])

  const { colorPalette } = usePaletteColors()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const previousMonth = useMemo(() => addMonths(selectedMonth, -1), [selectedMonth])
  const { monthlySummaries: originalMonthlySummaries, categoryExpenses, monthlyCategoryExpenses, annualExpenses, loading } = useReports(selectedYear, includeReportWeights)
  const { incomeByCategory, monthlyIncomeByCategory, loading: loadingIncomes } = useIncomeReports(selectedYear, includeReportWeights)
  
  const previousYear = selectedYear - 1
  const { 
    monthlySummaries: originalPrevMonthlySummaries, 
    loading: loadingPrevReports 
  } = useReports(previousYear, includeReportWeights)

  const { debts } = useDebts()

  const monthlySummaries = useMemo(
    () => mergeSummariesWithDebts(originalMonthlySummaries, debts),
    [originalMonthlySummaries, debts],
  )

  const prevMonthlySummaries = useMemo(
    () => mergeSummariesWithDebts(originalPrevMonthlySummaries, debts),
    [originalPrevMonthlySummaries, debts],
  )

  const { expenses: monthExpenses, loading: loadingMonthExpenses } = useExpenses(selectedMonth)
  const { creditCards } = useCreditCards()
  const { incomes: monthIncomes, loading: loadingMonthIncomes } = useIncomes(selectedMonth)
  const { expenses: previousMonthExpenses, loading: loadingPreviousMonthExpenses } = useExpenses(previousMonth)
  const { incomes: previousMonthIncomes, loading: loadingPreviousMonthIncomes } = useIncomes(previousMonth)
  const { isOnline } = useNetworkStatus()

  const [portfolioTransactions, setPortfolioTransactions] = useState<
    Pick<PortfolioTransaction, 'id' | 'cash_offset_source_id' | 'date' | 'operation_type' | 'quantity' | 'price'>[]
  >([])
  const [previousPortfolioTransactions, setPreviousPortfolioTransactions] = useState<
    Pick<PortfolioTransaction, 'id' | 'cash_offset_source_id' | 'date' | 'operation_type' | 'quantity' | 'price'>[]
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
          .select('id, cash_offset_source_id, date, operation_type, quantity, price')
          .eq('portfolio_id', portfolio.id)
          .gte('date', `${selectedMonth}-01`)
          .lte('date', rangeEnd),
        supabase
          .from('portfolio_transactions')
          .select('id, cash_offset_source_id, date, operation_type, quantity, price')
          .eq('portfolio_id', portfolio.id)
          .gte('date', `${previousMonth}-01`)
          .lte('date', prevRangeEnd)
      ])

      if (!canceled) {
        const rawCurrent = currentRes.data || []
        const currentOffsetSourceIds = new Set(
          rawCurrent
            .map((t) => t.cash_offset_source_id)
            .filter((id): id is string => !!id)
        )
        const filteredCurrent = rawCurrent.filter(
          (t) => !t.cash_offset_source_id && !currentOffsetSourceIds.has(t.id)
        )

        const rawPrevious = previousRes.data || []
        const previousOffsetSourceIds = new Set(
          rawPrevious
            .map((t) => t.cash_offset_source_id)
            .filter((id): id is string => !!id)
        )
        const filteredPrevious = rawPrevious.filter(
          (t) => !t.cash_offset_source_id && !previousOffsetSourceIds.has(t.id)
        )

        setPortfolioTransactions(filteredCurrent)
        setPreviousPortfolioTransactions(filteredPrevious)
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

  const expenseCategoryIdToColor = useMemo(
    () => buildExpenseCategoryColorMap(categories, colorPalette),
    [categories, colorPalette],
  )

  const incomeCategoryIdToColor = useMemo(
    () => buildIncomeCategoryColorMap(incomeCategories, colorPalette),
    [incomeCategories, colorPalette],
  )

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

  // ── Hook do período customizado (DEVE vir após todas as dependências) ──
  const customData = useReportCustomPeriod(
    debts,
    creditCards,
    getAmountByMode,
    categories,
    incomeCategories,
    getExpenseColor,
    getIncomeColor,
  )

  const monthlyData = useMemo(
    () => buildMonthlyFlowData(monthlySummaries, prevMonthlySummaries, compareWithPrevious),
    [monthlySummaries, prevMonthlySummaries, compareWithPrevious],
  )

  const yearBaseExpenseTotalsMap = useMemo(() => {
    const map = new Map<string, number>()
    yearExpenseItems.forEach((exp) => {
      map.set(exp.category_id, (map.get(exp.category_id) || 0) + exp.amount)
    })
    return map
  }, [yearExpenseItems])

  const yearBaseIncomeTotalsMap = useMemo(() => {
    const map = new Map<string, number>()
    yearIncomeItems.forEach((inc) => {
      map.set(inc.income_category_id, (map.get(inc.income_category_id) || 0) + inc.amount)
    })
    return map
  }, [yearIncomeItems])

  const annualPieExpenses = useMemo(
    () =>
      categoryExpenses.map((cat: ExpenseCategorySummary) => {
        const matched = categories.find((c) => c.id === cat.category_id)
        const [_, iconName] = (matched?.color || cat.color || '').split('|')
        return {
          name: cat.category_name,
          value: cat.total,
          baseValue: yearBaseExpenseTotalsMap.get(cat.category_id) ?? cat.total,
          color: getExpenseColor(cat.category_id, cat.color),
          categoryId: cat.category_id,
          detailType: 'expense' as const,
          detailPeriod: 'year' as const,
          iconName,
        }
      }),
    [categoryExpenses, categories, getExpenseColor, yearBaseExpenseTotalsMap]
  )

  const annualPieIncomes = useMemo(
    () =>
      incomeByCategory.map((cat) => {
        const matched = incomeCategories.find((c) => c.id === cat.income_category_id)
        const [_, iconName] = (matched?.color || cat.color || '').split('|')
        return {
          name: cat.category_name,
          value: cat.total,
          baseValue: yearBaseIncomeTotalsMap.get(cat.income_category_id) ?? cat.total,
          color: getIncomeColor(cat.income_category_id, cat.color),
          categoryId: cat.income_category_id,
          detailType: 'income' as const,
          detailPeriod: 'year' as const,
          iconName,
        }
      }),
    [incomeByCategory, incomeCategories, getIncomeColor, yearBaseIncomeTotalsMap]
  )

  const annualPiePaymentMethods = useMemo(
    () => buildPaymentMethodsBreakdown(annualExpenses, creditCards, getAmountByMode),
    [annualExpenses, creditCards, getAmountByMode],
  )

  const cumulativeBalanceData = useMemo(
    () => buildCumulativeBalanceData(monthlySummaries, prevMonthlySummaries, compareWithPrevious),
    [monthlySummaries, prevMonthlySummaries, compareWithPrevious],
  )

  const annualTotals = useMemo(() => computeAnnualTotals(monthlySummaries), [monthlySummaries])

  const previousYearTotals = useMemo(() => computeAnnualTotals(prevMonthlySummaries), [prevMonthlySummaries])

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
    if (viewMode === 'month' && (monthChartTab === 'balance' || monthChartTab === 'trend')) {
      setMonthChartTab('daily')
    }
  }, [viewMode, monthChartTab])

  useEffect(() => {
    const activeSeries = viewMode === 'custom' ? customData.expenseTrendSeries : annualExpenseTrendSeries
    const validKeys = new Set(activeSeries.map((series) => series.key))
    setHiddenExpenseSeries((prev) => prev.filter((key) => validKeys.has(key)))
  }, [annualExpenseTrendSeries, customData.expenseTrendSeries, viewMode])

  useEffect(() => {
    const activeSeries = viewMode === 'custom' ? customData.incomeTrendSeries : annualIncomeTrendSeries
    const validKeys = new Set(activeSeries.map((series) => series.key))
    setHiddenIncomeSeries((prev) => prev.filter((key) => validKeys.has(key)))
  }, [annualIncomeTrendSeries, customData.incomeTrendSeries, viewMode])

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

  const baseExpenseTotalsMap = useMemo(() => {
    const map = new Map<string, number>()
    monthExpenses.forEach((exp) => {
      map.set(exp.category_id, (map.get(exp.category_id) || 0) + exp.amount)
    })
    return map
  }, [monthExpenses])

  const baseIncomeTotalsMap = useMemo(() => {
    const map = new Map<string, number>()
    monthIncomes.forEach((inc) => {
      map.set(inc.income_category_id, (map.get(inc.income_category_id) || 0) + inc.amount)
    })
    return map
  }, [monthIncomes])

  const monthPieExpenses = useMemo(() => {
    return monthExpenseCategories.map((cat: ExpenseCategorySummary) => {
      const matched = categories.find((c) => c.id === cat.category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.category_id,
        name: cat.category_name,
        value: cat.total,
        baseValue: baseExpenseTotalsMap.get(cat.category_id) ?? cat.total,
        detailType: 'expense' as const,
        detailPeriod: 'month' as const,
        color: getExpenseColor(cat.category_id, cat.color),
        iconName,
      }
    })
  }, [monthExpenseCategories, categories, getExpenseColor, baseExpenseTotalsMap])

  const monthPieIncomes = useMemo(() => {
    return monthIncomeCategories.map((cat: IncomeCategorySummary) => {
      const matched = incomeCategories.find((c) => c.id === cat.income_category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.income_category_id,
        name: cat.category_name,
        value: cat.total,
        baseValue: baseIncomeTotalsMap.get(cat.income_category_id) ?? cat.total,
        detailType: 'income' as const,
        detailPeriod: 'month' as const,
        color: getIncomeColor(cat.income_category_id, cat.color),
        iconName,
      }
    })
  }, [monthIncomeCategories, incomeCategories, getIncomeColor, baseIncomeTotalsMap])

  const monthPiePaymentMethods = useMemo(
    () => buildPaymentMethodsBreakdown(monthExpenses, creditCards, getAmountByMode),
    [monthExpenses, creditCards, getAmountByMode],
  )

  const previousMonthIncomeTotal = useMemo(() => {
    const originalIncomesTotal = previousMonthIncomes.reduce((sum, item) => sum + getAmountByMode(item), 0)
    const paidReceivables = debts
      .filter((d) => d.due_date.startsWith(previousMonth) && d.type === 'receivable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)
    return originalIncomesTotal + paidReceivables
  }, [previousMonthIncomes, getAmountByMode, debts, previousMonth])

  const previousMonthExpenseTotal = useMemo(() => {
    const originalExpensesTotal = previousMonthExpenses.reduce((sum, item) => sum + getAmountByMode(item), 0)
    const paidPayables = debts
      .filter((d) => d.due_date.startsWith(previousMonth) && d.type === 'payable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)
    return originalExpensesTotal + paidPayables
  }, [previousMonthExpenses, getAmountByMode, debts, previousMonth])

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

  const monthQuickData = useMemo(() => {
    if (!monthSummary) {
      return []
    }

    const currentData = {
      month: formatMonthShort(selectedMonth),
      Rendas: monthSummary.total_income,
      Despesas: monthSummary.total_expenses,
      Investimentos: monthSummary.total_investments,
    }

    if (compareWithPrevious && previousMonth) {
      const prevData = {
        month: `${formatMonthShort(previousMonth)} (Ant.)`,
        Rendas: previousMonthIncomeTotal,
        Despesas: previousMonthExpenseTotal,
        Investimentos: previousMonthInvestmentTotal,
      }
      return [prevData, currentData]
    }

    return [currentData]
  }, [
    monthSummary,
    selectedMonth,
    compareWithPrevious,
    previousMonth,
    previousMonthIncomeTotal,
    previousMonthExpenseTotal,
    previousMonthInvestmentTotal
  ])


  const monthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    monthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [monthExpenseLimits])

  const monthIncomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()
    monthIncomeExpectations.forEach((item) => map.set(item.income_category_id, item.expectation_amount))
    return map
  }, [monthIncomeExpectations])



  const openDetailModal = (
    type: DetailType,
    categoryId: string,
    categoryName: string,
    period: 'month' | 'year' = 'month'
  ) => {
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
      day: string | number
      date?: string
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

    const monthDebts = debts.filter((d) => d.due_date.startsWith(selectedMonth))
    monthDebts.forEach((debt) => {
      if (debt.status !== 'paid') return
      const day = Number(debt.due_date.slice(8, 10))
      if (day >= 1 && day <= daysInMonth) {
        if (debt.type === 'payable') {
          totalsByDay[day - 1].Despesas += debt.amount
        } else {
          totalsByDay[day - 1].Rendas += debt.amount
        }
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

      const prevMonthDebts = debts.filter((d) => d.due_date.startsWith(previousMonth))
      prevMonthDebts.forEach((debt) => {
        if (debt.status !== 'paid') return
        const day = Number(debt.due_date.slice(8, 10))
        if (day >= 1 && day <= prevDaysInMonth) {
          if (debt.type === 'payable') {
            prevTotalsByDay[day - 1].Despesas += debt.amount
          } else {
            prevTotalsByDay[day - 1].Rendas += debt.amount
          }
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
    previousPortfolioTransactions,
    debts
  ])

  const weekdayExpenseData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const totals = labels.map((label) => ({
      dia: label,
      Despesas: 0,
      Rendas: 0,
      Investimentos: 0,
      ...(compareWithPrevious ? { 'Despesas (Mês Ant.)': 0, 'Rendas (Mês Ant.)': 0, 'Investimentos (Mês Ant.)': 0 } : {})
    })) as Array<{
      dia: string
      Despesas: number
      Rendas: number
      Investimentos: number
      'Despesas (Mês Ant.)'?: number
      'Rendas (Mês Ant.)'?: number
      'Investimentos (Mês Ant.)'?: number
    }>

    monthExpenses.forEach((expense) => {
      if (!expense.date?.startsWith(selectedMonth)) return
      const localDate = new Date(`${expense.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) return
      const mondayFirstIndex = (localDate.getDay() + 6) % 7
      totals[mondayFirstIndex].Despesas += getAmountByMode(expense)
    })

    monthIncomes.forEach((income) => {
      if (!income.date?.startsWith(selectedMonth)) return
      const localDate = new Date(`${income.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) return
      const mondayFirstIndex = (localDate.getDay() + 6) % 7
      totals[mondayFirstIndex].Rendas += getAmountByMode(income)
    })

    portfolioTransactions.forEach((tx) => {
      const localDate = new Date(`${tx.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) return
      const mondayFirstIndex = (localDate.getDay() + 6) % 7
      totals[mondayFirstIndex].Investimentos += transactionInvestmentAmount(
        tx.operation_type,
        Number(tx.quantity),
        Number(tx.price)
      )
    })

    if (compareWithPrevious) {
      previousMonthExpenses.forEach((expense) => {
        if (!expense.date?.startsWith(previousMonth)) return
        const localDate = new Date(`${expense.date}T00:00:00`)
        if (Number.isNaN(localDate.getTime())) return
        const mondayFirstIndex = (localDate.getDay() + 6) % 7
        totals[mondayFirstIndex]['Despesas (Mês Ant.)'] = (totals[mondayFirstIndex]['Despesas (Mês Ant.)'] ?? 0) + getAmountByMode(expense)
      })

      previousMonthIncomes.forEach((income) => {
        if (!income.date?.startsWith(previousMonth)) return
        const localDate = new Date(`${income.date}T00:00:00`)
        if (Number.isNaN(localDate.getTime())) return
        const mondayFirstIndex = (localDate.getDay() + 6) % 7
        totals[mondayFirstIndex]['Rendas (Mês Ant.)'] = (totals[mondayFirstIndex]['Rendas (Mês Ant.)'] ?? 0) + getAmountByMode(income)
      })

      previousPortfolioTransactions.forEach((tx) => {
        const localDate = new Date(`${tx.date}T00:00:00`)
        if (Number.isNaN(localDate.getTime())) return
        const mondayFirstIndex = (localDate.getDay() + 6) % 7
        const amt = transactionInvestmentAmount(tx.operation_type, Number(tx.quantity), Number(tx.price))
        totals[mondayFirstIndex]['Investimentos (Mês Ant.)'] = (totals[mondayFirstIndex]['Investimentos (Mês Ant.)'] ?? 0) + amt
      })
    }

    return totals
  }, [
    monthExpenses,
    monthIncomes,
    portfolioTransactions,
    selectedMonth,
    getAmountByMode,
    compareWithPrevious,
    previousMonthExpenses,
    previousMonth,
    previousMonthIncomes,
    previousPortfolioTransactions
  ])

  const topWeekdayExpense = useMemo(() => {
    const currentData = viewMode === 'custom' ? customData.weekdayExpenseData : weekdayExpenseData
    if (currentData.length === 0) {
      return null
    }

    return currentData.reduce((highest, current) =>
      current.Despesas > highest.Despesas ? current : highest
    )
  }, [viewMode, customData.weekdayExpenseData, weekdayExpenseData])





  const loadingState = viewMode === 'custom'
    ? customData.loading
    : (loading || loadingIncomes || loadingMonthExpenses || loadingMonthIncomes || loadingPreviousMonthExpenses || loadingPreviousMonthIncomes || loadingAvailablePeriods || loadingPrevReports)

  const savingsRate = monthSummary && monthSummary.total_income > 0
    ? ((monthSummary.balance / monthSummary.total_income) * 100)
    : 0



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



  const selectedPeriodPending = useMemo(() => {
    const period = viewMode === 'month' ? selectedMonth : String(selectedYear)
    return computePeriodPending(debts, period)
  }, [debts, viewMode, selectedMonth, selectedYear])

  // Seletores ativos para alternar dinamicamente entre visualização mensal e customizada
  const activeSummary = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.summary
    }
    return monthSummary
  }, [viewMode, customData.summary, monthSummary])

  const activeExpenseCategories = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.categoryExpenses
    }
    return monthExpenseCategories
  }, [viewMode, customData.categoryExpenses, monthExpenseCategories])

  const activePieExpenses = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.pieExpenses
    }
    return monthPieExpenses
  }, [viewMode, customData.pieExpenses, monthPieExpenses])

  const activePieIncomes = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.pieIncomes
    }
    return monthPieIncomes
  }, [viewMode, customData.pieIncomes, monthPieIncomes])

  const activePiePaymentMethods = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.piePaymentMethods
    }
    return monthPiePaymentMethods
  }, [viewMode, customData.piePaymentMethods, monthPiePaymentMethods])

  const activeDailyConsolidatedData = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.dailyConsolidatedData
    }
    return dailyConsolidatedData
  }, [viewMode, customData.dailyConsolidatedData, dailyConsolidatedData])

  const activeWeekdayExpenseData = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.weekdayExpenseData
    }
    return weekdayExpenseData
  }, [viewMode, customData.weekdayExpenseData, weekdayExpenseData])

  const activeSavingsRate = useMemo(() => {
    if (viewMode === 'custom') {
      return activeSummary && activeSummary.total_income > 0
        ? ((activeSummary.balance / activeSummary.total_income) * 100)
        : 0
    }
    return savingsRate
  }, [viewMode, activeSummary, savingsRate])

  const activeLimitsExceededCount = useMemo(() => {
    if (viewMode === 'custom') {
      return 0
    }
    return limitsExceededCount
  }, [viewMode, limitsExceededCount])

  const activePeriodPending = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.pendingInfo
    }
    return selectedPeriodPending
  }, [viewMode, customData.pendingInfo, selectedPeriodPending])

  const activePeriodLabel = useMemo(() => {
    if (viewMode === 'custom') {
      const formatDateBR = (dateStr: string) => {
        if (!dateStr) return ''
        const [yyyy, mm, dd] = dateStr.split('-')
        return `${dd}/${mm}/${yyyy}`
      }
      return `${formatDateBR(customData.startDate)} a ${formatDateBR(customData.endDate)}`
    }
    return formatMonth(selectedMonth)
  }, [viewMode, customData.startDate, customData.endDate, selectedMonth])

  const activeExpensesList = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.expenses
    }
    return monthExpenses
  }, [viewMode, customData.expenses, monthExpenses])

  const activeIncomesList = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.incomes
    }
    return monthIncomes
  }, [viewMode, customData.incomes, monthIncomes])

  const activeQuickData = useMemo(() => {
    if (viewMode === 'custom') {
      return customData.quickData
    }
    return monthQuickData
  }, [viewMode, customData.quickData, monthQuickData])

  const activePendingInfo = useMemo(() => {
    if (activePeriodPending.count === 0) return null
    const periodLabel = viewMode === 'month' ? formatMonth(selectedMonth) : (viewMode === 'year' ? String(selectedYear) : activePeriodLabel)
    return {
      payables: activePeriodPending.payables,
      receivables: activePeriodPending.receivables,
      balanceProj: activePeriodPending.balanceProj,
      count: activePeriodPending.count,
      periodLabel,
    }
  }, [activePeriodPending, viewMode, selectedMonth, selectedYear, activePeriodLabel])

  // renderPendingDebtsWidget removed — now handled inside AnnualReportView and MonthlyReportView

  if (loadingState) {
    return (
      <div className="min-h-[calc(100dvh-12rem)] flex flex-col">
        <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
          <SkeletonReports />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-12rem)] flex flex-col" {...swipeHandlers}>

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
        ) : viewMode === 'year' ? (
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
        ) : (
          <ReportCustomDateFilter
            startDate={customData.startDate}
            endDate={customData.endDate}
            loading={customData.loading}
            onStartDateChange={customData.setStartDate}
            onEndDateChange={customData.setEndDate}
            onRecalculate={customData.recalculate}
          />
        )}

        {/* View mode selector for all screen sizes (replaces binary header toggle) */}
        <div className="w-full flex justify-center">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'year' | 'custom')} className="w-full max-w-md mx-auto">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="month" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 px-1 sm:px-2">
                <CalendarDays size={14} className={viewMode === 'month' ? 'text-balance' : 'text-secondary'} />
                <span>Mensal</span>
              </TabsTrigger>
              <TabsTrigger value="year" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 px-1 sm:px-2">
                <Calendar size={14} className={viewMode === 'year' ? 'text-balance' : 'text-secondary'} />
                <span>Anual</span>
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 px-1 sm:px-2">
                <CalendarDays size={14} className={viewMode === 'custom' ? 'text-balance' : 'text-secondary'} />
                <span>Período</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {includeReportWeights && (
          <div className="flex justify-center -mt-2 animate-fade-in">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-income/30 bg-income/5 text-income text-[10px] font-bold uppercase tracking-wider shadow-sm select-none">
              <Scale size={12} className="animate-pulse" />
              <span>Ajuste de impacto (pesos) ativo nos relatórios</span>
            </div>
          </div>
        )}

        <MonthTransitionView month={viewMode === 'month' ? selectedMonth : (viewMode === 'year' ? String(selectedYear) : activePeriodLabel)}>
        {loadingState ? (
          <SkeletonReports />
        ) : (
          <>            {viewMode === 'year' ? (
              <AnnualReportView
                selectedYear={selectedYear}
                compareWithPrevious={compareWithPrevious}
                monthlySummaries={monthlySummaries}
                prevMonthlySummaries={prevMonthlySummaries}
                annualTotals={annualTotals}
                previousYearTotals={previousYearTotals}
                categoryExpenses={categoryExpenses}
                annualChartType={annualChartType}
                onAnnualChartTypeChange={setAnnualChartType}
                evolutionType={evolutionType}
                onEvolutionTypeChange={setEvolutionType}
                annualExpenseTrendSeries={annualExpenseTrendSeries}
                annualIncomeTrendSeries={annualIncomeTrendSeries}
                annualExpenseTrendVisibleData={annualExpenseTrendVisibleData}
                annualIncomeTrendVisibleData={annualIncomeTrendVisibleData}
                hiddenExpenseSeries={hiddenExpenseSeries}
                hiddenIncomeSeries={hiddenIncomeSeries}
                hiddenAnnualFlowSeries={hiddenAnnualFlowSeries}
                onToggleExpenseSeries={toggleExpenseSeries}
                onToggleIncomeSeries={toggleIncomeSeries}
                onToggleAnnualFlowSeries={toggleAnnualFlowSeries}
                monthlyData={monthlyData}
                cumulativeBalanceData={cumulativeBalanceData}
                annualPieExpenses={annualPieExpenses}
                annualPieIncomes={annualPieIncomes}
                annualPiePaymentMethods={annualPiePaymentMethods}
                annualCompositionPieType={annualCompositionPieType}
                onAnnualCompositionPieTypeChange={setAnnualCompositionPieType}
                onOpenDetail={openDetailModal}
                monthExpenseLimitMap={monthExpenseLimitMap}
                monthIncomeExpectationMap={monthIncomeExpectationMap}
                pendingInfo={activePendingInfo}
              />
            ) : activeSummary ? (
              <MonthlyReportView
                viewMode={viewMode}
                activeSummary={activeSummary}
                activePeriodLabel={activePeriodLabel}
                activeSavingsRate={activeSavingsRate}
                activeDailyConsolidatedData={activeDailyConsolidatedData}
                activeExpenseCategories={activeExpenseCategories}
                activeWeekdayExpenseData={activeWeekdayExpenseData}
                activeLimitsExceededCount={activeLimitsExceededCount}
                activeQuickData={activeQuickData}
                activePieExpenses={activePieExpenses}
                activePieIncomes={activePieIncomes}
                activePiePaymentMethods={activePiePaymentMethods}
                compareWithPrevious={compareWithPrevious}
                previousMonthIncomeTotal={previousMonthIncomeTotal}
                previousMonthExpenseTotal={previousMonthExpenseTotal}
                previousMonthInvestmentTotal={previousMonthInvestmentTotal}
                previousMonthSavingsRate={previousMonthSavingsRate}
                monthChartTab={monthChartTab}
                onMonthChartTabChange={setMonthChartTab}
                topWeekdayExpense={topWeekdayExpense}
                evolutionType={evolutionType}
                onEvolutionTypeChange={setEvolutionType}
                customExpenseTrendSeries={customData.expenseTrendSeries}
                customIncomeTrendSeries={customData.incomeTrendSeries}
                customExpenseTrendVisibleData={customData.expenseTrendVisibleData}
                customIncomeTrendVisibleData={customData.incomeTrendVisibleData}
                customCumulativeBalanceData={customData.cumulativeBalanceData}
                hiddenExpenseSeries={hiddenExpenseSeries}
                hiddenIncomeSeries={hiddenIncomeSeries}
                hiddenDailyConsolidatedSeries={hiddenDailyConsolidatedSeries}
                hiddenMonthCompositionSeries={hiddenMonthCompositionSeries}
                onToggleExpenseSeries={toggleExpenseSeries}
                onToggleIncomeSeries={toggleIncomeSeries}
                onToggleDailyConsolidatedSeries={toggleDailyConsolidatedSeries}
                onToggleMonthCompositionSeries={toggleMonthCompositionSeries}
                compositionPieType={compositionPieType}
                onCompositionPieTypeChange={setCompositionPieType}
                onOpenDetail={openDetailModal}
                monthExpenseLimitMap={monthExpenseLimitMap}
                monthIncomeExpectationMap={monthIncomeExpectationMap}
                pendingInfo={activePendingInfo}
              />
            ) : (
              <EmptyState
                title="Sem dados consolidados"
                description="Nenhuma receita, despesa ou investimento encontrado para o período selecionado."
                className="border border-glass surface-glass"
              />
            )}
          </>
        )}
        </MonthTransitionView>
      </div>

      <CategoryDetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal((prev) => ({ ...prev, isOpen: false }))}
        type={detailModal.type}
        categoryId={detailModal.categoryId}
        categoryName={detailModal.categoryName}
        period={viewMode === 'custom' ? 'month' : detailModal.period}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        isOnline={isOnline}
        monthExpenses={activeExpensesList}
        monthIncomes={activeIncomesList}
        annualExpenses={annualExpenses}
        previousMonthExpenses={previousMonthExpenses}
        previousMonthIncomes={previousMonthIncomes}
        yearExpenseItems={yearExpenseItems}
        yearIncomeItems={yearIncomeItems}
        previousYearExpenseItems={previousYearExpenseItems}
        previousYearIncomeItems={previousYearIncomeItems}
        monthExpenseLimits={monthExpenseLimits}
        previousMonthExpenseLimits={previousMonthExpenseLimits}
        monthIncomeExpectations={monthIncomeExpectations}
        previousMonthIncomeExpectations={previousMonthIncomeExpectations}
        creditCards={creditCards}
        expenseCategoryIdToColor={expenseCategoryIdToColor}
        incomeCategoryIdToColor={incomeCategoryIdToColor}
        includeReportWeights={includeReportWeights}
        yearDetailLoading={yearDetailLoading}
        previousMonth={previousMonth}
        isCustomPeriod={viewMode === 'custom'}
      />

    </div>
  )
}
