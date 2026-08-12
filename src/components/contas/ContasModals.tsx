import { todayISO } from '@/utils/format'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import QuickLaunchOption from '@/components/dashboard/QuickLaunchOption'
import CreditCardCsvReconciliationPanel from '@/components/CreditCardCsvReconciliationPanel'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import CardFormModal from '@/components/creditCards/CardFormModal'
import BillPaymentModal from '@/components/creditCards/BillPaymentModal'
import RefundModal from '@/components/creditCards/RefundModal'
import CycleConfigModal from '@/components/creditCards/CycleConfigModal'
import DeleteCardConfirmModal from '@/components/creditCards/DeleteCardConfirmModal'
import ExpenseEditModal from '@/components/creditCards/ExpenseEditModal'
import RefundIncomeEditModal from '@/components/creditCards/RefundIncomeEditModal'
import DebtFormModal from '@/components/debts/DebtFormModal'
import DeleteInstallmentsModal from '@/components/DeleteInstallmentsModal'
import ConfirmModal from '@/components/ConfirmModal'
import {
  IncomeConfirmModal,
  IntegratedDebtModal,
  PayableConfirmModal,
} from '@/components/debts/DebtActionConfirmModals'
import { Scale, CreditCard as CreditCardIcon } from 'lucide-react'
import type { CreditCard, Category, IncomeCategory, Expense } from '@/types'
import type { BillExpenseItem, BillPaymentDisplayItem } from '@/utils/creditCardBilling'
import type { MonthlyCycleRow } from '@/components/creditCards/CreditCardTimeline'
import type { UseContasModalsReturn } from '@/hooks/useContasModals'
import type { UseContasActionsReturn } from '@/hooks/useContasActions'

interface ContasModalsProps {
  modals: UseContasModalsReturn
  actions: UseContasActionsReturn
  currentMonth: string
  creditCards: CreditCard[]
  categories: Category[]
  incomeCategories: IncomeCategory[]
  cycleCard: CreditCard | null
  billItemsByCard: Record<string, BillExpenseItem[]>
  paymentItemsByCard: Record<string, BillPaymentDisplayItem[]>
  monthlyCyclesByCard: Record<string, MonthlyCycleRow>
  loading: boolean
  loadingCards: boolean
  loadingBills: boolean
  loadingDebts: boolean
  createExpense: (data: Omit<Expense, 'id' | 'created_at' | 'category' | 'credit_card'>) => Promise<{ data: Expense | null; error: string | null }>
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<{ data: Expense | null; error: string | null }>
  deleteExpense: (id: string, mode?: 'single' | 'all' | 'subsequent') => Promise<{ error: string | null }>
  deleteDebt: (id: string, mode?: 'single' | 'all' | 'subsequent') => Promise<{ error: string | null }>
  fetchReconciliationCandidates: (cardId: string, baseMonth: string) => Promise<BillExpenseItem[]>
  loadBillData: (silent?: boolean) => Promise<void>
}

/**
 * ContasModals — renderização centralizada dos 14 modais da página Contas
 * (extraída de Contas.tsx). Recebe o estado de modais, os handlers de ação e
 * os dados necessários, mantendo a página como orquestrador enxuto.
 */
export default function ContasModals({
  modals,
  actions,
  currentMonth,
  creditCards,
  categories,
  incomeCategories,
  cycleCard,
  billItemsByCard,
  paymentItemsByCard,
  monthlyCyclesByCard,
  loading,
  loadingCards,
  loadingBills,
  loadingDebts,
  createExpense,
  updateExpense,
  deleteExpense,
  deleteDebt,
  fetchReconciliationCandidates,
  loadBillData,
}: ContasModalsProps) {
  return (
    <>
      {/* MODAL: CARTÃO DE CRÉDITO */}
      <CardFormModal
        isOpen={modals.isCardModalOpen}
        onClose={modals.closeCardModal}
        onSubmit={actions.handleSubmitCard}
        editingCard={modals.editingCard}
        loading={loadingCards}
        onStartDelete={modals.handleStartDelete}
      />

      {/* CONFIRM MODAL: DELETAR CARTÃO */}
      <DeleteCardConfirmModal
        isOpen={modals.isDeleteConfirmModalOpen}
        onClose={modals.handleCancelDelete}
        onConfirm={actions.handleConfirmDelete}
        editingCard={modals.editingCard}
        creditCards={creditCards}
        isDeleting={modals.isDeleting}
        hasExpensesLinked={
          modals.editingCard
            ? (billItemsByCard[modals.editingCard.id] || []).length > 0
            : false
        }
      />

      {/* MODAL: AJUSTAR CICLO */}
      <CycleConfigModal
        isOpen={modals.isCycleModalOpen}
        onClose={modals.closeCycleModal}
        onSubmit={actions.handleSubmitCycle}
        onReset={actions.handleResetCycleToCardDefault}
        currentMonth={currentMonth}
        initialClosingDay={
          cycleCard
            ? monthlyCyclesByCard[modals.selectedCardIdForCycle]?.closing_day ||
              cycleCard.closing_day
            : 8
        }
        initialDueDay={
          cycleCard
            ? monthlyCyclesByCard[modals.selectedCardIdForCycle]?.due_day ||
              cycleCard.due_day
            : 15
        }
        loading={loadingBills}
      />

      {/* MODAL: EDITAR DESPESA DA FATURA */}
      <ExpenseEditModal
        isOpen={modals.isExpenseEditModalOpen}
        onClose={modals.closeExpenseEditModal}
        onSubmit={actions.handleSubmitEditExpense}
        onDelete={actions.handleDeleteExpense}
        expenseItem={modals.editingExpenseItem}
        categories={categories}
        creditCards={creditCards}
        loading={loading}
      />

      {/* MODAL: EDITAR PAGAMENTO INDIVIDUAL */}
      <BillPaymentModal
        isOpen={modals.isPaymentEditModalOpen}
        onClose={modals.closePaymentEditModal}
        onSubmit={actions.handleSubmitEditPayment}
        onDelete={actions.handleDeletePayment}
        currentMonth={currentMonth}
        editingPayment={modals.editingPaymentItem}
        loading={loading}
      />

      {/* MODAL: EDITAR ESTORNO (RENDA) */}
      <RefundIncomeEditModal
        isOpen={modals.isRefundIncomeEditModalOpen}
        onClose={modals.closeRefundIncomeEditModal}
        onSubmit={actions.handleSubmitEditRefundIncome}
        onDelete={actions.handleDeleteRefundIncome}
        initialData={modals.editingRefundIncomeInitialData}
        incomeCategories={incomeCategories}
        loading={loading}
      />

      {/* MODAL: ESTORNO NOVO */}
      <RefundModal
        isOpen={modals.isRefundModalOpen}
        onClose={modals.closeRefundModal}
        onSubmit={actions.handleSubmitRefund}
        currentMonth={currentMonth}
        loading={loading}
      />

      {/* MODAL: REGISTRAR PAGAMENTO FATURA */}
      <BillPaymentModal
        isOpen={modals.isPaymentModalOpen}
        onClose={modals.closePaymentModal}
        onSubmit={actions.handleSubmitPayment}
        currentMonth={currentMonth}
        editingPayment={null}
        loading={loading}
      />

      {/* MODAL: NOVO/EDITAR LANÇAMENTO DE PENDÊNCIA */}
      <DebtFormModal
        isOpen={modals.isDebtModalOpen}
        onClose={modals.closeDebtModal}
        onSubmit={actions.handleSubmitDebt}
        editingDebt={modals.editingDebt}
        loading={loadingDebts}
      />

      {/* MODAL: CONCILIAÇÃO DE FATURA */}
      <Modal
        isOpen={!!modals.reconciliationCardId}
        onClose={() => modals.setReconciliationCardId('')}
        title={`Conciliação de Fatura (${currentMonth})`}
        size="2xl"
      >
        {modals.reconciliationCardId && (() => {
          const card = creditCards.find((c) => c.id === modals.reconciliationCardId)
          if (!card) return null
          return (
            <CreditCardCsvReconciliationPanel
              card={card}
              currentMonth={currentMonth}
              paymentItems={paymentItemsByCard[card.id] || []}
              categories={categories.map((category) => ({
                id: category.id,
                name: category.name,
              }))}
              onReloadBillData={loadBillData}
              createExpense={createExpense}
              updateExpense={updateExpense}
              fetchReconciliationCandidates={fetchReconciliationCandidates}
            />
          )
        })()}
      </Modal>

      {/* MODAL: SELETOR DE NOVO LANÇAMENTO (PADRÃO DASHBOARD) */}
      <Modal
        isOpen={modals.isAddSelectorOpen}
        onClose={() => modals.setIsAddSelectorOpen(false)}
        title="Novo lançamento em Contas"
      >
        <div className="modal-body-stack">
          <ModalIntro align="center">Escolha o tipo de registro que deseja adicionar em Contas:</ModalIntro>
          <ModalChoiceGrid>
            <QuickLaunchOption
              label="Cartão de Crédito"
              icon={<CreditCardIcon size={24} />}
              borderHoverClass="hover:border-balance"
              iconWrapClass="bg-balance/10 text-balance"
              onClick={() => {
                modals.setIsAddSelectorOpen(false)
                modals.openCreateCardModal()
              }}
            />
            <QuickLaunchOption
              label="Pendência"
              icon={<Scale size={24} />}
              borderHoverClass="hover:border-expense"
              iconWrapClass="bg-expense/10 text-expense"
              onClick={() => {
                modals.setIsAddSelectorOpen(false)
                modals.openCreateDebtModal()
              }}
            />
          </ModalChoiceGrid>
        </div>
      </Modal>

      {/* MODAL: CONFIRMAR RECEBIMENTO (CRIAR RENDA) */}
      <IncomeConfirmModal
        isOpen={modals.isIncomeConfirmModalOpen}
        onClose={() => {
          modals.setIsIncomeConfirmModalOpen(false)
          modals.setSelectedDebtForIncome(null)
        }}
        debt={modals.selectedDebtForIncome}
        onConfirmWithIncome={actions.handleConfirmWithIncome}
        onConfirmWithoutIncome={actions.handleConfirmWithoutIncome}
      />

      {/* MODAL: CONFIRMAR RECEBIMENTO INTEGRADO (DESPESA VINCULADA) */}
      <IntegratedDebtModal
        isOpen={modals.isIntegratedModalOpen}
        onClose={() => {
          modals.setIsIntegratedModalOpen(false)
          modals.setSelectedDebtForIntegrated(null)
          modals.setLinkedExpense(null)
        }}
        debt={modals.selectedDebtForIntegrated}
        linkedExpense={modals.linkedExpense}
        reportValueInput={modals.integratedReportValueInput}
        onReportValueChange={modals.setIntegratedReportValueInput}
        onConfirm={actions.handleConfirmIntegrated}
      />

      {/* MODAL: CONFIRMAR PAGAMENTO DÍVIDA (CADASTRAR DESPESA?) */}
      <PayableConfirmModal
        isOpen={modals.isPayableConfirmModalOpen}
        onClose={() => {
          modals.setIsPayableConfirmModalOpen(false)
          modals.setSelectedDebtForPayableExpense(null)
        }}
        debt={modals.selectedDebtForPayableExpense}
        onConfirmWithExpense={() => {
          modals.setIsPayableConfirmModalOpen(false)
          modals.setIsPayableExpenseModalOpen(true)
        }}
        onConfirmWithoutExpense={actions.handleConfirmPayableWithoutExpenseDirect}
      />

      {/* MODAL: CADASTRAR DESPESA VINCULADA AO PAGAR DÍVIDA */}
      <ExpenseFormModal
        isOpen={modals.isPayableExpenseModalOpen}
        onClose={() => {
          modals.setIsPayableExpenseModalOpen(false)
          modals.setSelectedDebtForPayableExpense(null)
        }}
        editingExpense={null}
        categories={categories}
        creditCards={creditCards}
        onCreate={actions.handleCreateExpenseForPayable}
        onUpdate={async () => ({ data: null, error: 'Não implementado nesta ação' })}
        onDelete={async () => ({ error: 'Não implementado nesta ação' })}
        defaultValues={modals.selectedDebtForPayableExpense ? {
          amount: modals.selectedDebtForPayableExpense.amount,
          description: modals.selectedDebtForPayableExpense.name,
          date: modals.selectedDebtForPayableExpense.due_date || todayISO(),
        } : undefined}
      />

      {modals.deleteModalState?.isOpen && (
        <DeleteInstallmentsModal
          isOpen={modals.deleteModalState.isOpen}
          onClose={() => modals.setDeleteModalState(null)}
          onConfirm={async (mode) => {
            const state = modals.deleteModalState
            if (!state) return
            if (state.type === 'expense') {
              const { error } = await deleteExpense(state.id, mode)
              if (error) {
                alert(`Erro ao excluir despesa: ${error}`)
              } else {
                await loadBillData(true)
              }
            } else {
              const { error } = await deleteDebt(state.id, mode)
              if (error) {
                alert(`Erro ao excluir cobrança: ${error}`)
              }
            }
          }}
          type={modals.deleteModalState.type}
          installmentNumber={modals.deleteModalState.installmentNumber}
          installmentTotal={modals.deleteModalState.installmentTotal}
        />
      )}

      <ConfirmModal
        isOpen={modals.deleteConfirmState?.isOpen || false}
        onClose={() => modals.setDeleteConfirmState(null)}
        title={modals.deleteConfirmState?.title || 'Confirmar exclusão'}
        confirmLabel="Confirmar"
        confirmVariant="danger"
        requireCheckbox={true}
        checkboxLabel={modals.deleteConfirmState?.checkboxLabel}
        onConfirm={async () => {
          if (modals.deleteConfirmState?.onConfirm) {
            await modals.deleteConfirmState.onConfirm()
            modals.setDeleteConfirmState(null)
          }
        }}
      >
        <p className="text-sm text-primary">{modals.deleteConfirmState?.message}</p>
      </ConfirmModal>
    </>
  )
}
