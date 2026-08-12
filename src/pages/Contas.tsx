import { useMemo, useState } from 'react'
import { usePageActions } from '@/hooks/usePageActions'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import { SkeletonContas } from '@/components/Skeleton'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useDebts } from '@/hooks/useDebts'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useContasBills } from '@/hooks/useContasBills'
import { useContasModals } from '@/hooks/useContasModals'
import { useContasActions } from '@/hooks/useContasActions'
import { useContasDerivedData, type DebtFilter } from '@/hooks/useContasDerivedData'
import { useContasNavigation } from '@/hooks/useContasNavigation'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import CreditCardSection from '@/components/creditCards/CreditCardSection'
import DebtsSection from '@/components/debts/DebtsSection'
import ContasModals from '@/components/contas/ContasModals'
import ContasStats from '@/components/contas/ContasStats'
import { useSearchHighlight } from '@/utils/pageTitles'
import { getCurrentMonthString } from '@/utils/format'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'

export default function Contas() {
  useSearchHighlight()
  const modals = useContasModals()

  usePageActions([
    {
      icon: Plus,
      label: 'Adicionar',
      intent: 'primary',
      onClick: () => modals.setIsAddSelectorOpen(true),
      compactOnMobile: true,
    },
  ])
  const [searchParams] = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const swipeHandlers = useSwipeMonth(currentMonth, setCurrentMonth)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const isMobile = useMediaQuery('(max-width: 639px)')

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const {
    creditCards,
    loading: loadingCards,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
    refreshCreditCards,
  } = useCreditCards()

  const {
    debts,
    loading: loadingDebts,
    createDebt,
    updateDebt,
    deleteDebt,
  } = useDebts()

  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { createExpense, updateExpense, deleteExpense } = useExpenses()
  const { createIncome } = useIncomes()
  useAppSettings()

  const billData = useContasBills(currentMonth, creditCards)
  const {
    expensesByCard,
    paymentsByCard,
    baseExpensesByCard,
    billItemsByCard,
    paymentItemsByCard,
    monthlyCyclesByCard,
    loadingBills,
    fetchReconciliationCandidates,
    loadBillData,
  } = billData

  const actions = useContasActions({
    modals,
    currentMonth,
    debts,
    incomeCategories,
    monthlyCyclesByCard,
    createExpense,
    updateExpense,
    deleteExpense,
    createIncome,
    createDebt,
    updateDebt,
    deleteDebt,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
    refreshCreditCards,
    loadBillData,
  })

  const [debtFilter, setDebtFilter] = useState<DebtFilter>('all')

  const {
    activeCards,
    pendingDebts,
    payablePendingCount,
    receivablePendingCount,
    filteredPendingDebts,
    confirmedDebts,
    stats,
  } = useContasDerivedData({
    debts,
    creditCards,
    currentMonth,
    debtFilter,
    paymentsByCard,
    baseExpensesByCard,
  })

  const loading = loadingCards || loadingDebts

  const cycleCard = useMemo(() => {
    return creditCards.find(c => c.id === modals.selectedCardIdForCycle) || null
  }, [creditCards, modals.selectedCardIdForCycle])

  const hasResolvedInitialMonth = useContasNavigation({
    searchParams,
    currentMonth,
    creditCards,
    expensesByCard,
    loadingCards,
    loadingBills,
    isMobile,
    setCurrentMonth,
    setExpandedItems,
    loadBillData,
  })

  return (
    <div className="animate-page-enter min-h-[calc(100dvh-12rem)] flex flex-col" {...swipeHandlers}>
      <div className="p-4 lg:p-6 space-y-6">
        {hasResolvedInitialMonth ? (
          <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
        ) : (
          <div className="mb-4 h-10" aria-hidden="true" />
        )}

        {loading || !hasResolvedInitialMonth || loadingBills ? (
          <SkeletonContas />
        ) : (
          <MonthTransitionView month={currentMonth}>
            {/* KPI Cards Summary */}
            <ContasStats stats={stats} />

            <div className="space-y-6">
              {/* SEÇÃO 1: CARTÕES DE CRÉDITO */}
              <CreditCardSection
                activeCards={activeCards}
                currentMonth={currentMonth}
                expandedItems={expandedItems}
                onToggleExpand={toggleExpand}
                expensesByCard={expensesByCard}
                paymentsByCard={paymentsByCard}
                baseExpensesByCard={baseExpensesByCard}
                billItemsByCard={billItemsByCard}
                paymentItemsByCard={paymentItemsByCard}
                monthlyCyclesByCard={monthlyCyclesByCard}
                onCreateCard={modals.openCreateCardModal}
                onEditCard={modals.openEditCardModal}
                onOpenCycle={modals.openCycleModal}
                onOpenRefund={modals.openRefundModal}
                onOpenPayment={modals.openPaymentModal}
                onOpenCsv={modals.setReconciliationCardId}
                onOpenExpenseEdit={modals.openExpenseEditModal}
                onOpenPaymentItem={actions.handleOpenPaymentItem}
              />

              {/* SEÇÃO 2: PENDÊNCIAS (A PAGAR E A RECEBER) */}
              <DebtsSection
                pendingDebts={pendingDebts}
                payablePendingCount={payablePendingCount}
                receivablePendingCount={receivablePendingCount}
                filteredPendingDebts={filteredPendingDebts}
                confirmedDebts={confirmedDebts}
                debtFilter={debtFilter}
                onDebtFilterChange={setDebtFilter}
                expandedItems={expandedItems}
                onToggleExpand={toggleExpand}
                onCreateDebt={modals.openCreateDebtModal}
                onEditDebt={modals.openEditDebtModal}
                onDeleteDebt={actions.handleDeleteDebt}
                onToggleDebtStatus={actions.handleToggleDebtStatus}
              />
            </div>
          </MonthTransitionView>
        )}
      </div>

      <ContasModals
        modals={modals}
        actions={actions}
        currentMonth={currentMonth}
        creditCards={creditCards}
        categories={categories}
        incomeCategories={incomeCategories}
        cycleCard={cycleCard}
        billItemsByCard={billItemsByCard}
        monthlyCyclesByCard={monthlyCyclesByCard}
        loading={loading}
        loadingCards={loadingCards}
        loadingBills={loadingBills}
        loadingDebts={loadingDebts}
        createExpense={createExpense}
        updateExpense={updateExpense}
        deleteExpense={deleteExpense}
        deleteDebt={deleteDebt}
        fetchReconciliationCandidates={fetchReconciliationCandidates}
        loadBillData={loadBillData}
      />
    </div>
  )
}
