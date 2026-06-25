import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import KpiCard from '@/components/KpiCard'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { addMonths, formatCurrency, formatDate, formatMonth, formatNumberWithTwoDecimalsBR, getCurrentMonthString } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, Plus, Percent } from 'lucide-react'
import ScrollToTop from '@/components/ScrollToTop'
import Button from '@/components/Button'
import MobileAlertsPill from '@/components/MobileAlertsPill'
import QuickLaunchOption from '@/components/dashboard/QuickLaunchOption'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction } from '@/types'
import {
  portfolioInvestmentByDay,
  sumPortfolioTransactionsForMonth,
} from '@/utils/portfolioMonthlyFlow'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import IncomeFormModal from '@/components/IncomeFormModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'
import CategoryDetailMiniChart from '@/components/reports/CategoryDetailMiniChart'
import FinancialInsights from '@/components/reports/FinancialInsights'
import DailyBudgetAdvisor from '@/components/dashboard/DailyBudgetAdvisor'
import SmartLimitSuggestions from '@/components/dashboard/SmartLimitSuggestions'
import LimitsControl from '@/components/dashboard/LimitsControl'

const EXPENSE_LIMIT_WARNING_THRESHOLD = 85

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const swipeHandlers = useSwipeMonth(currentMonth, setCurrentMonth)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [isIncomeOpen, setIsIncomeOpen] = useState(false)
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false)
  const { isOnline } = useNetworkStatus()
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState<string[]>([])
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<{ id: string; name: string } | null>(null)

  // Alerts and notifications are handled globally via NotificationsContext

  const [portfolioId, setPortfolioId] = useState('')
  const [portfolioTransactions, setPortfolioTransactions] = useState<PortfolioTransaction[]>([])

  const loadPortfolioTransactions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle()

      if (!portfolio) {
        const { data: newPort, error: createError } = await supabase
          .from('portfolios')
          .insert({ client_id: user.id, cash_balance: 0 })
          .select('id')
          .single()

        if (createError) throw createError
        portfolio = newPort
      }

      setPortfolioId(portfolio.id)

      const transactions = await fetchAllPortfolioTransactions(portfolio.id, {
        select: 'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at'
      })
      setPortfolioTransactions(transactions)
    } catch (err) {
      console.error('Erro ao carregar livro-razão no dashboard:', err)
      setPortfolioId('')
      setPortfolioTransactions([])
    }
  }, [])



  const lastFetchedMonthRef = useRef<string | null>(null)
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false)
  const isDataChangingRef = useRef(false)

  const { colorPalette } = usePaletteColors()
  const { categories, loading: categoriesLoading } = useCategories()
  const { incomeCategories, loading: incomeCategoriesLoading } = useIncomeCategories()
  const { creditCards } = useCreditCards()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { incomes: previousMonthIncomes } = useIncomes(previousMonth)
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading, setCategoryLimit, refreshLimits } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)

  const navigate = useNavigate()

  useEffect(() => {
    const isReady = !expensesLoading && !incomesLoading && !categoriesLoading && !incomeCategoriesLoading
    if (isReady && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [expensesLoading, incomesLoading, categoriesLoading, incomeCategoriesLoading, categories.length, incomeCategories.length, navigate])

  const expenseAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const incomeAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const totalExpenses = expenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0)
  const totalIncomes = incomes.reduce((sum, inc) => sum + incomeAmountForDashboard(inc.amount, inc.report_weight), 0)

  const portfolioMonthFlow = useMemo(
    () => sumPortfolioTransactionsForMonth(portfolioTransactions, currentMonth),
    [portfolioTransactions, currentMonth]
  )

  const totalInvestments = useMemo(() => {
    return portfolioMonthFlow
  }, [portfolioMonthFlow])

  const balance = totalIncomes - totalExpenses - totalInvestments
  const savingsRate = totalIncomes > 0 ? (balance / totalIncomes) * 100 : 0

  const hasMonthlyData =
    expenses.length > 0 ||
    incomes.length > 0 ||
    portfolioMonthFlow !== 0
  const loading =
    expensesLoading ||
    incomesLoading ||
    expenseLimitsLoading ||
    previousExpenseLimitsLoading

  // Previous month totals for trend badges
  const previousMonthExpenseTotal = useMemo(
    () => previousMonthExpenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0),
    [previousMonthExpenses]
  )
  const previousMonthIncomeTotal = useMemo(
    () => previousMonthIncomes.reduce((sum, inc) => sum + incomeAmountForDashboard(inc.amount, inc.report_weight), 0),
    [previousMonthIncomes]
  )

  // monthlyOverviewData removed because pizza chart was removed

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
  }, [expenses, categories, colorPalette])

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

  const expenseLimitAlerts = useMemo(() => {
    return expenseByCategory
      .map((item) => {
        const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : undefined
        const hasLimit = limitAmount !== null && limitAmount !== undefined

        if (!hasLimit) return null

        const exceededAmount = item.value - (limitAmount || 0)
        if (exceededAmount <= 0) return null

        const exceededPercentage = (limitAmount || 0) > 0 ? (exceededAmount / (limitAmount || 1)) * 100 : 100
        const usagePercentage = (limitAmount || 0) > 0 ? (item.value / (limitAmount || 1)) * 100 : 100

        return {
          ...item,
          limitAmount: limitAmount || 0,
          exceededAmount,
          exceededPercentage,
          usagePercentage,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.exceededAmount - a.exceededAmount)
  }, [expenseByCategory, expenseLimitMap])

  // expenseCategoriesPieData removed because pizza chart was removed

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

  // Category summaries for FinancialInsights
  const categoryExpenseSummaries = useMemo(() =>
    expenseByCategory.map(item => ({ category_name: item.name, total: item.value, baseTotal: item.baseValue })),
    [expenseByCategory]
  )

  // Weekday expense data for FinancialInsights
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
  }, [expenses, currentMonth])

  useEffect(() => {
    if (lastFetchedMonthRef.current !== currentMonth) {
      setIsMonthTransitioning(true)
      isDataChangingRef.current = true
      lastFetchedMonthRef.current = currentMonth
    }

    if (!loading) {
      const fadeTimer = setTimeout(() => {
        setIsMonthTransitioning(false)
        isDataChangingRef.current = false
      }, 150)
      return () => clearTimeout(fadeTimer)
    }
  }, [currentMonth, loading])

  useEffect(() => {
    if (isMonthTransitioning && !loading) {
      const timer = setTimeout(() => {
        setIsMonthTransitioning(false)
        isDataChangingRef.current = false
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [loading, isMonthTransitioning])

  const categoriesAttentionList = useMemo(() => {
    const list: Array<{
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
    }> = []

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
        alertStatusClass: 'text-expense font-bold bg-expense/10 px-2 py-0.5 rounded-full'
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
        alertStatusClass: 'text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-full'
      })
    })

    return list.sort((a, b) => b.usagePercentage - a.usagePercentage)
  }, [expenseLimitAlerts, expenseAttentionCategories])

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
  }, [currentMonth, incomes, expenses, portfolioTransactions])

  const openExpenseCategoryDetails = (categoryId: string, categoryName: string) => {
    if (!categoryId) return
    setSelectedExpenseCategory({ id: categoryId, name: categoryName })
  }

  const selectedExpenseCategoryDetails = useMemo(() => {
    if (!selectedExpenseCategory) return null

    const currentItems = expenses.filter((expense) => (expense.category?.id || expense.category_id || '') === selectedExpenseCategory.id)
    const previousItems = previousMonthExpenses.filter((expense) => (expense.category?.id || expense.category_id || '') === selectedExpenseCategory.id)

    const currentTotal = currentItems.reduce((sum, item) => sum + expenseAmountForDashboard(item.amount, item.report_weight), 0)
    const previousTotal = previousItems.reduce((sum, item) => sum + expenseAmountForDashboard(item.amount, item.report_weight), 0)

    return {
      currentItems,
      currentTotal,
      previousTotal,
    }
  }, [selectedExpenseCategory, expenses, previousMonthExpenses])

  const selectedExpenseCategoryLimitDetails = useMemo(() => {
    if (!selectedExpenseCategory || !selectedExpenseCategoryDetails) return null

    const rawLimit = expenseLimitMap.get(selectedExpenseCategory.id)
    const hasLimit = rawLimit !== null && rawLimit !== undefined

    if (!hasLimit) return null

    const limitAmount = rawLimit || 0
    const currentTotal = selectedExpenseCategoryDetails.currentTotal
    const exceededAmount = Math.max(currentTotal - limitAmount, 0)
    const remainingAmount = Math.max(limitAmount - currentTotal, 0)

    return {
      limitAmount,
      currentTotal,
      exceededAmount,
      remainingAmount,
      isExceeded: currentTotal > limitAmount,
    }
  }, [selectedExpenseCategory, selectedExpenseCategoryDetails, expenseLimitMap])

  const miniChartItems = useMemo(() => {
    if (!selectedExpenseCategoryDetails) return []
    return selectedExpenseCategoryDetails.currentItems.map((item) => ({
      id: item.id,
      description: item.description || item.category?.name || 'Despesa',
      date: item.date,
      amount: expenseAmountForDashboard(item.amount, item.report_weight),
    }))
  }, [selectedExpenseCategoryDetails])

  const toggleDailyFlowSeries = (dataKey: string) => {
    setHiddenDailyFlowSeries((prev) =>
      prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey]
    )
  }

  useEffect(() => {
    const onDataChanged = () => {
      if (isOnline) {
        void loadPortfolioTransactions()
      }
    }

    if (isOnline) {
      void loadPortfolioTransactions()
    } else {
      setPortfolioId('')
      setPortfolioTransactions([])
    }

    window.addEventListener('local-data-changed', onDataChanged)
    return () => window.removeEventListener('local-data-changed', onDataChanged)
  }, [isOnline, loadPortfolioTransactions])


  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
      <PageHeader
        title={PAGE_HEADERS.dashboard.title}
        subtitle={PAGE_HEADERS.dashboard.description}
        action={
          <PageHeaderActions
            launchModalOpen={
              isSelectorOpen || isExpenseOpen || isIncomeOpen || isInvestmentOpen
            }
          >
            <PageHeaderActionButton
              actionRole="launch"
              intent="primary"
              icon={Plus}
              label="Lançamento"
              compactOnMobile={false}
              onClick={() => setIsSelectorOpen(true)}
              disabled={categories.length === 0 && incomeCategories.length === 0}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6 animate-page-enter relative">
        <MobileAlertsPill />

        <MonthSelector value={currentMonth} onChange={setCurrentMonth} isOnline={isOnline} />

        <MonthTransitionView month={currentMonth}>
          <div className="mt-4 lg:mt-6">

            {loading || isMonthTransitioning ? (
              <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
                <Loader text="Carregando dados do mês..." />
              </div>
            ) : (
              <>
                {/* O banner de alertas estático foi removido para usar o modo flutuante/discreto */}
                {null}
                {!hasMonthlyData ? (
              <Card className="border border-glass surface-glass relative overflow-hidden p-8 sm:p-12 text-center flex flex-col items-center max-w-lg mx-auto transition-all duration-300 hover:border-glass-strong shadow-lg">
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-inner">
                  <PiggyBank size={32} className="text-primary animate-pulse" />
                </div>
                
                <h3 className="text-lg font-extrabold text-primary tracking-tight">Mês sem movimentações</h3>
                <p className="text-xs text-secondary mt-2 max-w-sm leading-relaxed">
                  Não encontramos lançamentos de receitas, despesas ou investimentos para o mês selecionado. Que tal começar a organizar suas finanças agora?
                </p>
                
                <Button 
                  variant="primary" 
                  size="md" 
                  className="mt-6 flex items-center gap-2"
                  onClick={() => setIsSelectorOpen(true)}
                >
                  <Plus size={16} />
                  Adicionar lançamento
                </Button>
              </Card>
            ) : (
              <div className="space-y-5 animate-stagger">

                {/* ── KPIs com sparkline e badge de tendência ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch">
                  <KpiCard
                    title="Rendas do mês"
                    value={formatCurrency(totalIncomes)}
                    subtext="vs. mês anterior"
                    icon={<TrendingUp size={16} />}
                    glowColor="var(--color-income)"
                    showGlow={true}
                    sparklineData={dailyFlowData.map(d => d.Rendas)}
                    trendPercent={previousMonthIncomeTotal > 0
                      ? ((totalIncomes - previousMonthIncomeTotal) / previousMonthIncomeTotal) * 100
                      : null}
                    index={1}
                  />
                  <KpiCard
                    title="Despesas do mês"
                    value={formatCurrency(totalExpenses)}
                    subtext="vs. mês anterior"
                    icon={<TrendingDown size={16} />}
                    glowColor="var(--color-expense)"
                    showGlow={true}
                    isDespesa={true}
                    sparklineData={dailyFlowData.map(d => d.Despesas)}
                    trendPercent={previousMonthExpenseTotal > 0
                      ? ((totalExpenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100
                      : null}
                    index={2}
                  />
                  <KpiCard
                    title="Investimentos"
                    value={formatCurrency(Math.max(totalInvestments, 0))}
                    subtext="aportado este mês"
                    icon={<PiggyBank size={16} />}
                    glowColor="var(--color-balance)"
                    showGlow={false}
                    sparklineData={dailyFlowData.map(d => d.Investimentos)}
                    trendPercent={null}
                    index={3}
                  />
                  <KpiCard
                    title="Taxa de saldo"
                    value={`${formatNumberWithTwoDecimalsBR(savingsRate)}%`}
                    subtext={`Saldo líquido: ${formatCurrency(balance)}`}
                    icon={<Percent size={16} />}
                    glowColor={savingsRate >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
                    showGlow={savingsRate < 0} // Only glow warning red if savings rate is negative
                    sparklineData={dailyFlowData.map(d => d.Rendas - d.Despesas - d.Investimentos)}
                    trendPercent={null}
                    index={4}
                  />
                </div>

                {/* Grid Responsivo de 3 Colunas no Desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
                  
                  {/* Coluna da Esquerda (2 Colunas no Desktop): Gráficos e Detalhes Analíticos */}
                  <div className="flex flex-col gap-5 lg:col-span-2">
                    {/* Mobile Only: Acompanhamento Diário no Topo */}
                    <div className="lg:hidden">
                      <DailyBudgetAdvisor
                        currentMonth={currentMonth}
                        totalIncomes={totalIncomes}
                        totalExpenses={totalExpenses}
                        totalInvestments={totalInvestments}
                        expenses={expenses}
                      />
                    </div>

                    {/* Gráfico de Fluxo Diário */}
                    <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm transition-all duration-300">
                      <div className="mb-4 border-b border-glass/40 pb-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                          Fluxo Diário
                        </h3>
                        <p className="text-[10px] text-secondary mt-0.5">
                          Entradas, saídas e investimentos por dia em {formatMonth(currentMonth)}
                        </p>
                      </div>

                      <div className="w-full mt-2">
                        <DailyFlowChart
                          data={dailyFlowData}
                          hiddenSeries={hiddenDailyFlowSeries}
                          onToggleSeries={toggleDailyFlowSeries}
                        />
                      </div>
                    </Card>

                    {/* Controle de Limites */}
                    <div className={categoriesAttentionList.length === 0 ? 'hidden lg:block' : 'block'}>
                      <LimitsControl
                        categoriesAttentionList={categoriesAttentionList}
                        onCategoryClick={openExpenseCategoryDetails}
                      />
                    </div>

                    {/* Sugestões de Limites Inteligentes */}
                    <SmartLimitSuggestions
                      currentMonth={currentMonth}
                      previousMonth={previousMonth}
                      categories={categories}
                      currentMonthExpenses={expenses}
                      previousMonthExpenses={previousMonthExpenses}
                      currentMonthLimits={currentMonthExpenseLimits}
                      previousMonthIncomeTotal={previousMonthIncomeTotal}
                      onSetLimit={setCategoryLimit}
                      onRefreshLimits={refreshLimits}
                    />
                  </div>

                  {/* Coluna da Direita (1 Coluna no Desktop): Widgets e Acompanhamento */}
                  <div className="flex flex-col gap-5 lg:col-span-1">
                    {/* Desktop Only: Acompanhamento Diário na Barra Lateral */}
                    <div className="hidden lg:block">
                      <DailyBudgetAdvisor
                        currentMonth={currentMonth}
                        totalIncomes={totalIncomes}
                        totalExpenses={totalExpenses}
                        totalInvestments={totalInvestments}
                        expenses={expenses}
                      />
                    </div>

                    {/* Insights Financeiros */}
                    <FinancialInsights
                      viewMode="month"
                      periodLabel={formatMonth(currentMonth)}
                      incomeTotal={totalIncomes}
                      expenseTotal={totalExpenses}
                      savingsRate={savingsRate}
                      categoryExpenses={categoryExpenseSummaries}
                      previousExpenseTotal={previousMonthExpenseTotal}
                      weekdayExpenses={weekdayExpenseData}
                      limitsExceededCount={limitsExceededCount}
                      isSidebar={true}
                    />


                  </div>

                </div>

              </div>
            )}
              </>
            )}
          </div>
        </MonthTransitionView>
      </div>

      {/* ── Selector Modal para Novo Lançamento ── */}
      <Modal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} title="Novo lançamento">
        <div className="modal-body-stack">
          <ModalIntro align="center">Escolha o tipo de lançamento que deseja adicionar:</ModalIntro>
          <ModalChoiceGrid>
            <QuickLaunchOption
              label="Renda"
              icon={<TrendingUp size={24} />}
              borderHoverClass="hover:border-income"
              iconWrapClass="bg-income/10 text-income"
              onClick={() => {
                setIsSelectorOpen(false)
                setIsIncomeOpen(true)
              }}
            />
            <QuickLaunchOption
              label="Despesa"
              icon={<TrendingDown size={24} />}
              borderHoverClass="hover:border-expense"
              iconWrapClass="bg-expense/10 text-expense"
              onClick={() => {
                setIsSelectorOpen(false)
                setIsExpenseOpen(true)
              }}
            />
            <QuickLaunchOption
              label="Investimento"
              icon={<PiggyBank size={24} />}
              borderHoverClass="hover:border-balance"
              iconWrapClass="bg-balance/10 text-balance"
              onClick={() => {
                setIsSelectorOpen(false)
                if (isOnline && !portfolioId) {
                  void loadPortfolioTransactions()
                }
                setIsInvestmentOpen(true)
              }}
            />
          </ModalChoiceGrid>
        </div>
      </Modal>

      <ExpenseFormModal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        editingExpense={null}
        categories={categories}
        creditCards={creditCards}
        onCreate={async (data) => {
          const res = await createExpense(data)
          if (!res.error) {
            refreshExpenses()
          }
          return res
        }}
        onUpdate={async () => ({ data: null, error: 'Não aplicável' })}
        onDelete={async () => ({ error: 'Não aplicável' })}
      />

      <IncomeFormModal
        isOpen={isIncomeOpen}
        onClose={() => setIsIncomeOpen(false)}
        editingIncome={null}
        incomeCategories={incomeCategories}
        onCreate={async (data) => {
          const res = await createIncome(data)
          if (!res.error) {
            refreshIncomes()
          }
          return res
        }}
        onUpdate={async () => ({ data: null, error: 'Não aplicável' })}
        onDelete={async () => ({ error: 'Não aplicável' })}
      />

      <PortfolioTransactionFormModal
        isOpen={isInvestmentOpen}
        onClose={() => setIsInvestmentOpen(false)}
        portfolioId={portfolioId}
        editingTransaction={null}
        onSaved={() => {
          void loadPortfolioTransactions()
        }}
      />

      {/* ── Modal de detalhamento de categoria ── */}
      <Modal
        isOpen={Boolean(selectedExpenseCategory)}
        onClose={() => setSelectedExpenseCategory(null)}
        title={selectedExpenseCategory ? `Detalhamento: ${selectedExpenseCategory.name}` : 'Detalhamento'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Comparação mensal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-glass surface-glass p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(currentMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.currentTotal ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-glass surface-glass p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(previousMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.previousTotal ?? 0)}</p>
              </div>
            </div>
          </div>

          {selectedExpenseCategoryLimitDetails && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-secondary">Metas do mês</p>
              <div className="rounded-xl border border-glass surface-glass p-3">
                <p className="text-sm text-primary">Limite: {formatCurrency(selectedExpenseCategoryLimitDetails.limitAmount)}</p>
                <p className="text-sm text-primary">Gasto: {formatCurrency(selectedExpenseCategoryLimitDetails.currentTotal)}</p>
                <p className={`text-sm font-medium ${selectedExpenseCategoryLimitDetails.isExceeded ? 'text-expense' : 'text-income'}`}>
                  {selectedExpenseCategoryLimitDetails.isExceeded
                    ? `Excesso: ${formatCurrency(selectedExpenseCategoryLimitDetails.exceededAmount)}`
                    : `Restante: ${formatCurrency(selectedExpenseCategoryLimitDetails.remainingAmount)}`}
                </p>
              </div>
            </div>
          )}

          {selectedExpenseCategory && (
            <CategoryDetailMiniChart
              detailItems={miniChartItems}
              period="month"
              selectedMonth={currentMonth}
              selectedYear={new Date(currentMonth).getFullYear()}
              color={getCategoryColorForPalette(
                expenses.find(e => (e.category?.id || e.category_id || '') === selectedExpenseCategory.id)?.category?.color || 'var(--color-primary)',
                colorPalette
              )}
            />
          )}

          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Lançamentos do mês</p>

          {selectedExpenseCategoryDetails && selectedExpenseCategoryDetails.currentItems.length > 0 ? (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {selectedExpenseCategoryDetails.currentItems.map((item) => {
                const reportAmount = expenseAmountForDashboard(item.amount, item.report_weight)
                const showOriginal = Math.abs(reportAmount - item.amount) > 0.009

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-glass surface-glass p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{item.description || item.category?.name || 'Despesa'}</p>
                        <p className="text-xs text-secondary mt-0.5">{formatDate(item.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary">{formatCurrency(reportAmount)}</p>
                        {showOriginal && <p className="text-xs text-secondary">Total: {formatCurrency(item.amount)}</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-secondary">Sem lançamentos dessa categoria no mês selecionado.</p>
          )}
        </div>
      </Modal>

      <ScrollToTop />
    </div>
    )
  }
