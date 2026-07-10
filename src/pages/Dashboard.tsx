import { useEffect, useState } from 'react'
import { usePageActions } from '@/hooks/usePageActions'
import Card from '@/components/Card'
import { SkeletonDashboard } from '@/components/Skeleton'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, PiggyBank, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CARD_PADDING_XL,
  CARD_BASE,
  PAGE_ENTER_ANIMATION,
  CONTENT_PADDING,
} from '@/constants/layout'
import Button from '@/components/Button'
import FinancialHealthCard from '@/components/dashboard/FinancialHealthCard'
import QuickLaunchOption from '@/components/dashboard/QuickLaunchOption'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import IncomeFormModal from '@/components/IncomeFormModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import DailyFlowCard from '@/components/dashboard/DailyFlowCard'
import ActionsEconomyCard from '@/components/dashboard/ActionsEconomyCard'
import { useDashboardData } from '@/hooks/useDashboardData'

export default function Dashboard() {
  const navigate = useNavigate()

  // ── UI State ──
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [isIncomeOpen, setIsIncomeOpen] = useState(false)
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false)
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState<string[]>([])

  // ── Data Layer ──
  const {
    loading,
    hasMonthlyData,
    currentMonth,
    balance,
    savingsRate,
    totalIncomes,
    totalExpenses,
    spendingCalcs,
    spendingProjection,
    totalLimits,
    limitUsedPercentage,
    progressColor,
    dailyFlowData,
    insights,
    refreshInsights,
    optimizationSummary,
    portfolioId,
    categories,
    incomeCategories,
    creditCards,
    currentMonthExpenseLimitMap,
    createExpense,
    createIncome,
    setCategoryLimit,
    refreshExpenses,
    refreshIncomes,
    refreshLimits,
    loadPortfolioTransactions,
    isOnline,
  } = useDashboardData()

  // ── Handlers ──
  const toggleDailyFlowSeries = (dataKey: string) => {
    setHiddenDailyFlowSeries((prev) =>
      prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey]
    )
  }

  const isAnyModalOpen = isSelectorOpen || isExpenseOpen || isIncomeOpen || isInvestmentOpen

  // ── Side Effects ──
  useEffect(() => {
    if (!loading && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [loading, categories.length, incomeCategories.length, navigate])

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

  // ── Render ──
  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col">
      <div className={cn(CONTENT_PADDING, PAGE_ENTER_ANIMATION)}>
        <div>
          {loading ? (
            <div className="animate-fade-in">
              <SkeletonDashboard />
            </div>
          ) : !hasMonthlyData ? (
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
              {/* Saúde Financeira (Saldo + Orçamento + Projeção) */}
              <FinancialHealthCard
                spendingCalcs={spendingCalcs}
                projection={spendingProjection}
                totalIncomes={totalIncomes}
                totalExpenses={totalExpenses}
                totalLimits={totalLimits}
                limitUsedPercentage={limitUsedPercentage}
                progressColor={progressColor}
                balance={balance}
                savingsRate={savingsRate}
              />

              {/* Ações e Economia (alertas + quick wins + assinaturas) */}
              <ActionsEconomyCard
                insights={insights}
                optimizationSummary={optimizationSummary}
                onReallocate={async (fromId: string, toId: string, amount: number) => {
                  const fromLimit = currentMonthExpenseLimitMap.get(fromId) ?? 0
                  const toLimit = currentMonthExpenseLimitMap.get(toId) ?? 0
                  await setCategoryLimit(fromId, Math.max(0, fromLimit - amount))
                  await setCategoryLimit(toId, toLimit + amount)
                  refreshLimits()
                }}
                onRefreshInsights={refreshInsights}
              />

              {/* Fluxo Diário (collapsible) */}
              <DailyFlowCard
                data={dailyFlowData}
                hiddenSeries={hiddenDailyFlowSeries}
                onToggleSeries={toggleDailyFlowSeries}
                currentMonth={currentMonth}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <Modal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} title="Novo lançamento">
        <div className="modal-body-stack">
          <ModalIntro align="center">Escolha o tipo de lançamento que deseja adicionar:</ModalIntro>
          <ModalChoiceGrid>
            <QuickLaunchOption
              label="Renda"
              icon={<TrendingUp size={24} />}
              borderHoverClass="hover:border-income"
              iconWrapClass="bg-income/10 text-income"
              onClick={() => { setIsSelectorOpen(false); setIsIncomeOpen(true) }}
            />
            <QuickLaunchOption
              label="Despesa"
              icon={<TrendingDown size={24} />}
              borderHoverClass="hover:border-expense"
              iconWrapClass="bg-expense/10 text-expense"
              onClick={() => { setIsSelectorOpen(false); setIsExpenseOpen(true) }}
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
          if (!res.error) refreshExpenses()
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
          if (!res.error) refreshIncomes()
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
        onSaved={() => { void loadPortfolioTransactions() }}
      />
    </div>
  )
}
