import { useEffect, useMemo, useState, useRef } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import MonthSelector from '@/components/MonthSelector'
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useInvestments } from '@/hooks/useInvestments'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { addMonths, formatCurrency, formatDate, formatMonth, formatNumberBR, formatNumberWithTwoDecimalsBR, getCurrentMonthString } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, Plus } from 'lucide-react'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { supabase } from '@/lib/supabase'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardKpis from '@/components/DashboardKpis'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import IncomeFormModal from '@/components/IncomeFormModal'
import InvestmentFormModal from '@/components/InvestmentFormModal'

const EXPENSE_LIMIT_WARNING_THRESHOLD = 85;

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [isIncomeOpen, setIsIncomeOpen] = useState(false)
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false)
  const { isOnline } = useNetworkStatus()
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState<string[]>([])
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<{ id: string; name: string } | null>(null)
  
  const [consultingPortfolioValue, setConsultingPortfolioValue] = useState<number | null>(null)
  const { investments, loading: investmentsLoading, refreshInvestments, createInvestment } = useInvestments(currentMonth)
  
  useEffect(() => {
    async function loadConsultingPortfolio() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: portfolio } = await supabase
          .from('portfolios')
          .select('id, cash_balance')
          .eq('client_id', user.id)
          .maybeSingle()

        if (!portfolio) return

        const { data: transactions } = await supabase
          .from('portfolio_transactions')
          .select('*')
          .eq('portfolio_id', portfolio.id)

        const { data: targets } = await supabase
          .from('target_allocations')
          .select('*')
          .eq('portfolio_id', portfolio.id)

        if (!transactions || transactions.length === 0) {
          setConsultingPortfolioValue(Number(portfolio.cash_balance))
          return
        }

        const tickers = Array.from(new Set(transactions.map(t => t.ticker)))
        
        const { getAssetPrices } = await import('@/services/priceService')
        const prices = await getAssetPrices(tickers)

        const { calculatePositions } = await import('@/services/investmentEngine')
        const { totalValue } = calculatePositions(
          transactions,
          targets || [],
          prices,
          Number(portfolio.cash_balance)
        )

        setConsultingPortfolioValue(totalValue)
      } catch (err) {
        console.error('Erro ao integrar carteira de consultoria no dashboard:', err)
      }
    }

    if (isOnline) {
      loadConsultingPortfolio()
    } else {
      setConsultingPortfolioValue(null)
    }
  }, [isOnline, investments])
  
  const lastFetchedMonthRef = useRef<string | null>(null)
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false)
  const isDataChangingRef = useRef(false)

  const formatAxisCurrencyTick = (value: number) => {
    if (value >= 1000) {
      return `R$ ${formatNumberBR(value / 1000, { maximumFractionDigits: 0 })}k`
    }

    return `R$ ${formatNumberBR(value, { maximumFractionDigits: 0 })}`
  }

  const { colorPalette } = usePaletteColors()
  const { categories, loading: categoriesLoading } = useCategories()
  const { incomeCategories, loading: incomeCategoriesLoading } = useIncomeCategories()
  const { creditCards } = useCreditCards()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)
  
  const navigate = useNavigate()

  useEffect(() => {
    const isReady = !expensesLoading && !incomesLoading && !investmentsLoading && !categoriesLoading && !incomeCategoriesLoading
    if (isReady && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [expensesLoading, incomesLoading, investmentsLoading, categoriesLoading, incomeCategoriesLoading, categories.length, incomeCategories.length, navigate])

  const expenseAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const incomeAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const totalExpenses = expenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0)
  const totalIncomes = incomes.reduce((sum, inc) => sum + incomeAmountForDashboard(inc.amount, inc.report_weight), 0)
  const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0) + (consultingPortfolioValue || 0)
  const balance = totalIncomes - totalExpenses - totalInvestments
  const hasMonthlyData = expenses.length > 0 || incomes.length > 0 || investments.length > 0
  const loading =
    expensesLoading ||
    incomesLoading ||
    investmentsLoading ||
    expenseLimitsLoading ||
    previousExpenseLimitsLoading

  const monthlyOverviewData = useMemo(
    () => [
      { name: 'Rendas', value: totalIncomes, color: 'var(--color-income)' },
      { name: 'Despesas', value: totalExpenses, color: 'var(--color-expense)' },
      { name: 'Investimentos', value: totalInvestments, color: 'var(--color-balance)' },
    ],
    [totalExpenses, totalIncomes, totalInvestments]
  )

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; name: string; color: string; value: number }>()

    expenses.forEach((expense) => {
      const name = expense.category?.name || 'Sem categoria'
      const categoryId = expense.category?.id || expense.category_id || ''
      const key = categoryId || name
      const color = getCategoryColorForPalette(expense.category?.color || 'var(--color-primary)', colorPalette)
      const current = map.get(key)

      if (current) {
        current.value += expenseAmountForDashboard(expense.amount, expense.report_weight)
      } else {
        map.set(key, { categoryId, name, color, value: expenseAmountForDashboard(expense.amount, expense.report_weight) })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [expenses, colorPalette])

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

  const expenseCategoriesPieData = useMemo(() => {
    if (expenseByCategory.length <= 5) return expenseByCategory

    const top = expenseByCategory.slice(0, 5)
    const othersValue = expenseByCategory.slice(5).reduce((sum, item) => sum + item.value, 0)

    return [...top, { categoryId: '', name: 'Outras', color: 'var(--color-text-secondary)', value: othersValue }]
  }, [expenseByCategory])

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

  const prioritizedExpenseCategoryItems = useMemo(() => {
    return expenseByCategory
      .map((item) => {
        const exceeded = expenseLimitAlerts.find((alert) => alert.categoryId === item.categoryId)
        if (exceeded) {
          return {
            ...item,
            alertPriority: 2,
            alertStatusLabel: 'Ultrapassou',
            alertStatusClass: 'text-secondary',
          }
        }

        const nearLimit = expenseAttentionCategories.find((alert) => alert.categoryId === item.categoryId)
        if (nearLimit) {
          return {
            ...item,
            alertPriority: 1,
            alertStatusLabel: nearLimit.level,
            alertStatusClass: 'text-secondary',
          }
        }

        return {
          ...item,
          alertPriority: 0,
          alertStatusLabel: '',
          alertStatusClass: 'text-secondary',
        }
      })
      .sort((a, b) => {
        if (b.alertPriority !== a.alertPriority) return b.alertPriority - a.alertPriority
        return b.value - a.value
      })
  }, [expenseByCategory, expenseLimitAlerts, expenseAttentionCategories])

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

    investments.forEach((investment) => {
      const investmentDay = 1
      if (investmentDay >= 1 && investmentDay <= daysInMonth) {
        series[investmentDay - 1].Investimentos += investment.amount
      }
    })

    return series
  }, [currentMonth, incomes, expenses, investments])

  const chartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null

    const isDayLabel = typeof label === 'string' && /^\d{1,2}$/.test(label)

    return (
      <div className="rounded-lg border border-primary bg-primary px-3 py-2 shadow-sm">
        {label && <p className="text-xs text-secondary mb-1">{isDayLabel ? `Dia ${label}` : label}</p>}
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <p key={`${entry.name}-${index}`} className="text-sm text-primary">
              {entry.name}: {formatCurrency(Number(entry.value || 0))}
            </p>
          ))}
        </div>
      </div>
    )
  }

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

  const toggleDailyFlowSeries = (dataKey: string) => {
    setHiddenDailyFlowSeries((prev) =>
      prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey]
    )
  }

  const renderInteractiveLegend = ({ payload }: { payload?: any[] }) => {
    if (!payload?.length) return null

    return (
      <div className="flex flex-wrap gap-2 pt-2">
        {payload.map((entry: any) => {
          const dataKey = String(entry.dataKey ?? entry.value ?? '')
          const isHidden = hiddenDailyFlowSeries.includes(dataKey)

          return (
            <button
              key={dataKey}
              type="button"
              onClick={() => toggleDailyFlowSeries(dataKey)}
              className={`px-2 py-1 rounded-md border border-primary text-xs flex items-center gap-2 motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${isHidden ? 'opacity-50 bg-secondary text-secondary' : 'bg-primary text-primary'
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

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.dashboard.title}
        subtitle={PAGE_HEADERS.dashboard.description}
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSelectorOpen(true)}
              className="flex items-center gap-2"
              disabled={categories.length === 0 && incomeCategories.length === 0}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Lançamento</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 lg:p-6 animate-page-enter">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} isOnline={isOnline} />

        <div
          style={{
            opacity: isMonthTransitioning ? 0 : 1,
            transition: 'opacity 150ms ease-in-out',
            willChange: 'opacity',
          }}
        >
          <div className="mt-4 lg:mt-6">

            {loading || isMonthTransitioning ? (
              <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
                <Loader text="Carregando dados do mês..." />
              </div>
            ) : !hasMonthlyData ? (
              <Card>
                <div className="text-center py-8">
                  <p className="text-base text-primary font-medium">Adicione o primeiro lançamento do mês.</p>
                  <Button className="mt-4" onClick={() => setIsSelectorOpen(true)}>Novo lançamento</Button>
                </div>
              </Card>
            ) : (
              <>
                <DashboardKpis
                  totalIncomes={totalIncomes}
                  totalExpenses={totalExpenses}
                  totalInvestments={totalInvestments}
                  balance={balance}
                />

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                    <Card className="h-full flex flex-col">
                      <h3 className="text-lg font-semibold text-primary mb-4">Panorama do mês</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={monthlyOverviewData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                          <YAxis
                            stroke="var(--color-text-secondary)"
                            fontSize={12}
                            tick={{ fill: 'var(--color-text-secondary)' }}
                            tickFormatter={(value) => formatAxisCurrencyTick(Number(value))}
                          />
                          <Tooltip content={chartTooltip} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {monthlyOverviewData.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    <Card className="h-full flex flex-col">
                      <h3 className="text-lg font-semibold text-primary mb-4">Fluxo diário (mês)</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={dailyFlowData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="day" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} minTickGap={14} />
                          <YAxis
                            stroke="var(--color-text-secondary)"
                            fontSize={12}
                            tick={{ fill: 'var(--color-text-secondary)' }}
                            tickFormatter={(value) => formatAxisCurrencyTick(Number(value))}
                          />
                          <Tooltip content={chartTooltip} />
                          <Legend content={renderInteractiveLegend} />
                          <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={false} hide={hiddenDailyFlowSeries.includes('Rendas')} />
                          <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={false} hide={hiddenDailyFlowSeries.includes('Despesas')} />
                          <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={false} hide={hiddenDailyFlowSeries.includes('Investimentos')} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 gap-4 items-stretch">
                    <Card className="h-full flex flex-col">
                      <div className="mb-4 space-y-1.5">
                        <h3 className="text-lg font-semibold text-primary">Despesas por categoria</h3>
                        <p className="text-xs text-secondary">Gráfico por porcentagem e lista priorizada por alertas de limite.</p>
                      </div>
                      {expenseCategoriesPieData.length === 0 ? (
                        <p className="text-sm text-secondary text-center">Sem despesas no mês selecionado.</p>
                      ) : (
                        <>
                          <div className="mx-auto w-full max-w-2xl">
                            <ResponsiveContainer width="100%" height={260}>
                              <PieChart>
                                <Pie
                                  data={expenseCategoriesPieData}
                                  dataKey="value"
                                  nameKey="name"
                                  outerRadius={86}
                                  labelLine={false}
                                  label={false}
                                  onClick={(entry: { categoryId?: string; name?: string }) => {
                                    if (entry?.categoryId && entry?.name) {
                                      openExpenseCategoryDetails(entry.categoryId, entry.name)
                                    }
                                  }}
                                >
                                  {expenseCategoriesPieData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip content={chartTooltip} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="mt-4 space-y-3">
                            {prioritizedExpenseCategoryItems.map((item, index) => {
                              const percentage = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0
                              const staggerClass = index < 8 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300', 'delay-350', 'delay-400'][index] : ''
                              const interactiveRowButtonClasses = "w-full text-left bg-secondary border border-primary rounded-xl p-3 md:p-4 motion-standard hover-lift press-subtle group focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] transition-colors"
                              return (
                                <button
                                  key={item.name}
                                  type="button"
                                  onClick={() => openExpenseCategoryDetails(item.categoryId, item.name)}
                                  className={`${interactiveRowButtonClasses} animate-stagger-item ${staggerClass}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                      <span className="text-primary truncate">{item.name}</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-2.5 flex-shrink-0">
                                      {item.alertPriority > 0 && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary ${item.alertStatusClass}`}>
                                          {item.alertStatusLabel}
                                        </span>
                                      )}
                                      <span className="text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-secondary">
                                        {formatNumberWithTwoDecimalsBR(percentage)}%
                                      </span>
                                    </div>
                                  </div>

                                  <div className="w-full h-1.5 rounded-full bg-secondary mt-3">
                                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: item.color }} />
                                  </div>

                                  <p className="text-xs text-secondary mt-2 text-center sm:text-left truncate">Total: {formatCurrency(item.value)}</p>
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </Card>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Selector Modal for Quick Add */}
      <Modal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} title="Novo lançamento">
        <div className="space-y-4 py-2">
          <p className="text-sm text-secondary text-center mb-4">Escolha o tipo de lançamento que deseja adicionar:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => {
                setIsSelectorOpen(false)
                setIsIncomeOpen(true)
              }}
              className="flex flex-col items-center justify-center p-6 bg-secondary border border-primary hover:border-income rounded-2xl hover:shadow-lg transition-all group duration-150"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-income/10 text-income mb-3 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <span className="font-semibold text-primary">Renda</span>
            </button>
            
            <button
              onClick={() => {
                setIsSelectorOpen(false)
                setIsExpenseOpen(true)
              }}
              className="flex flex-col items-center justify-center p-6 bg-secondary border border-primary hover:border-expense rounded-2xl hover:shadow-lg transition-all group duration-150"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-expense/10 text-expense mb-3 group-hover:scale-110 transition-transform">
                <TrendingDown size={24} />
              </div>
              <span className="font-semibold text-primary">Despesa</span>
            </button>

            <button
              onClick={() => {
                setIsSelectorOpen(false)
                setIsInvestmentOpen(true)
              }}
              className="flex flex-col items-center justify-center p-6 bg-secondary border border-primary hover:border-balance rounded-2xl hover:shadow-lg transition-all group duration-150"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-balance/10 text-balance mb-3 group-hover:scale-110 transition-transform">
                <PiggyBank size={24} />
              </div>
              <span className="font-semibold text-primary">Investimento</span>
            </button>
          </div>
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

      <InvestmentFormModal
        isOpen={isInvestmentOpen}
        onClose={() => setIsInvestmentOpen(false)}
        editingInvestment={null}
        defaultMonth={currentMonth}
        onCreate={async (data) => {
          const res = await createInvestment(data)
          if (!res.error) {
            refreshInvestments()
          }
          return res
        }}
        onUpdate={async () => ({ data: null, error: 'Não aplicável' })}
        onDelete={async () => ({ error: 'Não aplicável' })}
      />

      <Modal
        isOpen={Boolean(selectedExpenseCategory)}
        onClose={() => setSelectedExpenseCategory(null)}
        title={selectedExpenseCategory ? `Detalhamento: ${selectedExpenseCategory.name}` : 'Detalhamento'}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Comparação mensal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-primary bg-secondary p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(currentMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.currentTotal ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-primary bg-secondary p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(previousMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.previousTotal ?? 0)}</p>
              </div>
            </div>
          </div>

          {selectedExpenseCategoryLimitDetails && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-secondary">Metas do mês</p>
              <div className="rounded-lg border border-primary bg-secondary p-3">
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

          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Lançamentos do mês</p>

          {selectedExpenseCategoryDetails && selectedExpenseCategoryDetails.currentItems.length > 0 ? (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {selectedExpenseCategoryDetails.currentItems.map((item, index) => {
                const reportAmount = expenseAmountForDashboard(item.amount, item.report_weight)
                const showOriginal = Math.abs(reportAmount - item.amount) > 0.009
                const staggerClass = index < 8 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300', 'delay-350', 'delay-400'][index] : ''

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border border-primary bg-primary p-3 animate-stagger-item ${staggerClass}`}
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
    </div>
  )
}
