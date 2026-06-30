import { useState, useCallback } from 'react'
import type { CreditCard, Debt, Expense } from '@/types'
import type { BillExpenseItem, BillPaymentDisplayItem } from '@/utils/creditCardBilling'

export interface DeleteConfirmState {
  isOpen: boolean
  title: string
  message: string
  checkboxLabel?: string
  onConfirm: () => Promise<void>
}

export interface DeleteModalState {
  isOpen: boolean
  type: 'expense' | 'debt'
  id: string
  installmentNumber: number
  installmentTotal: number
}

export interface RefundIncomeInitialData {
  amount: string
  report_amount: string
  date: string
  income_category_id: string
  description: string
}

export interface UseContasModalsReturn {
  // Card modals
  isCardModalOpen: boolean
  editingCard: CreditCard | null
  isDeleteConfirmModalOpen: boolean
  isDeleting: boolean
  isPaymentModalOpen: boolean
  paymentCardId: string
  isPaymentEditModalOpen: boolean
  editingPaymentItem: BillPaymentDisplayItem | null
  isRefundModalOpen: boolean
  refundCardId: string
  isCycleModalOpen: boolean
  selectedCardIdForCycle: string
  isExpenseEditModalOpen: boolean
  editingExpenseItem: BillExpenseItem | null
  isRefundIncomeEditModalOpen: boolean
  editingRefundPaymentItem: BillPaymentDisplayItem | null
  editingRefundIncomeId: string
  editingRefundIncomeInitialData: RefundIncomeInitialData | null
  reconciliationCardId: string

  // Debt modals
  isDebtModalOpen: boolean
  editingDebt: Debt | null
  isIncomeConfirmModalOpen: boolean
  selectedDebtForIncome: Debt | null
  isIntegratedModalOpen: boolean
  selectedDebtForIntegrated: Debt | null
  linkedExpense: Expense | null
  integratedReportValueInput: string
  isPayableConfirmModalOpen: boolean
  selectedDebtForPayableExpense: Debt | null
  isPayableExpenseModalOpen: boolean
  deleteModalState: DeleteModalState | null
  deleteConfirmState: DeleteConfirmState | null

  // UI modals
  isAddSelectorOpen: boolean

  // Card modal actions
  openCreateCardModal: () => void
  openEditCardModal: (card: CreditCard) => void
  closeCardModal: () => void
  handleStartDelete: () => void
  handleCancelDelete: () => void
  setDeleting: (v: boolean) => void
  openPaymentModal: (cardId: string) => void
  closePaymentModal: () => void
  openRefundModal: (cardId: string) => void
  closeRefundModal: () => void
  openPaymentEditModal: (item: BillPaymentDisplayItem) => void
  closePaymentEditModal: () => void
  openExpenseEditModal: (item: BillExpenseItem) => void
  closeExpenseEditModal: () => void
  setEditingRefundPaymentItem: (item: BillPaymentDisplayItem | null) => void
  setEditingRefundIncomeId: (id: string) => void
  setEditingRefundIncomeInitialData: (data: RefundIncomeInitialData | null) => void
  openCycleModal: (card: CreditCard) => void
  closeCycleModal: () => void
  setReconciliationCardId: (id: string) => void

  // Refund income edit
  setIsRefundIncomeEditModalOpen: (v: boolean) => void
  closeRefundIncomeEditModal: () => void

  // Debt modal actions
  openCreateDebtModal: () => void
  openEditDebtModal: (debt: Debt) => void
  closeDebtModal: () => void
  setDeleteModalState: (state: DeleteModalState | null) => void
  setDeleteConfirmState: (state: DeleteConfirmState | null) => void
  setIsIncomeConfirmModalOpen: (v: boolean) => void
  setSelectedDebtForIncome: (debt: Debt | null) => void
  setIsIntegratedModalOpen: (v: boolean) => void
  setSelectedDebtForIntegrated: (debt: Debt | null) => void
  setLinkedExpense: (expense: Expense | null) => void
  setIntegratedReportValueInput: (v: string) => void
  setIsPayableConfirmModalOpen: (v: boolean) => void
  setSelectedDebtForPayableExpense: (debt: Debt | null) => void
  setIsPayableExpenseModalOpen: (v: boolean) => void

  // Actions
  handleConfirmWithIncome: (
    selectedDebtForIncome: Debt | null,
    createIncome: (data: any) => Promise<{ error: string | null }>,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
    resolveIncomeCategoryId: () => Promise<string>,
  ) => Promise<void>
  handleConfirmWithoutIncome: (
    selectedDebtForIncome: Debt | null,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
  ) => Promise<void>
  handleConfirmIntegrated: (
    selectedDebtForIntegrated: Debt | null,
    linkedExpense: Expense | null,
    integratedReportValueInput: string,
    updateExpense: (id: string, data: any) => Promise<{ error: string | null }>,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
  ) => Promise<void>
  handleConfirmPayableWithoutExpenseDirect: (
    selectedDebtForPayableExpense: Debt | null,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
  ) => Promise<void>
  handleToggleDebtStatus: (
    debt: Debt,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
    supabaseFrom: (table: string) => any,
    setIntegratedModals: {
      setLinkedExpense: (e: Expense | null) => void
      setSelectedDebtForIntegrated: (d: Debt | null) => void
      setIntegratedReportValueInput: (v: string) => void
      setIsIntegratedModalOpen: (v: boolean) => void
      setSelectedDebtForIncome: (d: Debt | null) => void
      setIsIncomeConfirmModalOpen: (v: boolean) => void
      setSelectedDebtForPayableExpense: (d: Debt | null) => void
      setIsPayableConfirmModalOpen: (v: boolean) => void
    },
  ) => Promise<void>

  // UI actions
  setIsAddSelectorOpen: (v: boolean) => void
}

export function useContasModals(): UseContasModalsReturn {
  // ====== Card modals ======
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [paymentCardId, setPaymentCardId] = useState('')
  const [isPaymentEditModalOpen, setIsPaymentEditModalOpen] = useState(false)
  const [editingPaymentItem, setEditingPaymentItem] = useState<BillPaymentDisplayItem | null>(null)
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [refundCardId, setRefundCardId] = useState('')
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false)
  const [selectedCardIdForCycle, setSelectedCardIdForCycle] = useState('')
  const [isExpenseEditModalOpen, setIsExpenseEditModalOpen] = useState(false)
  const [editingExpenseItem, setEditingExpenseItem] = useState<BillExpenseItem | null>(null)
  const [isRefundIncomeEditModalOpen, setIsRefundIncomeEditModalOpen] = useState(false)
  const [editingRefundPaymentItem, setEditingRefundPaymentItem] = useState<BillPaymentDisplayItem | null>(null)
  const [editingRefundIncomeId, setEditingRefundIncomeId] = useState('')
  const [editingRefundIncomeInitialData, setEditingRefundIncomeInitialData] = useState<RefundIncomeInitialData | null>(null)
  const [reconciliationCardId, setReconciliationCardId] = useState('')
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // ====== Debt modals ======
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [isIncomeConfirmModalOpen, setIsIncomeConfirmModalOpen] = useState(false)
  const [selectedDebtForIncome, setSelectedDebtForIncome] = useState<Debt | null>(null)
  const [isIntegratedModalOpen, setIsIntegratedModalOpen] = useState(false)
  const [selectedDebtForIntegrated, setSelectedDebtForIntegrated] = useState<Debt | null>(null)
  const [linkedExpense, setLinkedExpense] = useState<Expense | null>(null)
  const [integratedReportValueInput, setIntegratedReportValueInput] = useState('')
  const [isPayableConfirmModalOpen, setIsPayableConfirmModalOpen] = useState(false)
  const [selectedDebtForPayableExpense, setSelectedDebtForPayableExpense] = useState<Debt | null>(null)
  const [isPayableExpenseModalOpen, setIsPayableExpenseModalOpen] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState | null>(null)
  const [deleteConfirmState, setDeleteConfirmState] = useState<DeleteConfirmState | null>(null)

  // ====== UI modals ======
  const [isAddSelectorOpen, setIsAddSelectorOpen] = useState(false)

  // ====== Card modal actions ======
  const openCreateCardModal = useCallback(() => {
    setEditingCard(null)
    setIsCardModalOpen(true)
  }, [])

  const openEditCardModal = useCallback((card: CreditCard) => {
    setEditingCard(card)
    setIsCardModalOpen(true)
  }, [])

  const closeCardModal = useCallback(() => {
    setIsCardModalOpen(false)
    setEditingCard(null)
  }, [])

  const handleStartDelete = useCallback(() => {
    setIsDeleteConfirmModalOpen(true)
  }, [])

  const handleCancelDelete = useCallback(() => {
    setIsDeleteConfirmModalOpen(false)
  }, [])

  const setDeleting = useCallback((v: boolean) => {
    setIsDeleting(v)
  }, [])

  const openPaymentModal = useCallback((cardId: string) => {
    setPaymentCardId(cardId)
    setIsPaymentModalOpen(true)
  }, [])

  const closePaymentModal = useCallback(() => {
    setIsPaymentModalOpen(false)
    setPaymentCardId('')
  }, [])

  const openRefundModal = useCallback((cardId: string) => {
    setRefundCardId(cardId)
    setIsRefundModalOpen(true)
  }, [])

  const closeRefundModal = useCallback(() => {
    setIsRefundModalOpen(false)
    setRefundCardId('')
  }, [])

  const openPaymentEditModal = useCallback((item: BillPaymentDisplayItem) => {
    setEditingPaymentItem(item)
    setIsPaymentEditModalOpen(true)
  }, [])

  const closePaymentEditModal = useCallback(() => {
    setIsPaymentEditModalOpen(false)
    setEditingPaymentItem(null)
  }, [])

  const openExpenseEditModal = useCallback((item: BillExpenseItem) => {
    setEditingExpenseItem(item)
    setIsExpenseEditModalOpen(true)
  }, [])

  const closeExpenseEditModal = useCallback(() => {
    setIsExpenseEditModalOpen(false)
    setEditingExpenseItem(null)
  }, [])

  const closeRefundIncomeEditModal = useCallback(() => {
    setIsRefundIncomeEditModalOpen(false)
    setEditingRefundPaymentItem(null)
    setEditingRefundIncomeId('')
    setEditingRefundIncomeInitialData(null)
  }, [])

  const openCycleModal = useCallback((card: CreditCard) => {
    setSelectedCardIdForCycle(card.id)
    setIsCycleModalOpen(true)
  }, [])

  const closeCycleModal = useCallback(() => {
    setIsCycleModalOpen(false)
    setSelectedCardIdForCycle('')
  }, [])

  // ====== Debt modal actions ======
  const openCreateDebtModal = useCallback(() => {
    setEditingDebt(null)
    setIsDebtModalOpen(true)
  }, [])

  const openEditDebtModal = useCallback((debt: Debt) => {
    setEditingDebt(debt)
    setIsDebtModalOpen(true)
  }, [])

  const closeDebtModal = useCallback(() => {
    setIsDebtModalOpen(false)
    setEditingDebt(null)
  }, [])

  // ====== Complex action handlers (extracted as pure logic) ======
  const handleConfirmWithIncome = useCallback(async (
    debt: Debt | null,
    createIncome: (data: any) => Promise<{ error: string | null }>,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
    resolveIncomeCategoryId: () => Promise<string>,
  ) => {
    if (!debt) return
    try {
      const categoryId = await resolveIncomeCategoryId()
      const { error: incomeError } = await createIncome({
        amount: debt.amount,
        description: debt.name,
        date: debt.due_date || new Date().toISOString().slice(0, 10),
        income_category_id: categoryId,
        report_weight: 1.0,
        type: 'other',
      })
      if (incomeError) {
        alert(`Erro ao criar receita: ${incomeError}`)
        return
      }
    } catch (err) {
      alert(`Erro ao criar receita: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      return
    }

    const { error } = await updateDebt(debt.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    setIsIncomeConfirmModalOpen(false)
    setSelectedDebtForIncome(null)
  }, [])

  const handleConfirmWithoutIncome = useCallback(async (
    debt: Debt | null,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
  ) => {
    if (!debt) return
    const { error } = await updateDebt(debt.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    setIsIncomeConfirmModalOpen(false)
    setSelectedDebtForIncome(null)
  }, [])

  const handleConfirmIntegrated = useCallback(async (
    debt: Debt | null,
    linkedExp: Expense | null,
    reportValueInput: string,
    updateExpense: (id: string, data: any) => Promise<{ error: string | null }>,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
  ) => {
    if (!debt || !linkedExp) return
    const { formatCurrency, parseMoneyInput, roundToDecimals } = await import('@/utils/format')

    const parsedVal = parseMoneyInput(reportValueInput)
    if (Number.isNaN(parsedVal) || parsedVal < 0 || parsedVal > linkedExp.amount) {
      alert(`Valor inválido. Deve ser entre 0 e ${formatCurrency(linkedExp.amount)}.`)
      return
    }

    try {
      const reportWeight = linkedExp.amount > 0 ? roundToDecimals(parsedVal / linkedExp.amount, 4) : 1
      const { error: updateExpenseError } = await updateExpense(linkedExp.id, {
        report_weight: reportWeight,
      })

      if (updateExpenseError) {
        alert(`Erro ao atualizar despesa vinculada: ${updateExpenseError}`)
        return
      }

      const { error } = await updateDebt(debt.id, { status: 'paid' })
      if (error) {
        alert(`Erro ao atualizar status do recebimento: ${error}`)
      }
    } catch (err) {
      alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }

    setIsIntegratedModalOpen(false)
    setSelectedDebtForIntegrated(null)
    setLinkedExpense(null)
  }, [])

  const handleConfirmPayableWithoutExpenseDirect = useCallback(async (
    debt: Debt | null,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
  ) => {
    if (debt) {
      const { error } = await updateDebt(debt.id, { status: 'paid' })
      if (error) {
        alert(`Erro ao marcar dívida como paga: ${error}`)
      }
    }
    setIsPayableConfirmModalOpen(false)
    setSelectedDebtForPayableExpense(null)
  }, [])

  const handleToggleDebtStatus = useCallback(async (
    debt: Debt,
    updateDebt: (id: string, data: any) => Promise<{ error: string | null }>,
    supabaseFrom: (table: string) => any,
    setIntegratedModals: {
      setLinkedExpense: (e: Expense | null) => void
      setSelectedDebtForIntegrated: (d: Debt | null) => void
      setIntegratedReportValueInput: (v: string) => void
      setIsIntegratedModalOpen: (v: boolean) => void
      setSelectedDebtForIncome: (d: Debt | null) => void
      setIsIncomeConfirmModalOpen: (v: boolean) => void
      setSelectedDebtForPayableExpense: (d: Debt | null) => void
      setIsPayableConfirmModalOpen: (v: boolean) => void
    },
  ) => {
    const nextStatus = debt.status === 'pending' ? 'paid' : 'pending'

    if (nextStatus === 'paid') {
      if (debt.type === 'receivable') {
        if (debt.expense_id) {
          try {
            const { data: expense, error: fetchExpenseError } = await supabaseFrom('expenses')
              .select('*')
              .eq('id', debt.expense_id)
              .maybeSingle()

            if (fetchExpenseError) throw fetchExpenseError

            if (expense) {
              const { roundToDecimals, formatMoneyInput } = await import('@/utils/format')
              const currentReportValue = roundToDecimals(expense.amount * (expense.report_weight ?? 1), 2)
              const finalValue = Math.max(0, roundToDecimals(currentReportValue - debt.amount, 2))

              setIntegratedModals.setLinkedExpense(expense)
              setIntegratedModals.setSelectedDebtForIntegrated(debt)
              setIntegratedModals.setIntegratedReportValueInput(formatMoneyInput(finalValue))
              setIntegratedModals.setIsIntegratedModalOpen(true)
              return
            }
          } catch (err) {
            alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
            return
          }
        } else {
          setIntegratedModals.setSelectedDebtForIncome(debt)
          setIntegratedModals.setIsIncomeConfirmModalOpen(true)
          return
        }
      } else if (debt.type === 'payable') {
        setIntegratedModals.setSelectedDebtForPayableExpense(debt)
        setIntegratedModals.setIsPayableConfirmModalOpen(true)
        return
      }
    }

    const { error } = await updateDebt(debt.id, { status: nextStatus })
    if (error) {
      alert(`Erro ao atualizar status: ${error}`)
    }
  }, [])

  return {
    // State
    isCardModalOpen,
    editingCard,
    isDeleteConfirmModalOpen,
    isDeleting,
    isPaymentModalOpen,
    paymentCardId,
    isPaymentEditModalOpen,
    editingPaymentItem,
    isRefundModalOpen,
    refundCardId,
    isCycleModalOpen,
    selectedCardIdForCycle,
    isExpenseEditModalOpen,
    editingExpenseItem,
    isRefundIncomeEditModalOpen,
    editingRefundPaymentItem,
    editingRefundIncomeId,
    editingRefundIncomeInitialData,
    reconciliationCardId,
    isDebtModalOpen,
    editingDebt,
    isIncomeConfirmModalOpen,
    selectedDebtForIncome,
    isIntegratedModalOpen,
    selectedDebtForIntegrated,
    linkedExpense,
    integratedReportValueInput,
    isPayableConfirmModalOpen,
    selectedDebtForPayableExpense,
    isPayableExpenseModalOpen,
    deleteModalState,
    deleteConfirmState,
    isAddSelectorOpen,

    // Card actions
    openCreateCardModal,
    openEditCardModal,
    closeCardModal,
    handleStartDelete,
    handleCancelDelete,
    setDeleting,
    openPaymentModal,
    closePaymentModal,
    openRefundModal,
    closeRefundModal,
    openPaymentEditModal,
    closePaymentEditModal,
    openExpenseEditModal,
    closeExpenseEditModal,
    setEditingRefundPaymentItem,
    setEditingRefundIncomeId,
    setEditingRefundIncomeInitialData,
    openCycleModal,
    closeCycleModal,
    setReconciliationCardId,

    // Refund
    setIsRefundIncomeEditModalOpen,
    closeRefundIncomeEditModal,

    // Debt actions
    openCreateDebtModal,
    openEditDebtModal,
    closeDebtModal,
    setDeleteModalState,
    setDeleteConfirmState,
    setIsIncomeConfirmModalOpen,
    setSelectedDebtForIncome,
    setIsIntegratedModalOpen,
    setSelectedDebtForIntegrated,
    setLinkedExpense,
    setIntegratedReportValueInput,
    setIsPayableConfirmModalOpen,
    setSelectedDebtForPayableExpense,
    setIsPayableExpenseModalOpen,

    // Complex actions
    handleConfirmWithIncome,
    handleConfirmWithoutIncome,
    handleConfirmIntegrated,
    handleConfirmPayableWithoutExpenseDirect,
    handleToggleDebtStatus,
    setIsAddSelectorOpen,
  }
}
