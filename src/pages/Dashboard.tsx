import { useEffect, useReducer } from 'react'
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
import QuickLaunchOption from '@/components/dashboard/QuickLaunchOption'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import IncomeFormModal from '@/components/IncomeFormModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import DashboardWidgetGrid from '@/components/dashboard/DashboardWidgetGrid'
import WidgetSettingsSheet from '@/components/dashboard/WidgetSettingsSheet'
import { useDashboardLayout } from '@/hooks/useDashboardLayout'
import {
  DashboardDataProvider,
  useDashboardData,
  useDashboardActions,
  useDashboardPortfolioContext,
} from '@/contexts/DashboardDataContext'

/* ------------------------------------------------------------------ */
/*  Modal state (useReducer)                                           */
/* ------------------------------------------------------------------ */

type ModalState = 'closed' | 'selector' | 'expense' | 'income' | 'investment' | 'settings'

type ModalAction =
  | { type: 'OPEN'; modal: ModalState }
  | { type: 'CLOSE' }

function modalReducer(_state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN': return action.modal
    case 'CLOSE': return 'closed'
  }
}

/* ------------------------------------------------------------------ */
/*  Inner Component                                                    */
/* ------------------------------------------------------------------ */

function DashboardContent() {
  const navigate = useNavigate()
  const [modal, dispatch] = useReducer(modalReducer, 'closed')

  // ── Layout dos widgets (compartilhado entre grid e settings) ──
  const layout = useDashboardLayout()

  // ── Data Layer (via contexto) ──
  const {
    loading,
    hasMonthlyData,
    categories,
    creditCards,
    refreshExpenses,
    refreshIncomes,
  } = useDashboardData()

  const {
    portfolioId,
    loadPortfolioTransactions,
  } = useDashboardPortfolioContext()

  const {
    incomeCategories,
    createExpense,
    createIncome,
    isOnline,
  } = useDashboardActions()

  const isAnyModalOpen = modal !== 'closed'

  // ── Side Effects ──
  useEffect(() => {
    if (!loading && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [loading, categories.length, incomeCategories.length, navigate])

  useEffect(() => {
    const onDataChanged = () => {
      if (isOnline) void loadPortfolioTransactions()
    }
    if (isOnline) void loadPortfolioTransactions()
    window.addEventListener('local-data-changed', onDataChanged)
    return () => window.removeEventListener('local-data-changed', onDataChanged)
  }, [isOnline, loadPortfolioTransactions])

  usePageActions(
    [{
      icon: Plus,
      label: 'Lançamento',
      intent: 'primary',
      actionRole: 'launch',
      compactOnMobile: false,
      onClick: () => dispatch({ type: 'OPEN', modal: 'selector' }),
      disabled: categories.length === 0 && incomeCategories.length === 0,
    }],
    isAnyModalOpen,
  )

  // ── Render ──
  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col">
      <div className={cn(CONTENT_PADDING, PAGE_ENTER_ANIMATION)}>
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
              onClick={() => dispatch({ type: 'OPEN', modal: 'selector' })}
            >
              <Plus size={16} />
              Adicionar lançamento
            </Button>
          </Card>
        ) : (
          <DashboardWidgetGrid
            layout={layout}
            onOpenSettings={() => dispatch({ type: 'OPEN', modal: 'settings' })}
          />
        )}
      </div>

      {/* ── Modals ── */}
      <Modal isOpen={modal === 'selector'} onClose={() => dispatch({ type: 'CLOSE' })} title="Novo lançamento">
        <div className="modal-body-stack">
          <ModalIntro align="center">Escolha o tipo de lançamento que deseja adicionar:</ModalIntro>
          <ModalChoiceGrid>
            <QuickLaunchOption
              label="Renda"
              icon={<TrendingUp size={24} />}
              borderHoverClass="hover:border-income"
              iconWrapClass="bg-income/10 text-income"
              onClick={() => dispatch({ type: 'OPEN', modal: 'income' })}
            />
            <QuickLaunchOption
              label="Despesa"
              icon={<TrendingDown size={24} />}
              borderHoverClass="hover:border-expense"
              iconWrapClass="bg-expense/10 text-expense"
              onClick={() => dispatch({ type: 'OPEN', modal: 'expense' })}
            />
            <QuickLaunchOption
              label="Investimento"
              icon={<PiggyBank size={24} />}
              borderHoverClass="hover:border-balance"
              iconWrapClass="bg-balance/10 text-balance"
              onClick={() => {
                if (isOnline && !portfolioId) void loadPortfolioTransactions()
                dispatch({ type: 'OPEN', modal: 'investment' })
              }}
            />
          </ModalChoiceGrid>
        </div>
      </Modal>

      <ExpenseFormModal
        isOpen={modal === 'expense'}
        onClose={() => dispatch({ type: 'CLOSE' })}
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
        isOpen={modal === 'income'}
        onClose={() => dispatch({ type: 'CLOSE' })}
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
        isOpen={modal === 'investment'}
        onClose={() => dispatch({ type: 'CLOSE' })}
        portfolioId={portfolioId}
        editingTransaction={null}
        onSaved={() => { void loadPortfolioTransactions() }}
      />

      {/* ── Widget Settings Sheet ── */}
      <WidgetSettingsSheet
        layout={layout}
        isOpen={modal === 'settings'}
        onClose={() => dispatch({ type: 'CLOSE' })}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page entry                                                        */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  return (
    <DashboardDataProvider>
      <DashboardContent />
    </DashboardDataProvider>
  )
}
