import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import YearSelector from '@/components/YearSelector'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useSwipeYear } from '@/hooks/useSwipeYear'
import Card from '@/components/Card'
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
import { useDebts } from '@/hooks/useDebts'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction } from '@/types'
import { portfolioInvestmentByDay, transactionInvestmentAmount } from '@/utils/portfolioMonthlyFlow'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { addMonths, clampMonthToAppStart, formatCurrency, formatMonth, formatMonthShort, formatNumberWithTwoDecimalsBR, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { Scale, TrendingUp, TrendingDown, Wallet, Percent, Calendar, CalendarDays, GitCompareArrows, CreditCard, Coins, ArrowLeftRight, QrCode, Landmark, Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSearchParams } from 'react-router-dom'
import KpiCard from '@/components/KpiCard'
import FinancialInsights from '@/components/reports/FinancialInsights'


import AnnualFlowChart from '@/components/reports/AnnualFlowChart'
import CumulativeBalanceChart from '@/components/reports/CumulativeBalanceChart'
import WeekdayExpenseChart from '@/components/reports/WeekdayExpenseChart'
import CategoryPieChart from '@/components/reports/CategoryPieChart'
import CategoryTrendChart from '@/components/reports/CategoryTrendChart'
import MonthCompositionChart from '@/components/reports/MonthCompositionChart'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'
import CategoryDetailModal from '@/components/reports/CategoryDetailModal'

type ViewMode = 'year' | 'month' | 'custom'
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
  iconName?: string
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



type DetailExpenseEntry = {
  id: string
  amount: number
  report_weight?: number | null
  category_id: string
  date: string
  description?: string | null
  payment_method?: string | null
  credit_card_id?: string | null
  category?: {
    id?: string | null
    name?: string | null
    color?: string | null
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
    id?: string | null
    name?: string | null
    color?: string | null
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
  const [monthChartTab, setMonthChartTab] = useState<'daily' | 'weekly' | 'composition'>('daily')
  const [compositionPieType, setCompositionPieType] = useState<'expense' | 'income' | 'payment'>('expense')
  const [annualCompositionPieType, setAnnualCompositionPieType] = useState<'expense' | 'income' | 'payment'>('expense')
  const [annualChartType, setAnnualChartType] = useState<'flow' | 'balance' | 'trend'>('flow')
  const {
    dashboardReportsWeightsEnabled,
    setDashboardReportsWeightsEnabled,
  } = useAppSettings()

  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [customExpenses, setCustomExpenses] = useState<DetailExpenseEntry[]>([])
  const [customIncomes, setCustomIncomes] = useState<DetailIncomeEntry[]>([])
  const [customPortfolioTransactions, setCustomPortfolioTransactions] = useState<
    Pick<PortfolioTransaction, 'date' | 'operation_type' | 'quantity' | 'price'>[]
  >([])
  const [customLoading, setCustomLoading] = useState(false)

  // Inicializar datas personalizadas com o mês atual
  useEffect(() => {
    if (!customStartDate || !customEndDate) {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate()
      
      setCustomStartDate(`${yyyy}-${mm}-01`)
      setCustomEndDate(`${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`)
    }
  }, [customStartDate, customEndDate])

  // Função para carregar os dados customizados via Supabase
  const loadCustomData = useCallback(async () => {
    if (!customStartDate || !customEndDate) return
    setCustomLoading(true)
    try {
      // 1. Fetch expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          id,
          amount,
          report_weight,
          category_id,
          date,
          description,
          payment_method,
          credit_card_id,
          category:categories(id, name, color)
        `)
        .gte('date', customStartDate)
        .lte('date', customEndDate)

      if (expensesError) throw expensesError

      // 2. Fetch incomes
      const { data: incomesData, error: incomesError } = await supabase
        .from('incomes')
        .select(`
          id,
          amount,
          report_weight,
          income_category_id,
          date,
          description,
          income_category:income_categories(id, name, color)
        `)
        .gte('date', customStartDate)
        .lte('date', customEndDate)

      if (incomesError) throw incomesError

      // 3. Fetch portfolio transactions
      let transactions: Pick<PortfolioTransaction, 'date' | 'operation_type' | 'quantity' | 'price'>[] = []
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: portfolio } = await supabase
          .from('portfolios')
          .select('id')
          .eq('client_id', user.id)
          .maybeSingle()

        if (portfolio) {
          const { data: txs } = await supabase
            .from('portfolio_transactions')
            .select('date, operation_type, quantity, price')
            .eq('portfolio_id', portfolio.id)
            .gte('date', customStartDate)
            .lte('date', customEndDate)

          if (txs) {
            transactions = txs
          }
        }
      }

      const mappedExpenses: DetailExpenseEntry[] = (expensesData || []).map((exp) => {
        const cat = Array.isArray(exp.category) ? exp.category[0] : exp.category
        return {
          id: exp.id,
          amount: exp.amount,
          report_weight: exp.report_weight,
          category_id: exp.category_id,
          date: exp.date,
          description: exp.description,
          payment_method: exp.payment_method,
          credit_card_id: exp.credit_card_id,
          category: cat ? { id: cat.id, name: cat.name, color: cat.color } : null,
        }
      })

      const mappedIncomes: DetailIncomeEntry[] = (incomesData || []).map((inc) => {
        const cat = Array.isArray(inc.income_category) ? inc.income_category[0] : inc.income_category
        return {
          id: inc.id,
          amount: inc.amount,
          report_weight: inc.report_weight,
          income_category_id: inc.income_category_id,
          date: inc.date,
          description: inc.description,
          income_category: cat ? { id: cat.id, name: cat.name, color: cat.color } : null,
        }
      })

      setCustomExpenses(mappedExpenses)
      setCustomIncomes(mappedIncomes)
      setCustomPortfolioTransactions(transactions)
    } catch (err) {
      console.error('Erro ao carregar dados customizados:', err)
    } finally {
      setCustomLoading(false)
    }
  }, [customStartDate, customEndDate])

  // Efeito para carregar dados automaticamente ao alterar datas ou modo
  useEffect(() => {
    if (viewMode === 'custom' && customStartDate && customEndDate) {
      void loadCustomData()
    }
  }, [viewMode, customStartDate, customEndDate, loadCustomData])

  // Efeito para recarregar dados quando houver alteração local
  useEffect(() => {
    const onDataChanged = () => {
      if (viewMode === 'custom') {
        void loadCustomData()
      }
    }
    window.addEventListener('local-data-changed', onDataChanged)
    return () => {
      window.removeEventListener('local-data-changed', onDataChanged)
    }
  }, [viewMode, loadCustomData])

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
  const { monthlySummaries: originalMonthlySummaries, categoryExpenses, monthlyCategoryExpenses, annualExpenses, loading } = useReports(selectedYear, includeReportWeights)
  const { incomeByCategory, monthlyIncomeByCategory, loading: loadingIncomes } = useIncomeReports(selectedYear, includeReportWeights)
  
  const previousYear = selectedYear - 1
  const { 
    monthlySummaries: originalPrevMonthlySummaries, 
    loading: loadingPrevReports 
  } = useReports(previousYear, includeReportWeights)

  const { debts } = useDebts()

  const monthlySummaries = useMemo(() => {
    return originalMonthlySummaries.map((s) => {
      const monthDebts = debts.filter((d) => d.due_date.startsWith(s.month))
      
      const paidReceivables = monthDebts
        .filter((d) => d.type === 'receivable' && d.status === 'paid')
        .reduce((sum, d) => sum + d.amount, 0)
        
      const paidPayables = monthDebts
        .filter((d) => d.type === 'payable' && d.status === 'paid')
        .reduce((sum, d) => sum + d.amount, 0)

      const total_income = s.total_income + paidReceivables
      const total_expenses = s.total_expenses + paidPayables
      const balance = total_income - total_expenses - s.total_investments

      return {
        ...s,
        total_income,
        total_expenses,
        balance,
      }
    })
  }, [originalMonthlySummaries, debts])

  const prevMonthlySummaries = useMemo(() => {
    return originalPrevMonthlySummaries.map((s) => {
      const monthDebts = debts.filter((d) => d.due_date.startsWith(s.month))
      
      const paidReceivables = monthDebts
        .filter((d) => d.type === 'receivable' && d.status === 'paid')
        .reduce((sum, d) => sum + d.amount, 0)
        
      const paidPayables = monthDebts
        .filter((d) => d.type === 'payable' && d.status === 'paid')
        .reduce((sum, d) => sum + d.amount, 0)

      const total_income = s.total_income + paidReceivables
      const total_expenses = s.total_expenses + paidPayables
      const balance = total_income - total_expenses - s.total_investments

      return {
        ...s,
        total_income,
        total_expenses,
        balance,
      }
    })
  }, [originalPrevMonthlySummaries, debts])

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
      categoryExpenses.map((cat: ExpenseCategorySummary) => {
        const matched = categories.find((c) => c.id === cat.category_id)
        const [_, iconName] = (matched?.color || cat.color || '').split('|')
        return {
          name: cat.category_name,
          value: cat.total,
          color: getExpenseColor(cat.category_id, cat.color),
          categoryId: cat.category_id,
          detailType: 'expense' as DetailType,
          detailPeriod: 'year' as const,
          iconName,
        }
      }),
    [categoryExpenses, categories, getExpenseColor]
  )

  const annualPieIncomes = useMemo(
    () =>
      incomeByCategory.map((cat) => {
        const matched = incomeCategories.find((c) => c.id === cat.income_category_id)
        const [_, iconName] = (matched?.color || cat.color || '').split('|')
        return {
          name: cat.category_name,
          value: cat.total,
          color: getIncomeColor(cat.income_category_id, cat.color),
          categoryId: cat.income_category_id,
          detailType: 'income' as DetailType,
          detailPeriod: 'year' as const,
          iconName,
        }
      }),
    [incomeByCategory, incomeCategories, getIncomeColor]
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
  const monthPieExpenses = useMemo(() => {
    return monthExpenseCategories.map((cat: ExpenseCategorySummary) => {
      const matched = categories.find((c) => c.id === cat.category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.category_id,
        name: cat.category_name,
        value: cat.total,
        detailType: 'expense' as DetailType,
        detailPeriod: 'month' as const,
        color: getExpenseColor(cat.category_id, cat.color),
        iconName,
      }
    })
  }, [monthExpenseCategories, categories, getExpenseColor])

  const monthPieIncomes = useMemo(() => {
    return monthIncomeCategories.map((cat: IncomeCategorySummary) => {
      const matched = incomeCategories.find((c) => c.id === cat.income_category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.income_category_id,
        name: cat.category_name,
        value: cat.total,
        detailType: 'income' as DetailType,
        detailPeriod: 'month' as const,
        color: getIncomeColor(cat.income_category_id, cat.color),
        iconName,
      }
    })
  }, [monthIncomeCategories, incomeCategories, getIncomeColor])

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

  // Mapeamento de despesas por categoria no período customizado
  const customCategoryExpenses = useMemo(() => {
    const expenseCategoryMap = new Map<string, { category_id: string; category_name: string; total: number; color: string }>()
    customExpenses.forEach((exp) => {
      const catId = exp.category_id
      const cat = exp.category as { id?: string; name?: string; color?: string } | null
      const total = getAmountByMode(exp)
      if (!expenseCategoryMap.has(catId)) {
        expenseCategoryMap.set(catId, {
          category_id: catId,
          category_name: cat?.name ?? 'Sem categoria',
          total: 0,
          color: cat?.color ?? 'var(--category-fallback-neutral)',
        })
      }
      expenseCategoryMap.get(catId)!.total += total
    })
    return Array.from(expenseCategoryMap.values())
  }, [customExpenses, getAmountByMode])

  // Mapeamento de receitas por categoria no período customizado
  const customCategoryIncomes = useMemo(() => {
    const incomeCategoryMap = new Map<string, { income_category_id: string; category_name: string; total: number; color: string }>()
    customIncomes.forEach((inc) => {
      const catId = inc.income_category_id
      const cat = inc.income_category as { id?: string; name?: string; color?: string } | null
      const total = getAmountByMode(inc)
      if (!incomeCategoryMap.has(catId)) {
        incomeCategoryMap.set(catId, {
          income_category_id: catId,
          category_name: cat?.name ?? 'Sem categoria',
          total: 0,
          color: cat?.color ?? 'var(--category-fallback-neutral)',
        })
      }
      incomeCategoryMap.get(catId)!.total += total
    })
    return Array.from(incomeCategoryMap.values())
  }, [customIncomes, getAmountByMode])

  // Gráfico de Pizza: despesas customizadas
  const customPieExpenses = useMemo(() => {
    return customCategoryExpenses.map((cat) => {
      const matched = categories.find((c) => c.id === cat.category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.category_id,
        name: cat.category_name,
        value: cat.total,
        detailType: 'expense' as DetailType,
        detailPeriod: 'month' as const,
        color: getExpenseColor(cat.category_id, cat.color),
        iconName,
      }
    })
  }, [customCategoryExpenses, categories, getExpenseColor])

  // Gráfico de Pizza: receitas customizadas
  const customPieIncomes = useMemo(() => {
    return customCategoryIncomes.map((cat) => {
      const matched = incomeCategories.find((c) => c.id === cat.income_category_id)
      const [_, iconName] = (matched?.color || cat.color || '').split('|')
      return {
        categoryId: cat.income_category_id,
        name: cat.category_name,
        value: cat.total,
        detailType: 'income' as DetailType,
        detailPeriod: 'month' as const,
        color: getIncomeColor(cat.income_category_id, cat.color),
        iconName,
      }
    })
  }, [customCategoryIncomes, incomeCategories, getIncomeColor])

  // Gráfico de Pizza: meios de pagamento customizados
  const customPiePaymentMethods = useMemo(() => {
    const methodsMap = new Map<string, number>()
    const cardsMap = new Map<string, number>()

    customExpenses.forEach((exp) => {
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
  }, [customExpenses, creditCards, getAmountByMode])

  // Distribuição semanal de despesas customizadas
  const customWeekdayExpenseData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const totals = labels.map((label) => ({
      dia: label,
      Despesas: 0,
    }))

    customExpenses.forEach((expense) => {
      const localDate = new Date(`${expense.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) {
        return
      }

      const dayOfWeek = localDate.getDay()
      const mondayFirstIndex = (dayOfWeek + 6) % 7
      totals[mondayFirstIndex].Despesas += getAmountByMode(expense)
    })

    return totals
  }, [customExpenses, getAmountByMode])

  // Valores consolidados customizados
  const customSummary = useMemo(() => {
    const rawExpenses = customExpenses.reduce((sum, exp) => sum + getAmountByMode(exp), 0)
    const paidPayables = debts
      .filter((d) => d.due_date >= customStartDate && d.due_date <= customEndDate && d.type === 'payable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)
    const total_expenses = rawExpenses + paidPayables

    const rawIncomes = customIncomes.reduce((sum, inc) => sum + getAmountByMode(inc), 0)
    const paidReceivables = debts
      .filter((d) => d.due_date >= customStartDate && d.due_date <= customEndDate && d.type === 'receivable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)
    const total_income = rawIncomes + paidReceivables

    const total_investments = customPortfolioTransactions.reduce((sum, tx) => {
      return (
        sum +
        transactionInvestmentAmount(
          tx.operation_type,
          Number(tx.quantity),
          Number(tx.price)
        )
      )
    }, 0)

    const balance = total_income - total_expenses - total_investments

    return {
      total_income,
      total_expenses,
      total_investments,
      balance,
    }
  }, [customExpenses, customIncomes, customPortfolioTransactions, debts, customStartDate, customEndDate, getAmountByMode])

  // Fluxo diário consolidado customizado
  const customDailyConsolidatedData = useMemo(() => {
    if (!customStartDate || !customEndDate) {
      return []
    }

    const start = new Date(`${customStartDate}T00:00:00`)
    const end = new Date(`${customEndDate}T00:00:00`)
    
    // Proteção de loop infinito para ranges gigantes
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      end.setTime(start.getTime() + 366 * 24 * 60 * 60 * 1000)
    }

    const totalsByDay: Array<{
      day: string | number
      date?: string
      label: string
      Rendas: number
      Despesas: number
      Investimentos: number
      'Rendas (Mês Ant.)'?: number
      'Despesas (Mês Ant.)'?: number
      'Investimentos (Mês Ant.)'?: number
    }> = []

    const current = new Date(start)
    while (current <= end) {
      const yyyy = current.getFullYear()
      const mm = String(current.getMonth() + 1).padStart(2, '0')
      const dd = String(current.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const label = `${dd}/${mm}`
      totalsByDay.push({
        day: dateStr,
        date: dateStr,
        label,
        Rendas: 0,
        Despesas: 0,
        Investimentos: 0,
      })
      current.setDate(current.getDate() + 1)
    }

    customExpenses.forEach((expense) => {
      const match = totalsByDay.find((d) => d.date === expense.date)
      if (match) {
        match.Despesas += getAmountByMode(expense)
      }
    })

    customIncomes.forEach((income) => {
      const match = totalsByDay.find((d) => d.date === income.date)
      if (match) {
        match.Rendas += getAmountByMode(income)
      }
    })

    const customRangeDebts = debts.filter((d) => d.due_date >= customStartDate && d.due_date <= customEndDate)
    customRangeDebts.forEach((debt) => {
      if (debt.status !== 'paid') return
      const match = totalsByDay.find((d) => d.date === debt.due_date)
      if (match) {
        if (debt.type === 'payable') {
          match.Despesas += debt.amount
        } else {
          match.Rendas += debt.amount
        }
      }
    })

    customPortfolioTransactions.forEach((tx) => {
      const match = totalsByDay.find((d) => d.date === tx.date)
      if (match) {
        const amount = transactionInvestmentAmount(
          tx.operation_type,
          Number(tx.quantity),
          Number(tx.price)
        )
        const outflow = amount > 0 ? amount : 0
        match.Investimentos += outflow
      }
    })

    return totalsByDay
  }, [customExpenses, customIncomes, customPortfolioTransactions, debts, customStartDate, customEndDate, getAmountByMode])

  // Composição de saldo customizada
  const customQuickData = useMemo(() => {
    if (!customSummary) {
      return []
    }

    return [{
      month: 'Período',
      Rendas: customSummary.total_income,
      Despesas: customSummary.total_expenses,
      Investimentos: customSummary.total_investments,
    }]
  }, [customSummary])



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
      ...(compareWithPrevious ? { 'Despesas (Mês Ant.)': 0 } : {})
    })) as Array<{
      dia: string
      Despesas: number
      'Despesas (Mês Ant.)'?: number
    }>

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

    if (compareWithPrevious && previousMonthExpenses.length > 0) {
      previousMonthExpenses.forEach((expense) => {
        if (!expense.date?.startsWith(previousMonth)) {
          return
        }

        const localDate = new Date(`${expense.date}T00:00:00`)
        if (Number.isNaN(localDate.getTime())) {
          return
        }

        const dayOfWeek = localDate.getDay()
        const mondayFirstIndex = (dayOfWeek + 6) % 7
        if (totals[mondayFirstIndex]) {
          totals[mondayFirstIndex]['Despesas (Mês Ant.)'] = (totals[mondayFirstIndex]['Despesas (Mês Ant.)'] ?? 0) + getAmountByMode(expense)
        }
      })
    }

    return totals
  }, [
    monthExpenses,
    selectedMonth,
    getAmountByMode,
    compareWithPrevious,
    previousMonthExpenses,
    previousMonth
  ])

  const topWeekdayExpense = useMemo(() => {
    const currentData = viewMode === 'custom' ? customWeekdayExpenseData : weekdayExpenseData
    if (currentData.length === 0) {
      return null
    }

    return currentData.reduce((highest, current) =>
      current.Despesas > highest.Despesas ? current : highest
    )
  }, [viewMode, customWeekdayExpenseData, weekdayExpenseData])





  const loadingState = viewMode === 'custom'
    ? customLoading
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
                        iconName={item.iconName}
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

  const selectedPeriodPending = useMemo(() => {
    const period = viewMode === 'month' ? selectedMonth : String(selectedYear)
    const filtered = debts.filter((d) => d.due_date.startsWith(period) && d.status === 'pending')
    
    const payables = filtered.filter((d) => d.type === 'payable').reduce((sum, d) => sum + d.amount, 0)
    const receivables = filtered.filter((d) => d.type === 'receivable').reduce((sum, d) => sum + d.amount, 0)
    const balanceProj = receivables - payables

    return {
      payables,
      receivables,
      balanceProj,
      count: filtered.length,
    }
  }, [debts, viewMode, selectedMonth, selectedYear])

  // Seletores ativos para alternar dinamicamente entre visualização mensal e customizada
  const activeSummary = useMemo(() => {
    if (viewMode === 'custom') {
      return customSummary
    }
    return monthSummary
  }, [viewMode, customSummary, monthSummary])

  const activeExpenseCategories = useMemo(() => {
    if (viewMode === 'custom') {
      return customCategoryExpenses
    }
    return monthExpenseCategories
  }, [viewMode, customCategoryExpenses, monthExpenseCategories])

  const activePieExpenses = useMemo(() => {
    if (viewMode === 'custom') {
      return customPieExpenses
    }
    return monthPieExpenses
  }, [viewMode, customPieExpenses, monthPieExpenses])

  const activePieIncomes = useMemo(() => {
    if (viewMode === 'custom') {
      return customPieIncomes
    }
    return monthPieIncomes
  }, [viewMode, customPieIncomes, monthPieIncomes])

  const activePiePaymentMethods = useMemo(() => {
    if (viewMode === 'custom') {
      return customPiePaymentMethods
    }
    return monthPiePaymentMethods
  }, [viewMode, customPiePaymentMethods, monthPiePaymentMethods])

  const activeDailyConsolidatedData = useMemo(() => {
    if (viewMode === 'custom') {
      return customDailyConsolidatedData
    }
    return dailyConsolidatedData
  }, [viewMode, customDailyConsolidatedData, dailyConsolidatedData])

  const activeWeekdayExpenseData = useMemo(() => {
    if (viewMode === 'custom') {
      return customWeekdayExpenseData
    }
    return weekdayExpenseData
  }, [viewMode, customWeekdayExpenseData, weekdayExpenseData])

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
      const filtered = debts.filter((d) => d.due_date >= customStartDate && d.due_date <= customEndDate && d.status === 'pending')
      const payables = filtered.filter((d) => d.type === 'payable').reduce((sum, d) => sum + d.amount, 0)
      const receivables = filtered.filter((d) => d.type === 'receivable').reduce((sum, d) => sum + d.amount, 0)
      const balanceProj = receivables - payables
      return {
        payables,
        receivables,
        balanceProj,
        count: filtered.length,
      }
    }
    return selectedPeriodPending
  }, [viewMode, debts, customStartDate, customEndDate, selectedPeriodPending])

  const activePeriodLabel = useMemo(() => {
    if (viewMode === 'custom') {
      const formatDateBR = (dateStr: string) => {
        if (!dateStr) return ''
        const [yyyy, mm, dd] = dateStr.split('-')
        return `${dd}/${mm}/${yyyy}`
      }
      return `${formatDateBR(customStartDate)} a ${formatDateBR(customEndDate)}`
    }
    return formatMonth(selectedMonth)
  }, [viewMode, customStartDate, customEndDate, selectedMonth])

  const activeExpensesList = useMemo(() => {
    if (viewMode === 'custom') {
      return customExpenses
    }
    return monthExpenses
  }, [viewMode, customExpenses, monthExpenses])

  const activeIncomesList = useMemo(() => {
    if (viewMode === 'custom') {
      return customIncomes
    }
    return monthIncomes
  }, [viewMode, customIncomes, monthIncomes])

  const activeQuickData = useMemo(() => {
    if (viewMode === 'custom') {
      return customQuickData
    }
    return monthQuickData
  }, [viewMode, customQuickData, monthQuickData])

  const renderPendingDebtsWidget = () => {
    if (activePeriodPending.count === 0) return null

    return (
      <Card className="border border-glass surface-glass shadow-sm transition-all duration-300 p-4 sm:p-5">
        <div className="flex items-center gap-3 border-b border-glass/40 pb-3 mb-4">
          <Landmark className="text-secondary" size={20} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              Projeção de Pendências (A Pagar & Receber)
            </h3>
            <p className="text-[10px] text-secondary mt-0.5">
              Valores em aberto com vencimento em {viewMode === 'month' ? formatMonth(selectedMonth) : (viewMode === 'year' ? selectedYear : activePeriodLabel)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col p-3 rounded-xl bg-expense/5 border border-expense/10">
            <span className="text-[10px] uppercase font-bold text-expense/80 tracking-wider">A Pagar Pendente</span>
            <span className="text-lg font-extrabold text-expense font-mono mt-1">
              {formatCurrency(activePeriodPending.payables)}
            </span>
          </div>
          <div className="flex flex-col p-3 rounded-xl bg-income/5 border border-income/10">
            <span className="text-[10px] uppercase font-bold text-income/80 tracking-wider">A Receber Pendente</span>
            <span className="text-lg font-extrabold text-income font-mono mt-1">
              {formatCurrency(activePeriodPending.receivables)}
            </span>
          </div>
          <div className={`flex flex-col p-3 rounded-xl border ${
            activePeriodPending.balanceProj >= 0 
              ? 'bg-income/5 border-income/10' 
              : 'bg-expense/5 border-expense/10'
          }`}>
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">Impacto Projetado no Saldo</span>
            <span className={`text-lg font-extrabold font-mono mt-1 ${
              activePeriodPending.balanceProj >= 0 ? 'text-income' : 'text-expense'
            }`}>
              {activePeriodPending.balanceProj >= 0 ? '+' : ''}{formatCurrency(activePeriodPending.balanceProj)}
            </span>
          </div>
        </div>
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
            {/* Pesos: cinza quando desativado, âmbar quando ativo */}
            <PageHeaderActionButton
              key="weights-toggle"
              intent={dashboardReportsWeightsEnabled ? 'warning' : 'neutral'}
              icon={Scale}
              label="Pesos dos Lançamentos"
              onClick={() => setDashboardReportsWeightsEnabled(!dashboardReportsWeightsEnabled)}
              title={dashboardReportsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
            />
            {/* Comparar: ícone fixo GitCompareArrows, cinza quando inativo, verde quando ativo (escondido no modo customizado) */}
            {viewMode !== 'custom' && (
              <PageHeaderActionButton
                key="compare-previous-toggle"
                intent={compareWithPrevious ? 'income' : 'neutral'}
                icon={GitCompareArrows}
                label="Comparação Histórica"
                onClick={() => setCompareWithPrevious(!compareWithPrevious)}
                title={compareWithPrevious ? 'Desativar comparação histórica' : 'Ativar comparação histórica'}
              />
            )}
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
          <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 font-sans">
                  Data de Início
                </label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-secondary/5 border-glass text-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 font-sans">
                  Data de Fim
                </label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-secondary/5 border-glass text-primary"
                />
              </div>
              <Button
                type="button"
                onClick={loadCustomData}
                disabled={customLoading}
                className="shrink-0 font-bold px-6 py-2.5 h-10 flex items-center justify-center gap-2"
              >
                {customLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <CalendarDays size={16} />
                    Recalcular
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* View mode selector for all screen sizes (replaces binary header toggle) */}
        <div className="w-full flex justify-center">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'year' | 'custom')} className="w-full max-w-md mx-auto">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="month" className="text-xs font-bold gap-1.5">
                <CalendarDays size={14} className={viewMode === 'month' ? 'text-balance' : 'text-secondary'} />
                <span>Mensal</span>
              </TabsTrigger>
              <TabsTrigger value="year" className="text-xs font-bold gap-1.5">
                <Calendar size={14} className={viewMode === 'year' ? 'text-balance' : 'text-secondary'} />
                <span>Anual</span>
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs font-bold gap-1.5">
                <CalendarDays size={14} className={viewMode === 'custom' ? 'text-balance' : 'text-secondary'} />
                <span>Personalizado</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <MonthTransitionView month={viewMode === 'month' ? selectedMonth : (viewMode === 'year' ? String(selectedYear) : activePeriodLabel)}>
        {loadingState ? (
          <Loader text="Carregando dados..." className="py-12" />
        ) : (
          <>
            {viewMode === 'year' ? (
              <div className="flex flex-col gap-6 animate-stagger">
                {/* KPIs Anuais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch">
                  <KpiCard
                    title="Rendas no ano"
                    value={formatCurrency(annualTotals.income)}
                    subtext={`Total acumulado em ${selectedYear}`}
                    icon={<TrendingUp size={16} />}
                    glowColor="var(--color-income)"
                    showGlow={true}
                    sparklineData={monthlySummaries.map((s) => s.total_income)}
                    compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.total_income) : undefined}
                    trendPercent={previousYearTotals.income > 0 
                      ? ((annualTotals.income - previousYearTotals.income) / previousYearTotals.income) * 100 
                      : null}
                    index={1}
                  />
                  <KpiCard
                    title="Despesas no ano"
                    value={formatCurrency(annualTotals.expenses)}
                    subtext={`Total acumulado em ${selectedYear}`}
                    icon={<TrendingDown size={16} />}
                    glowColor="var(--color-expense)"
                    showGlow={true}
                    isDespesa={true}
                    sparklineData={monthlySummaries.map((s) => s.total_expenses)}
                    compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.total_expenses) : undefined}
                    trendPercent={previousYearTotals.expenses > 0 
                      ? ((annualTotals.expenses - previousYearTotals.expenses) / previousYearTotals.expenses) * 100 
                      : null}
                    index={2}
                  />
                  <KpiCard
                    title="Investimentos no ano"
                    value={formatCurrency(annualTotals.investments)}
                    subtext={`Total acumulado em ${selectedYear}`}
                    icon={<Wallet size={16} />}
                    glowColor="var(--color-balance)"
                    showGlow={false}
                    sparklineData={monthlySummaries.map((s) => s.total_investments)}
                    compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.total_investments) : undefined}
                    trendPercent={previousYearTotals.investments > 0 
                      ? ((annualTotals.investments - previousYearTotals.investments) / previousYearTotals.investments) * 100 
                      : null}
                    index={3}
                  />
                  <KpiCard
                    title="Saldo anual"
                    value={formatCurrency(annualTotals.balance)}
                    subtext="Balanço final consolidado"
                    icon={<Percent size={16} />}
                    glowColor={annualTotals.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
                    showGlow={annualTotals.balance < 0}
                    sparklineData={monthlySummaries.map((s) => s.balance)}
                    compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.balance) : undefined}
                    trendPercent={previousYearTotals.balance !== 0
                      ? ((annualTotals.balance - previousYearTotals.balance) / Math.abs(previousYearTotals.balance)) * 100
                      : null}
                    index={4}
                  />
                </div>

                {/* Pendências de Dívidas */}
                {renderPendingDebtsWidget()}

                {/* Insights Anuais */}
                <div className="order-last lg:order-none">
                  <FinancialInsights
                    viewMode="year"
                    periodLabel={String(selectedYear)}
                    incomeTotal={annualTotals.income}
                    expenseTotal={annualTotals.expenses}
                    savingsRate={annualTotals.income > 0 ? (annualTotals.balance / annualTotals.income) * 100 : 0}
                    categoryExpenses={categoryExpenses}
                    previousExpenseTotal={previousYearTotals.expenses}
                  />
                </div>

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
            ) : activeSummary ? (
              <div className="flex flex-col gap-6 animate-stagger">
                {/* KPIs Mensais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch">
                  <KpiCard
                    title={viewMode === 'custom' ? "Rendas no período" : "Rendas do mês"}
                    value={formatCurrency(activeSummary.total_income)}
                    subtext="Receitas consolidadas"
                    icon={<TrendingUp size={16} />}
                    glowColor="var(--color-income)"
                    showGlow={true}
                    sparklineData={activeDailyConsolidatedData.map((d) => d.Rendas)}
                    compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => d['Rendas (Mês Ant.)'] ?? 0) : undefined}
                    trendPercent={viewMode === 'custom' ? null : (previousMonthIncomeTotal > 0 
                      ? ((activeSummary.total_income - previousMonthIncomeTotal) / previousMonthIncomeTotal) * 100 
                      : null)}
                    index={1}
                  />
                  <KpiCard
                    title={viewMode === 'custom' ? "Despesas no período" : "Despesas do mês"}
                    value={formatCurrency(activeSummary.total_expenses)}
                    subtext="Despesas consolidadas"
                    icon={<TrendingDown size={16} />}
                    glowColor="var(--color-expense)"
                    showGlow={true}
                    isDespesa={true}
                    sparklineData={activeDailyConsolidatedData.map((d) => d.Despesas)}
                    compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => d['Despesas (Mês Ant.)'] ?? 0) : undefined}
                    trendPercent={viewMode === 'custom' ? null : (previousMonthExpenseTotal > 0 
                      ? ((activeSummary.total_expenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100 
                      : null)}
                    index={2}
                  />
                  <KpiCard
                    title={viewMode === 'custom' ? "Investimentos no período" : "Investimentos do mês"}
                    value={formatCurrency(activeSummary.total_investments)}
                    subtext="Investimentos em ativos"
                    icon={<Wallet size={16} />}
                    glowColor="var(--color-balance)"
                    showGlow={false}
                    sparklineData={activeDailyConsolidatedData.map((d) => d.Investimentos)}
                    compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => d['Investimentos (Mês Ant.)'] ?? 0) : undefined}
                    trendPercent={viewMode === 'custom' ? null : (previousMonthInvestmentTotal > 0 
                      ? ((activeSummary.total_investments - previousMonthInvestmentTotal) / previousMonthInvestmentTotal) * 100 
                      : null)}
                    index={3}
                  />
                  <KpiCard
                    title="Taxa de saldo"
                    value={`${formatNumberWithTwoDecimalsBR(activeSavingsRate)}%`}
                    subtext={`Saldo líquido: ${formatCurrency(activeSummary.balance)}`}
                    icon={<Percent size={16} />}
                    glowColor={activeSavingsRate >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
                    showGlow={activeSavingsRate < 0}
                    sparklineData={activeDailyConsolidatedData.map((d) => d.Rendas - d.Despesas - d.Investimentos)}
                    compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => (d['Rendas (Mês Ant.)'] ?? 0) - (d['Despesas (Mês Ant.)'] ?? 0) - (d['Investimentos (Mês Ant.)'] ?? 0)) : undefined}
                    trendPercent={viewMode === 'custom' ? null : (previousMonthIncomeTotal > 0 
                      ? activeSavingsRate - previousMonthSavingsRate 
                      : null)}
                    trendSuffix=" pp"
                    index={4}
                  />
                </div>

                {/* Pendências de Dívidas */}
                {renderPendingDebtsWidget()}

                {/* Insights Mensais */}
                <div className="order-last lg:order-none">
                  <FinancialInsights
                    viewMode={viewMode === 'custom' ? 'month' : viewMode}
                    periodLabel={activePeriodLabel}
                    incomeTotal={activeSummary.total_income}
                    expenseTotal={activeSummary.total_expenses}
                    savingsRate={activeSavingsRate}
                    categoryExpenses={activeExpenseCategories}
                    previousExpenseTotal={viewMode === 'custom' ? 0 : previousMonthExpenseTotal}
                    weekdayExpenses={activeWeekdayExpenseData}
                    limitsExceededCount={activeLimitsExceededCount}
                  />
                </div>

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
                           {monthChartTab === 'daily' ? `Rendas, despesas e investimentos por dia em ${activePeriodLabel}` :
                            monthChartTab === 'weekly' ? (topWeekdayExpense && topWeekdayExpense.Despesas > 0
                              ? `Maior gasto: ${topWeekdayExpense.dia} (${formatCurrency(topWeekdayExpense.Despesas)})`
                              : `Distribuição semanal de despesas em ${activePeriodLabel}`) :
                            `Proporções e saldos consolidados no período`}
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
                          data={activeDailyConsolidatedData}
                          hiddenSeries={hiddenDailyConsolidatedSeries}
                          onToggleSeries={toggleDailyConsolidatedSeries}
                          xAxisKey="label"
                        />
                      )}
                      {monthChartTab === 'weekly' && (
                        <WeekdayExpenseChart data={activeWeekdayExpenseData} />
                      )}
                      {monthChartTab === 'composition' && (
                        <MonthCompositionChart
                          data={activeQuickData}
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
                    activePeriodLabel,
                    activePieExpenses,
                    activePieIncomes,
                    activePiePaymentMethods,
                    false
                  )}
                </div>
              </div>
            ) : (
              <Card className="border border-glass surface-glass text-center py-10">
                <p className="text-secondary">Sem dados consolidados para o período selecionado.</p>
              </Card>
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
