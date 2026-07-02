import { useEffect, useMemo, useState } from 'react'
import { usePageActions } from '@/hooks/usePageActions'
import Card from '@/components/Card'
import { SkeletonDashboard } from '@/components/Skeleton'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { formatMonth, getCurrentMonthString } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CARD_PADDING,
  CARD_PADDING_XL,
  CARD_BASE,
  PAGE_ENTER_ANIMATION,
  CONTENT_PADDING,
} from '@/constants/layout'
import Button from '@/components/Button'
import BudgetHeroCard from '@/components/dashboard/BudgetHeroCard'
import ProjectionCard from '@/components/dashboard/ProjectionCard'
import QuickLaunchOption from '@/components/dashboard/QuickLaunchOption'
import DashboardSummaryCard from '@/components/dashboard/DashboardSummaryCard'
import DashboardCategoryDetailModal from '@/components/dashboard/DashboardCategoryDetailModal'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { portfolioInvestmentByDay, sumPortfolioTransactionsForMonth } from '@/utils/portfolioMonthlyFlow'
import { useDashboardPortfolio } from '@/hooks/useDashboardPortfolio'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import IncomeFormModal from '@/components/IncomeFormModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'
import LimitsControl from '@/components/dashboard/LimitsControl'
import QuickWinsGrid from '@/components/dashboard/QuickWinsGrid'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useDashboardInsights } from '@/hooks/useDashboardInsights'
import { InsightsCard } from '@/components/dashboard/InsightsCard'
import { useSpendingCalculations } from '@/hooks/useSpendingCalculations'
import { useSpendingProjection } from '@/hooks/useSpendingProjection'
import { useBudgetLimits } from '@/hooks/useBudgetLimits'
import { addMonths } from '@/utils/format'
import { generateOptimizationSuggestions } from '@/services/optimizationSuggestionsEngine'

export default function Dashboard() {
  const currentMonth = getCurrentMonthString()
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [isIncomeOpen, setIsIncomeOpen] = useState(false)
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false)
  const { isOnline } = useNetworkStatus()
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState<string[]>([])
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<{ id: string; name: string } | null>(null)

  // Portfolio data via extracted hook
  const {
    portfolioId,
    portfolioTransactions,
    loadPortfolioTransactions,
  } = useDashboardPortfolio()



  const { colorPalette } = usePaletteColors()
  const { categories, loading: categoriesLoading } = useCategories()
  const { incomeCategories, loading: incomeCategoriesLoading } = useIncomeCategories()
  const { creditCards } = useCreditCards()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const monthMinus2 = useMemo(() => addMonths(currentMonth, -2), [currentMonth])
  const monthMinus3 = useMemo(() => addMonths(currentMonth, -3), [currentMonth])
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { expenses: expensesMinus2 } = useExpenses(monthMinus2)
  const { expenses: expensesMinus3 } = useExpenses(monthMinus3)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading, setCategoryLimit, refreshLimits } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)

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
  const navigate = useNavigate()



  // ── Hooks extraídos ──
  const spendingCalcs = useSpendingCalculations(currentMonth, totalIncomes, totalExpenses, totalInvestments)
  const spendingProjection = useSpendingProjection(currentMonth, totalExpenses, totalIncomes, totalInvestments)
  const {
    spentMap,
    expenseLimitMap,
    expenseByCategory,
    limitsExceededCount,
    categoriesAttentionList,
    reallocationRecommendation,
    isReallocating,
    handleReallocate,
    totalLimits,
    limitUsedPercentage,
    progressColor,
  } = useBudgetLimits(
    categories,
    expenses,
    currentMonthExpenseLimits,
    previousMonthExpenseLimits,
    totalExpenses,
    totalIncomes,
    expenseAmountForDashboard,
    colorPalette,
    getCategoryColorForPalette,
    setCategoryLimit,
    refreshLimits,
  )



  useEffect(() => {
    const isReady = !expensesLoading && !incomesLoading && !categoriesLoading && !incomeCategoriesLoading
    if (isReady && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [expensesLoading, incomesLoading, categoriesLoading, incomeCategoriesLoading, categories.length, incomeCategories.length, navigate])

  // monthlyOverviewData removed because pizza chart was removed

  const currentMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    currentMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [currentMonthExpenseLimits])

  // expenseCategoriesPieData removed because pizza chart was removed

  // Category summaries for FinancialInsights
  const categoryExpenseSummaries = useMemo(() =>
    expenseByCategory.map(item => ({ category_name: item.name, total: item.value, baseTotal: item.baseValue })),
    [expenseByCategory]
  )

  // Income by category for concentration analysis
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
  }, [incomes])

  // Mid-month spending pace check — compares expenses so far to income-based benchmark
  const spendingPace = useMemo(() => {
    if (totalIncomes <= 0 || totalExpenses <= 0) return null

    const today = new Date()
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const currentDay = today.getDate()

    if (currentDay <= 7) return null // Only meaningful after first week

    const monthFraction = currentDay / daysInMonth
    if (monthFraction < 0.3) return null // Need at least 30% of month elapsed

    // Benchmark: if income were spread evenly across the month,
    // how much should have been spent by now to stay on track?
    const fairShare = (totalIncomes - totalInvestments) * monthFraction
    if (fairShare <= 0) return null

    if (totalExpenses > fairShare) {
      const overPct = ((totalExpenses - fairShare) / fairShare) * 100
      return { overPct, isOverBudget: true }
    }

    return null
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments])

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

  // ── Expenses with limit for insights engine ──
  const expensesWithLimit = useMemo(() => {
    return categories
      .map((cat) => {
        const limit = currentMonthExpenseLimitMap.get(cat.id)
        const spent = expenses
          .filter((e) => (e.category?.id || e.category_id) === cat.id)
          .reduce((s, e) => s + e.amount * (e.report_weight ?? 1), 0)
        return {
          categoryId: cat.id,
          spent,
          limit: limit ?? null,
          name: cat.name,
        }
      })
      .filter((item) => item.limit !== null && item.limit !== undefined)
  }, [categories, expenses, currentMonthExpenseLimitMap])

  // ── Insights Engine (substitui useDashboardAI) ──
  const aiInput = useMemo(() => ({
    currentMonth,
    totalIncomes,
    totalExpenses,
    totalInvestments,
    savingsRate,
    categoryExpenseSummaries,
    previousMonthExpenseTotal,
    weekdayExpenseData,
    limitsExceededCount,
    incomeByCategory,
    spendingPace,
    spendingProjection,
    balance,
    expenses,
    previousMonthExpenses,
    additionalPreviousMonthExpenses: [expensesMinus2, expensesMinus3],
    categories: categories.map(c => ({ id: c.id, name: c.name })),
    expensesWithLimit,
    expensesCount: expenses.length,
    incomesCount: incomes.length,
  }), [
    currentMonth, totalIncomes, totalExpenses, totalInvestments,
    savingsRate, categoryExpenseSummaries, previousMonthExpenseTotal,
    weekdayExpenseData, limitsExceededCount, incomeByCategory,
    spendingPace, spendingProjection, balance,
    expenses, previousMonthExpenses, expensesMinus2, expensesMinus3,
    categories, expensesWithLimit,
  ])

  const {
    insights,
    refreshInsights,
  } = useDashboardInsights(aiInput)

  // ── Optimization Suggestions Engine ──
  const optimizationSummary = useMemo(() => {
    return generateOptimizationSuggestions({
      insights,
      categoriesWithLimit: categories.map(c => ({
        categoryId: c.id,
        name: c.name,
        spent: spentMap.get(c.id) || 0,
        limit: currentMonthExpenseLimitMap.get(c.id) ?? null,
      })),
      reallocationRecommendation: reallocationRecommendation ? {
        fromId: reallocationRecommendation.fromId,
        fromName: reallocationRecommendation.fromName,
        toId: reallocationRecommendation.toId,
        toName: reallocationRecommendation.toName,
        transferAmount: reallocationRecommendation.transferAmount,
      } : null,
      totalIncomes,
      totalExpenses,
    })
  }, [
    insights,
    categories,
    spentMap,
    currentMonthExpenseLimitMap,
    reallocationRecommendation,
    totalIncomes,
    totalExpenses,
  ])

  // categoriesAttentionList agora vem do hook useBudgetLimits

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

  const isAnyModalOpen = isSelectorOpen || isExpenseOpen || isIncomeOpen || isInvestmentOpen

  usePageActions(
    [
      {
        icon: Plus,
        label: 'Lançamento',
        intent: 'primary',
        actionRole: 'launch',
        compactOnMobile: false,
        onClick: () => setIsSelectorOpen(true),
        disabled: categories.length === 0 && incomeCategories.length === 0,
      },
    ],
    isAnyModalOpen
  )

  useEffect(() => {
    const onDataChanged = () => {
      if (isOnline) {
        void loadPortfolioTransactions()
      }
    }

    if (isOnline) {
      void loadPortfolioTransactions()
    }

    window.addEventListener('local-data-changed', onDataChanged)
    return () => window.removeEventListener('local-data-changed', onDataChanged)
  }, [isOnline, loadPortfolioTransactions])


  // totalLimits, limitUsedPercentage, progressColor agora vêm do hook useBudgetLimits

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col">
      <div className={cn(CONTENT_PADDING, PAGE_ENTER_ANIMATION)}>
          <div>

            {loading ? (
              <div className="animate-fade-in">
                <SkeletonDashboard />
              </div>
            ) : (
              <>
                {/* O banner de alertas estático foi removido para usar o modo flutuante/discreto */}
                {null}
                {!hasMonthlyData ? (
              <Card className={cn(CARD_BASE, CARD_PADDING_XL, "text-center flex flex-col items-center max-w-lg mx-auto transition-all duration-300 hover:border-glass-strong")}>
                
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-inner">
                  <PiggyBank size={32} className="text-primary" />
                </div>
                
                <h3 className="text-lg font-extrabold text-primary tracking-tight">Mês sem movimentações</h3>
                <p className="text-xs text-secondary mt-2 max-w-sm leading-relaxed">
                  Não encontramos lançamentos de receitas, despesas ou investimentos para o mês selecionado. Que tal começar a organizar suas finanças agora?
                </p>
                
                <Button 
                  variant="primary" 
                  size="md" 
                  className="mt-6 flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsSelectorOpen(true)}
                >
                  <Plus size={16} />
                  Adicionar lançamento
                </Button>
              </Card>
            ) : (
              <div className="space-y-5">

                {/* ── SEÇÃO 2: Card Herói - Gasto Disponível ── */}
                <BudgetHeroCard spendingCalcs={spendingCalcs} />

                {/* ── SEÇÃO: Projeção de Fim do Mês ── */}
                {spendingProjection && (
                  <ProjectionCard projection={spendingProjection} totalIncomes={totalIncomes} />
                )}

                {/* ── SEÇÃO 3: Resumo do Mês (Termômetro) ── */}
                <DashboardSummaryCard
                  totalIncomes={totalIncomes}
                  totalExpenses={totalExpenses}
                  totalLimits={totalLimits}
                  limitUsedPercentage={limitUsedPercentage}
                  progressColor={progressColor}
                  reallocationRecommendation={reallocationRecommendation ? {
                    fromName: reallocationRecommendation.fromName,
                    toName: reallocationRecommendation.toName,
                  } : null}
                  isReallocating={isReallocating}
                  handleReallocate={handleReallocate}
                />

                {/* ── Centro de Economia + Quick Wins ── */}
                <div className="space-y-5">

                  {/* ── SEÇÃO: Insights e Análises Automáticas ── */}
                  <InsightsCard
                    insights={insights}
                  />

                  {/* ── SEÇÃO: Quick Wins - Ações de Otimização ── */}
                  <QuickWinsGrid
                    optimizationSummary={optimizationSummary}
                    onSetLimit={(categoryId: string, amount: number) =>
                      setCategoryLimit(categoryId, amount).then(r => ({ error: r.error }))
                    }
                    onReallocate={async (fromId: string, toId: string, amount: number) => {
                      const fromLimit = currentMonthExpenseLimitMap.get(fromId) ?? 0
                      const toLimit = currentMonthExpenseLimitMap.get(toId) ?? 0
                      const fromNewLimit = Math.max(0, fromLimit - amount)
                      const toNewLimit = toLimit + amount
                      await setCategoryLimit(fromId, fromNewLimit)
                      await setCategoryLimit(toId, toNewLimit)
                      refreshLimits()
                    }}
                    onRefreshInsights={refreshInsights}
                  />

                </div>

                {/* Detalhamento: Fluxo Diário → Limites */}
                <div className="space-y-5">

                  {/* ── SEÇÃO: Gráfico de Fluxo Diário ── */}
                  <Card className={cn(CARD_BASE, CARD_PADDING, "transition-all duration-300")}>
                    <div className="mb-4 border-b border-glass/40 pb-3 flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                          Fluxo Diário
                        </h3>
                        <p className="text-[10px] text-secondary mt-0.5">
                          Entradas, saídas e investimentos por dia em {formatMonth(currentMonth)}
                        </p>
                      </div>
                    </div>

                    <div className="w-full mt-2">
                      <DailyFlowChart
                        data={dailyFlowData}
                        hiddenSeries={hiddenDailyFlowSeries}
                        onToggleSeries={toggleDailyFlowSeries}
                      />
                    </div>
                  </Card>

                  {/* ── SEÇÃO: Controle de Limites (Riscos e Alertas) ── */}
                  <div className={categoriesAttentionList.length === 0 ? 'hidden' : 'block'}>
                    <LimitsControl
                      categoriesAttentionList={categoriesAttentionList}
                      onCategoryClick={openExpenseCategoryDetails}
                    />
                  </div>

                </div>

              </div>
            )}
              </>
            )}
          </div>
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
      <DashboardCategoryDetailModal
        isOpen={Boolean(selectedExpenseCategory)}
        onClose={() => setSelectedExpenseCategory(null)}
        category={selectedExpenseCategory}
        details={selectedExpenseCategoryDetails}
        limitDetails={selectedExpenseCategoryLimitDetails}
        miniChartItems={miniChartItems}
        currentMonth={currentMonth}
        previousMonth={previousMonth}
        expenses={expenses}
        expenseAmountForDashboard={expenseAmountForDashboard}
        colorPalette={colorPalette}
        getCategoryColorForPalette={getCategoryColorForPalette}
      />

    </div>
    )
  }
