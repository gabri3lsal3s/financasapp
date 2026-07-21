import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { usePageActions } from '@/hooks/usePageActions'
import Card from '@/components/Card'
import KpiCard from '@/components/KpiCard'
import Button from '@/components/Button'
import EmptyState from '@/components/EmptyState'
import IconButton from '@/components/IconButton'
import Modal from '@/components/Modal'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import CreditCardCsvReconciliationPanel from '@/components/CreditCardCsvReconciliationPanel'
import ExpenseFormModal from '@/components/ExpenseFormModal'
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
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { supabase } from '@/lib/supabase'
import type { Debt, Expense } from '@/types'
import { useSearchHighlight } from '@/utils/pageTitles'
import { formatCurrency, formatDate, getCurrentMonthString, roundToDecimals, formatMonth } from '@/utils/format'
import BillExpenseRowButton from '@/components/creditCards/BillExpenseRowButton'
import RowButton from '@/components/RowButton'
import type { BillExpenseItem, BillPaymentDisplayItem } from '@/utils/creditCardBilling'
import { hasExplicitCreditCardsDeepLink } from '@/utils/creditCardMonthSelection'
import { Calendar, FileUp, Pencil, Plus, Wallet, Undo2, Scale, CheckCircle2, CreditCard as CreditCardIcon, ChevronDown, ChevronUp, Check, Trash2, TrendingUp, TrendingDown, Link2 } from 'lucide-react'

import { useSearchParams } from 'react-router-dom'
import { buildRefundNote, parseRefundNote } from '@/pages/creditCards/refundNote'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import ModalIntro from '@/components/ModalIntro'
import QuickLaunchOption from '@/components/dashboard/QuickLaunchOption'
import { CARD_BASE, CARD_PADDING } from '@/constants/layout'

// Componentes refatorados de Cartão e Dívidas
import CreditCardTimeline from '@/components/creditCards/CreditCardTimeline'
import InfoTooltip from '@/components/InfoTooltip'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'
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

type PaymentItem = BillPaymentDisplayItem

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'


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
  const [hasResolvedInitialMonth, setHasResolvedInitialMonth] = useState(false)
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

  const activeCards = useMemo(
    () => creditCards.filter((card) => card.is_active !== false),
    [creditCards],
  )

  const [debtFilter, setDebtFilter] = useState<'all' | 'payable' | 'receivable'>('all')

  // Pendências ativas (não pagas)
  const pendingDebts = useMemo(() => {
    return debts.filter((d) => d.status === 'pending')
  }, [debts])

  const payablePendingCount = useMemo(
    () => debts.filter((d) => d.status === 'pending' && d.type === 'payable').length,
    [debts],
  )
  const receivablePendingCount = useMemo(
    () => debts.filter((d) => d.status === 'pending' && d.type === 'receivable').length,
    [debts],
  )

  const filteredPendingDebts = useMemo(() => {
    return debts.filter((d) => {
      if (d.status !== 'pending') return false
      if (debtFilter === 'payable') return d.type === 'payable'
      if (debtFilter === 'receivable') return d.type === 'receivable'
      return true
    })
  }, [debts, debtFilter])

  // Pendências confirmadas (pagas) no mês selecionado
  const confirmedDebts = useMemo(() => {
    return debts.filter((d) => d.status === 'paid' && d.due_date.startsWith(currentMonth))
  }, [debts, currentMonth])

  const stats = useMemo(() => {
    const totalFaturasAberto = activeCards.reduce((sum, card) => {
      const previsto = Number(baseExpensesByCard[card.id] || 0)
      const pago = Number(paymentsByCard[card.id] || 0)
      const aberto = Math.max(0, previsto - pago)
      return sum + aberto
    }, 0)

    const totalPagar = debts
      .filter((d) => d.status === 'pending' && d.type === 'payable' && d.due_date.startsWith(currentMonth))
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)

    const totalReceber = debts
      .filter((d) => d.status === 'pending' && d.type === 'receivable' && d.due_date.startsWith(currentMonth))
      .reduce((sum, d) => sum + Number(d.amount || 0), 0)

    const saldoLiquido = totalReceber - totalPagar - totalFaturasAberto

    return {
      totalFaturasAberto: roundToDecimals(totalFaturasAberto, 2),
      totalPagar: roundToDecimals(totalPagar, 2),
      totalReceber: roundToDecimals(totalReceber, 2),
      saldoLiquido: roundToDecimals(saldoLiquido, 2),
    }
  }, [activeCards, baseExpensesByCard, paymentsByCard, debts, currentMonth])

  const loading = loadingCards || loadingDebts

  const cycleCard = useMemo(() => {
    return creditCards.find(c => c.id === modals.selectedCardIdForCycle) || null
  }, [creditCards, modals.selectedCardIdForCycle])

  const handleConfirmDelete = async (migrationCardId: string | null) => {
    if (!modals.editingCard) return

    try {
      modals.setDeleting(true)

      if (migrationCardId) {
        const { error: migrationError } = await supabase
          .from('expenses')
          .update({ credit_card_id: migrationCardId })
          .eq('credit_card_id', modals.editingCard.id)

        if (migrationError) throw migrationError
      } else {
        const { error: unbindError } = await supabase
          .from('expenses')
          .update({ credit_card_id: null, payment_method: 'other' })
          .eq('credit_card_id', modals.editingCard.id)

        if (unbindError) throw unbindError
      }

      await Promise.all([
        supabase.from('credit_card_bill_payments').delete().eq('credit_card_id', modals.editingCard.id),
        supabase.from('credit_card_monthly_cycles').delete().eq('credit_card_id', modals.editingCard.id),
      ])

      const { error: deleteError } = await deleteCreditCard(modals.editingCard.id)
      if (deleteError) throw new Error(deleteError)

      modals.handleCancelDelete()
      modals.closeCardModal()
      await refreshCreditCards()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao excluir cartão: ${err instanceof Error ? err.message : 'Ocorreu um erro inesperado'}`)
    } finally {
      modals.setDeleting(false)
    }
  }

  const getOrCreateRefundIncomeCategoryId = async () => {
    const existing = incomeCategories.find((category) => {
      const normalizedName = String(category.name || '').trim().toLowerCase()
      return normalizedName === REFUND_INCOME_CATEGORY_NAME.toLowerCase()
        || normalizedName === LEGACY_REFUND_INCOME_CATEGORY_NAME.toLowerCase()
    })

    if (existing?.id) {
      if (String(existing.name || '').trim().toLowerCase() === LEGACY_REFUND_INCOME_CATEGORY_NAME.toLowerCase()) {
        await supabase
          .from('income_categories')
          .update({ name: REFUND_INCOME_CATEGORY_NAME })
          .eq('id', existing.id)
      }
      return existing.id
    }

    const { data, error } = await supabase
      .from('income_categories')
      .insert([{
        name: REFUND_INCOME_CATEGORY_NAME,
        color: 'var(--credit-card-refund-category-color)',
      }])
      .select('id')
      .single()

    if (error || !data?.id) {
      throw new Error(error?.message || 'Não foi possível criar a categoria de renda Estorno.')
    }

    return String(data.id)
  }

  const handleOpenPaymentItem = async (paymentItem: PaymentItem) => {
    const parsedRefund = parseRefundNote(paymentItem.note)
    if (parsedRefund.isRefund && parsedRefund.incomeId) {
      const { data, error } = await supabase
        .from('incomes')
        .select('*')
        .eq('id', parsedRefund.incomeId)
        .maybeSingle()

      if (error) {
        alert('Não foi possível obter dados detalhados deste estorno.')
        return
      }
      if (!data) {
        alert('Este estorno não possui mais uma renda correspondente ativa no sistema.')
        return
      }
      modals.setEditingRefundPaymentItem(paymentItem)
      modals.setEditingRefundIncomeId(parsedRefund.incomeId)
      modals.setEditingRefundIncomeInitialData({
        amount: data.amount,
        report_amount: data.report_weight !== undefined && data.report_weight !== null
          ? roundToDecimals(data.amount * data.report_weight, 2)
          : 0,
        date: data.date,
        income_category_id: data.income_category_id,
        description: data.description || '',
      })
      modals.setIsRefundIncomeEditModalOpen(true)
    } else {
      modals.openPaymentEditModal(paymentItem)
    }
  }

  const handleSubmitEditRefundIncome = async (payload: {
    amount: number
    reportAmount: number
    date: string
    incomeCategoryId: string
    description: string
  }) => {
    if (!modals.editingRefundPaymentItem || !modals.editingRefundIncomeId) return

    const { amount, reportAmount, date, incomeCategoryId, description } = payload
    const reportWeight = amount > 0 ? roundToDecimals(reportAmount / amount, 4) : 1

    try {
      const { error: incomeUpdateError } = await supabase
        .from('incomes')
        .update({
          amount,
          report_weight: reportWeight,
          date,
          income_category_id: incomeCategoryId,
          description: description || null,
        })
        .eq('id', modals.editingRefundIncomeId)

      if (incomeUpdateError) throw incomeUpdateError

      const refundNoteText = buildRefundNote(modals.editingRefundIncomeId, description || '')
      const { error: paymentUpdateError } = await supabase
        .from('credit_card_bill_payments')
        .update({
          amount: -amount,
          payment_date: date,
          note: refundNoteText,
        })
        .eq('id', modals.editingRefundPaymentItem.id)

      if (paymentUpdateError) throw paymentUpdateError

      modals.closeRefundIncomeEditModal()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao atualizar estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }

  const handleDeleteRefundIncome = async () => {
    const refundPaymentItem = modals.editingRefundPaymentItem
    const refundIncomeId = modals.editingRefundIncomeId
    if (!refundPaymentItem || !refundIncomeId) return
    modals.setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir estorno',
      message: 'Deseja realmente excluir este estorno?',
      checkboxLabel: 'Estou ciente de que este estorno será excluído permanentemente.',
      onConfirm: async () => {
        try {
          const { error: incomeDeleteError } = await supabase
            .from('incomes')
            .delete()
            .eq('id', refundIncomeId)

          if (incomeDeleteError) throw incomeDeleteError

          const { error: paymentDeleteError } = await supabase
            .from('credit_card_bill_payments')
            .delete()
            .eq('id', refundPaymentItem.id)

          if (paymentDeleteError) throw paymentDeleteError

          modals.closeRefundIncomeEditModal()
          await loadBillData(true)
        } catch (err) {
          alert(`Erro ao excluir estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
        }
      },
    })
  }

  const handleSubmitRefund = async (amount: number, date: string, description: string) => {
    if (!modals.refundCardId) return

    try {
      const estornoCategoryId = await getOrCreateRefundIncomeCategoryId()
      const { data: incomeData, error: incomeError } = await supabase
        .from('incomes')
        .insert([{
          amount,
          report_weight: 1.0,
          date,
          type: 'other',
          income_category_id: estornoCategoryId,
          description: description || 'Estorno fatura',
        }])
        .select('id')
        .single()

      if (incomeError) throw incomeError
      if (!incomeData?.id) throw new Error('Não foi possível obter o ID gerado para a receita de estorno.')

      const refundNoteText = buildRefundNote(String(incomeData.id), description || 'Estorno fatura')

      const { error: paymentError } = await supabase
        .from('credit_card_bill_payments')
        .insert([{
          credit_card_id: modals.refundCardId,
          bill_competence: currentMonth,
          amount: -amount,
          payment_date: date,
          note: refundNoteText,
        }])

      if (paymentError) {
        await supabase.from('incomes').delete().eq('id', incomeData.id)
        throw paymentError
      }

      modals.closeRefundModal()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao registrar estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }

  useEffect(() => {
    if (hasResolvedInitialMonth) return
    if (loadingCards) return

    // Tenta navegar para o mês vindo da busca (?month=YYYY-MM)
    const targetMonth = searchParams.get('month')
    if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
      setCurrentMonth(targetMonth)
    } else if (hasExplicitCreditCardsDeepLink(searchParams, getCurrentMonthString())) {
      const cardMonth = searchParams.get('month')
      if (cardMonth && /^\d{4}-\d{2}$/.test(cardMonth)) {
        setCurrentMonth(cardMonth)
      }
    } else {
      setCurrentMonth(getCurrentMonthString())
    }
    setHasResolvedInitialMonth(true)
  }, [hasResolvedInitialMonth, loadingCards, searchParams])

  useEffect(() => {
    if (!hasResolvedInitialMonth) return
    const hasData = Object.keys(expensesByCard).length > 0
    void loadBillData(hasData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResolvedInitialMonth, currentMonth, creditCards])

  // Expande debts no mobile quando navega por resultado da busca
  useEffect(() => {
    const shouldExpand = searchParams.get('expand') === '1'
    const highlightId = searchParams.get('highlight')
    if (shouldExpand && highlightId && isMobile) {
      setExpandedItems((prev) => ({ ...prev, [highlightId]: true }))
    }
  }, [searchParams, isMobile])

  useEffect(() => {
    const targetCardId = searchParams.get('card')
    if (!targetCardId || loadingCards || loadingBills) return
    const targetElement = document.getElementById(`credit-card-${targetCardId}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Expande o card no mobile
      if (isMobile) {
        setExpandedItems((prev) => ({ ...prev, [targetCardId]: true }))
      }
    }
  }, [searchParams, loadingCards, loadingBills, currentMonth, isMobile])

  const handleSubmitCard = async (payload: {
    name: string
    brand: string | null
    limit_total: number | null
    closing_day: number
    due_day: number
    color: string | null
    is_active: boolean
  }) => {
    if (modals.editingCard) {
      const { error } = await updateCreditCard(modals.editingCard.id, payload)
      if (error) {
        alert(`Erro ao atualizar cartão: ${error}`)
        return
      }
    } else {
      const { error } = await createCreditCard(payload)
      if (error) {
        alert(`Erro ao criar cartão: ${error}`)
        return
      }
    }

    modals.closeCardModal()
    await refreshCreditCards()
    await loadBillData(true)
  }

  const handleSubmitPayment = async (amount: number, date: string, note: string) => {
    if (!modals.paymentCardId) {
      alert('Selecione um cartão válido.')
      return
    }

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .insert([{
        credit_card_id: modals.paymentCardId,
        bill_competence: currentMonth,
        amount: amount,
        payment_date: date,
        ...(note.trim() ? { note: note.trim() } : {}),
      }])

    if (error) {
      alert(`Erro ao registrar pagamento: ${error.message}`)
      return
    }

    modals.closePaymentModal()
    await loadBillData(true)
  }

  const handleSubmitEditPayment = async (amount: number, date: string, note: string) => {
    if (!modals.editingPaymentItem) return

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .update({
        amount: amount,
        payment_date: date,
        note: note.trim() || null,
      })
      .eq('id', modals.editingPaymentItem.id)

    if (error) {
      alert(`Erro ao atualizar pagamento: ${error.message}`)
      return
    }

    modals.closePaymentEditModal()
    await loadBillData(true)
  }

  const handleDeletePayment = async () => {
    const paymentItem = modals.editingPaymentItem
    if (!paymentItem) return
    modals.setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir pagamento',
      message: 'Deseja excluir este pagamento?',
      checkboxLabel: 'Estou ciente de que este pagamento será excluído permanentemente.',
      onConfirm: async () => {
        const { error } = await supabase
          .from('credit_card_bill_payments')
          .delete()
          .eq('id', paymentItem.id)

        if (error) {
          alert(`Erro ao excluir pagamento: ${error.message}`)
          return
        }

        modals.closePaymentEditModal()
        await loadBillData(true)
      },
    })
  }

  const handleSubmitCycle = async (closingDay: number, dueDay: number) => {
    if (!modals.selectedCardIdForCycle) return

    const existingCycle = monthlyCyclesByCard[modals.selectedCardIdForCycle]

    if (existingCycle) {
      const { error } = await supabase
        .from('credit_card_monthly_cycles')
        .update({ closing_day: closingDay, due_day: dueDay })
        .eq('id', existingCycle.id)

      if (error) {
        alert(`Erro ao salvar ajuste de ciclo: ${error.message}`)
        return
      }
    } else {
      const { error } = await supabase
        .from('credit_card_monthly_cycles')
        .insert([{
          credit_card_id: modals.selectedCardIdForCycle,
          competence: currentMonth,
          closing_day: closingDay,
          due_day: dueDay,
        }])

      if (error) {
        alert(`Erro ao criar ajuste de ciclo: ${error.message}`)
        return
      }
    }

    modals.closeCycleModal()
    await loadBillData(true)
  }

  const handleResetCycleToCardDefault = async () => {
    if (!modals.selectedCardIdForCycle) return
    const existingCycle = monthlyCyclesByCard[modals.selectedCardIdForCycle]
    if (!existingCycle) {
      modals.closeCycleModal()
      return
    }

    const { error } = await supabase
      .from('credit_card_monthly_cycles')
      .delete()
      .eq('id', existingCycle.id)

    if (error) {
      alert(`Erro ao remover ajuste de ciclo: ${error.message}`)
      return
    }

    modals.closeCycleModal()
    await loadBillData(true)
  }

  const handleSubmitEditExpense = async (payload: {
    amount: number
    reportAmount: number
    date: string
    paymentMethod: string
    creditCardId: string
    categoryId: string
    description: string
  }) => {
    if (!modals.editingExpenseItem) return

    const isRefund = Number(modals.editingExpenseItem.base_amount ?? modals.editingExpenseItem.amount ?? 0) < 0
    const signedAmount = isRefund ? -Math.abs(payload.amount) : payload.amount
    const reportWeight = payload.amount > 0 ? roundToDecimals(payload.reportAmount / payload.amount, 4) : 1

    const { error } = await updateExpense(modals.editingExpenseItem.id, {
      amount: signedAmount,
      report_weight: reportWeight,
      date: payload.date,
      payment_method: payload.paymentMethod as BillExpenseItem['payment_method'],
      credit_card_id: payload.paymentMethod === 'credit_card' ? payload.creditCardId : null,
      category_id: payload.categoryId,
      description: payload.description || undefined,
    })

    if (error) {
      alert(`Erro ao editar despesa: ${error}`)
      return
    }

    modals.closeExpenseEditModal()
    await loadBillData(true)
  }

  const handleDeleteExpense = async () => {
    const expenseItem = modals.editingExpenseItem
    if (!expenseItem?.id) return

    if (Number(expenseItem.installment_total || 1) > 1) {
      modals.setDeleteModalState({
        isOpen: true,
        type: 'expense',
        id: expenseItem.id,
        installmentNumber: expenseItem.installment_number || 1,
        installmentTotal: expenseItem.installment_total || 1,
      })
      modals.closeExpenseEditModal()
    } else {
      modals.setDeleteConfirmState({
        isOpen: true,
        title: 'Excluir despesa',
        message: 'Deseja excluir esta despesa?',
        checkboxLabel: 'Estou ciente de que esta despesa será excluída permanentemente.',
        onConfirm: async () => {
          const { error } = await deleteExpense(expenseItem.id)
          if (error) {
            alert(`Erro ao excluir despesa: ${error}`)
            return
          }

          modals.closeExpenseEditModal()
          await loadBillData(true)
        },
      })
    }
  }

  const handleSubmitDebt = async (payload: {
    name: string
    type: 'payable' | 'receivable'
    amount: number
    due_date: string
    description: string
    status: 'pending' | 'paid'
  }) => {
    if (modals.editingDebt) {
      const { error } = await updateDebt(modals.editingDebt.id, payload)
      if (error) {
        alert(`Erro ao atualizar: ${error}`)
        return
      }
    } else {
      const { error } = await createDebt(payload)
      if (error) {
        alert(`Erro ao criar: ${error}`)
        return
      }
    }

    modals.closeDebtModal()
  }

  const handleDeleteDebt = async (debtId: string) => {
    const debt = debts.find((d) => d.id === debtId)
    if (debt && debt.expense?.installment_group_id && Number(debt.expense?.installment_total || 1) > 1) {
      modals.setDeleteModalState({
        isOpen: true,
        type: 'debt',
        id: debtId,
        installmentNumber: debt.expense.installment_number || 1,
        installmentTotal: debt.expense.installment_total || 1,
      })
    } else {
      modals.setDeleteConfirmState({
        isOpen: true,
        title: 'Excluir pendência',
        message: 'Deseja excluir este registro de pendência?',
        checkboxLabel: 'Estou ciente de que esta pendência será excluída permanentemente.',
        onConfirm: async () => {
          const { error } = await deleteDebt(debtId)
          if (error) {
            alert(`Erro ao excluir: ${error}`)
            return
          }
        },
      })
    }
  }

  const resolveIncomeCategoryId = async () => {
    let cat = incomeCategories.find(c => (c.name || '').toLowerCase() === 'outros')
    if (cat) return cat.id
    
    cat = incomeCategories.find(c => (c.name || '').toLowerCase() === 'sem categoria')
    if (cat) return cat.id

    if (incomeCategories.length > 0) return incomeCategories[0].id

    const { data } = await supabase
      .from('income_categories')
      .select('id')
      .eq('name', 'Sem categoria')
      .maybeSingle()

    if (data?.id) return data.id

    const { data: inserted, error: insertError } = await supabase
      .from('income_categories')
      .insert([{ name: 'Sem categoria', color: 'var(--category-fallback-muted)' }])
      .select('id')
      .single()

    if (insertError || !inserted?.id) {
      throw new Error('Não foi possível obter ou criar categoria para a renda.')
    }
    return inserted.id
  }

  const handleConfirmWithIncome = async () => {
    if (!modals.selectedDebtForIncome) return
    try {
      const categoryId = await resolveIncomeCategoryId()
      const { error: incomeError } = await createIncome({
        amount: modals.selectedDebtForIncome.amount,
        description: modals.selectedDebtForIncome.name,
        date: modals.selectedDebtForIncome.due_date || format(new Date(), 'yyyy-MM-dd'),
        income_category_id: categoryId,
        report_weight: 1.0,
        type: 'other',
      })
      if (incomeError) {
        alert(`Erro ao criar receita: ${incomeError}`)
      }
    } catch (err) {
      alert(`Erro ao criar receita: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }

    const { error } = await updateDebt(modals.selectedDebtForIncome.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    modals.setIsIncomeConfirmModalOpen(false)
    modals.setSelectedDebtForIncome(null)
  }

  const handleConfirmWithoutIncome = async () => {
    if (!modals.selectedDebtForIncome) return
    const { error } = await updateDebt(modals.selectedDebtForIncome.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    modals.setIsIncomeConfirmModalOpen(false)
    modals.setSelectedDebtForIncome(null)
  }

  const handleConfirmIntegrated = async () => {
    if (!modals.selectedDebtForIntegrated || !modals.linkedExpense) return

    const finalValue = modals.integratedReportValueInput
    if (Number.isNaN(finalValue) || finalValue < 0 || finalValue > modals.linkedExpense.amount) {
      alert(`Valor inválido. Deve ser entre 0 e ${formatCurrency(modals.linkedExpense.amount)}.`)
      return
    }

    try {
      const reportWeight = modals.linkedExpense.amount > 0 ? roundToDecimals(finalValue / modals.linkedExpense.amount, 4) : 1
      const { error: updateExpenseError } = await updateExpense(modals.linkedExpense.id, {
        report_weight: reportWeight,
      })

      if (updateExpenseError) {
        alert(`Erro ao atualizar despesa vinculada: ${updateExpenseError}`)
        return
      }

      const { error } = await updateDebt(modals.selectedDebtForIntegrated.id, {
        status: 'paid',
      })
      if (error) {
        alert(`Erro ao atualizar status do recebimento: ${error}`)
      }
    } catch (err) {
      alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }

    modals.setIsIntegratedModalOpen(false)
    modals.setSelectedDebtForIntegrated(null)
    modals.setLinkedExpense(null)
  }

  const handleCreateExpenseForPayable = async (expenseData: Omit<Expense, 'id' | 'created_at' | 'category'>) => {
    if (!modals.selectedDebtForPayableExpense) return { data: null, error: 'Dívida não selecionada' }

    const { data: createdExpense, error } = await createExpense(expenseData)

    if (error) {
      return { data: null, error }
    }

    if (createdExpense) {
      const { error: updateDebtError } = await updateDebt(modals.selectedDebtForPayableExpense.id, {
        status: 'paid',
        expense_id: createdExpense.id,
      })

      if (updateDebtError) {
        alert(`Erro ao vincular despesa à dívida: ${updateDebtError}`)
      }
    }

    modals.setIsPayableExpenseModalOpen(false)
    modals.setSelectedDebtForPayableExpense(null)

    return { data: createdExpense, error: null }
  }

  const handleConfirmPayableWithoutExpenseDirect = async () => {
    if (modals.selectedDebtForPayableExpense) {
      const { error } = await updateDebt(modals.selectedDebtForPayableExpense.id, { status: 'paid' })
      if (error) {
        alert(`Erro ao marcar dívida como paga: ${error}`)
      }
    }
    modals.setIsPayableConfirmModalOpen(false)
    modals.setSelectedDebtForPayableExpense(null)
  }

  const handleToggleDebtStatus = async (debt: Debt) => {
    const nextStatus = debt.status === 'pending' ? 'paid' : 'pending'

    if (nextStatus === 'paid') {
      if (debt.type === 'receivable') {
        if (debt.expense_id) {
          try {
            const { data: expense, error: fetchExpenseError } = await supabase
              .from('expenses')
              .select('*')
              .eq('id', debt.expense_id)
              .maybeSingle()

            if (fetchExpenseError) throw fetchExpenseError

            if (expense) {
              const currentReportValue = roundToDecimals(expense.amount * (expense.report_weight ?? 1), 2)
              const finalValue = Math.max(0, roundToDecimals(currentReportValue - debt.amount, 2))

              modals.setLinkedExpense(expense)
              modals.setSelectedDebtForIntegrated(debt)
              modals.setIntegratedReportValueInput(finalValue)
              modals.setIsIntegratedModalOpen(true)
              return
            }
          } catch (err) {
            alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
            return
          }
        } else {
          modals.setSelectedDebtForIncome(debt)
          modals.setIsIncomeConfirmModalOpen(true)
          return
        }
      } else if (debt.type === 'payable') {
        modals.setSelectedDebtForPayableExpense(debt)
        modals.setIsPayableConfirmModalOpen(true)
        return
      }
    }

    const { error } = await updateDebt(debt.id, { status: nextStatus })
    if (error) {
      alert(`Erro ao atualizar status: ${error}`)
    }
  }



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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 text-left items-stretch">
              <KpiCard
                title="Faturas em Aberto"
                value={formatCurrency(stats.totalFaturasAberto)}
                icon={<CreditCardIcon size={16} />}
                glowColor="var(--color-primary)"
                showGlow={true}
                index={1}
              />
              <KpiCard
                title="Contas a Pagar"
                value={formatCurrency(stats.totalPagar)}
                icon={<TrendingDown size={16} />}
                glowColor="var(--color-expense)"
                showGlow={true}
                index={2}
              />
              <KpiCard
                title="Contas a Receber"
                value={formatCurrency(stats.totalReceber)}
                icon={<TrendingUp size={16} />}
                glowColor="var(--color-income)"
                showGlow={true}
                index={3}
              />
              <KpiCard
                title="Saldo Pendente"
                value={
                  <span className={stats.saldoLiquido >= 0 ? 'text-income' : 'text-expense'}>
                    {formatCurrency(stats.saldoLiquido)}
                  </span>
                }
                icon={<Scale size={16} />}
                glowColor={stats.saldoLiquido >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
                showGlow={true}
                valueTooltip={formatCurrency(stats.saldoLiquido)}
                index={4}
              />
            </div>

            <div className="space-y-6">
              {/* SEÇÃO 1: CARTÕES DE CRÉDITO */}
              <section className={cn("space-y-3", CARD_BASE, CARD_PADDING)}>
                <div className="flex items-center justify-between border-b border-glass pb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CreditCardIcon size={16} className="shrink-0 text-primary/60 sm:text-primary/70" />
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate flex items-center gap-1.5">
                        Cartões de Crédito
                        <span className="text-xs font-medium text-secondary font-sans">
                          ({activeCards.length})
                        </span>
                      </h2>
                      <p className="text-[10px] sm:text-xs text-secondary mt-0.5 truncate">Faturas e ciclo de competência ativa</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={modals.openCreateCardModal}
                    className="h-8 px-3 text-xs font-semibold flex items-center gap-1.5 bg-secondary/20 hover:bg-secondary/40 border border-glass shrink-0"
                  >
                    <Plus size={14} />
                    Novo Cartão
                  </Button>
                </div>

                {activeCards.length === 0 ? (
                  <EmptyState
                    icon={<CreditCardIcon size={28} />}
                    title="Nenhum cartão cadastrado"
                    description="Cadastre seu primeiro cartão de crédito para começar a gerenciar suas faturas."
                    action={{
                      label: 'Cadastrar primeiro cartão',
                      onClick: modals.openCreateCardModal,
                      variant: 'primary',
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    {activeCards.map((card) => {
                      const totalPrevisto = Number(expensesByCard[card.id] || 0)
                      const totalPago = Number(paymentsByCard[card.id] || 0)
                      const saldoAberto = roundToDecimals(totalPrevisto - totalPago, 2)
                      const billItems = billItemsByCard[card.id] || []
                      const monthlyCycle = monthlyCyclesByCard[card.id]
                      const effectiveClosingDay = monthlyCycle?.closing_day || card.closing_day
                      const effectiveDueDay = monthlyCycle?.due_day || card.due_day
                      const isExpanded = !!expandedItems[card.id]

                      return (
                        <Card key={card.id} id={`credit-card-${card.id}`} className="p-0 overflow-hidden border border-glass transition-all duration-300">
                          {/* Header Accordion */}
                          <div 
                            className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                            onClick={() => toggleExpand(card.id)}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span
                                className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full shadow-sm shrink-0"
                                style={{ backgroundColor: card.color || 'var(--color-primary)' }}
                              />
                              <div className="text-left min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-primary truncate">{card.name}</p>
                                <p className="text-[10px] sm:text-[11px] text-secondary mt-0.5 truncate">
                                  {card.brand || 'Crédito'} • Fechamento: dia {effectiveClosingDay} • Vencimento: dia {effectiveDueDay}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                              <div className="text-right">
                                <p className="text-[10px] sm:text-xs text-secondary leading-tight flex items-center justify-end gap-1">
                                  Fatura Atual
                                  {baseExpensesByCard[card.id] !== undefined && baseExpensesByCard[card.id] !== totalPrevisto && (
                                    <InfoTooltip
                                      content={WEIGHT_TOOLTIPS.billActualValue}
                                      iconSize={10}
                                    />
                                  )}
                                </p>
                                <p className="text-xs sm:text-sm font-bold text-primary font-mono mt-0.5">
                                  {formatCurrency(baseExpensesByCard[card.id] ?? totalPrevisto)}
                                </p>
                                {baseExpensesByCard[card.id] !== undefined && baseExpensesByCard[card.id] !== totalPrevisto && (
                                  <p className="text-[9px] text-secondary/50 font-sans mt-0.5">
                                    Relatório: {formatCurrency(totalPrevisto)}
                                  </p>
                                )}
                              </div>
                              {isExpanded ? (
                                <ChevronUp size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                              ) : (
                                <ChevronDown size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                              )}
                            </div>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="p-4 border-t border-glass bg-secondary/5 space-y-5 animate-surface-enter text-left w-full">
                              
                              {/* Linha do tempo (Timeline) */}
                              <CreditCardTimeline
                                card={card}
                                currentMonth={currentMonth}
                                totalPrevisto={totalPrevisto}
                                totalPago={totalPago}
                                saldoAberto={saldoAberto}
                                monthlyCycle={monthlyCycle}
                                baseExpense={baseExpensesByCard[card.id]}
                              />

                              {/* Ações do Cartão */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-secondary/20 p-2.5 sm:p-3 rounded-xl border border-glass">
                                <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">Ações do Cartão</span>
                                <div className="flex flex-wrap gap-1.5">
                                  <IconButton
                                    size="sm"
                                    icon={<Pencil size={14} />}
                                    onClick={() => modals.openEditCardModal(card)}
                                    label="Editar Cartão"
                                    title="Editar configurações do cartão"
                                  />
                                  <IconButton
                                    size="sm"
                                    icon={<Calendar size={14} />}
                                    onClick={() => modals.openCycleModal(card)}
                                    label="Ajustar Ciclo"
                                    title="Ajustar fechamento/vencimento do mês"
                                  />
                                  <IconButton
                                    size="sm"
                                    icon={<Undo2 size={14} />}
                                    onClick={() => modals.openRefundModal(card.id)}
                                    label="Estorno"
                                    title="Registrar estorno"
                                  />
                                  <IconButton
                                    size="sm"
                                    icon={<Wallet size={14} />}
                                    onClick={() => modals.openPaymentModal(card.id)}
                                    label="Pagar Fatura"
                                    title="Registrar pagamento"
                                  />
                                  <IconButton
                                    size="sm"
                                    icon={<FileUp size={14} />}
                                    onClick={() => modals.setReconciliationCardId(card.id)}
                                    label="CSV"
                                    title="Anexar CSV"
                                  />
                                </div>
                              </div>

                              {/* Grid de 2 subcolunas internas quando expandido: Lançamentos + Pagamentos */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Lançamentos da Fatura */}
                                <div className="space-y-2.5 bg-secondary/10 p-3 rounded-xl border border-glass">
                                  <div className="flex items-center justify-between border-b border-glass pb-1.5">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-primary">
                                      Lançamentos ({currentMonth})
                                    </h4>
                                    <span className="text-[10px] bg-secondary border border-primary/20 px-2 py-0.5 rounded-full font-semibold text-secondary">
                                      {billItems.length} {billItems.length === 1 ? 'item' : 'itens'}
                                    </span>
                                  </div>
                                  {billItems.length === 0 ? (
                                    <p className="text-xs text-secondary italic py-2">Sem lançamentos nesta competência.</p>
                                  ) : (
                                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                                      {billItems.map((item) => (
                                        <BillExpenseRowButton
                                          key={item.id}
                                          item={item}
                                          onOpen={modals.openExpenseEditModal}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Pagamentos e Ajustes */}
                                <div className="space-y-2.5 bg-secondary/10 p-3 rounded-xl border border-glass">
                                  <div className="flex items-center justify-between border-b border-glass pb-1.5">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-primary">
                                      Pagamentos ({currentMonth})
                                    </h4>
                                    <span className="text-[10px] bg-secondary border border-primary/20 px-2 py-0.5 rounded-full font-semibold text-secondary">
                                      {(paymentItemsByCard[card.id] || []).length} {(paymentItemsByCard[card.id] || []).length === 1 ? 'registro' : 'registros'}
                                    </span>
                                  </div>
                                  {(paymentItemsByCard[card.id] || []).length === 0 ? (
                                    <p className="text-xs text-secondary italic py-2">Sem pagamentos registrados nesta competência.</p>
                                  ) : (
                                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                                      {(paymentItemsByCard[card.id] || []).map((payment) => {
                                        const refundMeta = parseRefundNote(payment.note)
                                        return (
                                          <RowButton
                                            key={payment.id}
                                            onClick={() => handleOpenPaymentItem(payment)}
                                          >
                                            <div className="flex items-start justify-between gap-3 w-full text-left">
                                              <div className="min-w-0">
                                                <p className="text-xs font-semibold text-primary truncate">
                                                  {refundMeta.isRefund
                                                    ? (refundMeta.description || 'Estorno de compra')
                                                    : (payment.note || 'Pagamento de fatura')}
                                                </p>
                                                <p className="text-[10px] text-secondary mt-0.5 font-mono">
                                                  {formatDate(payment.payment_date)}
                                                  {refundMeta.isRefund ? ' • Estorno' : ''}
                                                </p>
                                              </div>
                                              <p className="text-xs font-bold text-income font-mono">{formatCurrency(payment.amount)}</p>
                                            </div>
                                          </RowButton>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* SEÇÃO 2: PENDÊNCIAS (A PAGAR E A RECEBER) */}
              <section className={cn("space-y-3", CARD_BASE, CARD_PADDING)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-glass pb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Scale size={16} className="shrink-0 text-primary/60 sm:text-primary/70" />
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate flex items-center gap-1.5">
                        Pendências
                        <span className="text-xs font-medium text-secondary font-sans">
                          ({pendingDebts.length})
                        </span>
                      </h2>
                      <p className="text-[10px] sm:text-xs text-secondary mt-0.5 truncate">Dívidas a pagar e créditos a receber</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                    {/* Filtros rápidos em Chips/Pills */}
                    <div className="flex items-center gap-1 p-1 bg-secondary/30 rounded-xl border border-glass text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setDebtFilter('all')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          debtFilter === 'all'
                            ? 'bg-primary text-secondary-contrast shadow-sm font-bold'
                            : 'text-secondary hover:text-primary'
                        }`}
                      >
                        Todas ({pendingDebts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDebtFilter('payable')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          debtFilter === 'payable'
                            ? 'bg-expense text-white shadow-sm font-bold'
                            : 'text-secondary hover:text-expense'
                        }`}
                      >
                        Pagar ({payablePendingCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDebtFilter('receivable')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          debtFilter === 'receivable'
                            ? 'bg-income text-white shadow-sm font-bold'
                            : 'text-secondary hover:text-income'
                        }`}
                      >
                        Receber ({receivablePendingCount})
                      </button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={modals.openCreateDebtModal}
                      className="h-8 px-3 text-xs font-semibold flex items-center gap-1.5 bg-secondary/20 hover:bg-secondary/40 border border-glass shrink-0"
                    >
                      <Plus size={14} />
                      Nova Pendência
                    </Button>
                  </div>
                </div>

                {filteredPendingDebts.length === 0 ? (
                  <EmptyState
                    icon={<Scale size={28} />}
                    title={debtFilter === 'all' ? 'Nenhuma pendência ativa' : debtFilter === 'payable' ? 'Nenhuma conta a pagar' : 'Nenhum valor a receber'}
                    description={
                      debtFilter === 'all'
                        ? 'Você não possui dívidas ou contas a receber pendentes para este período.'
                        : debtFilter === 'payable'
                        ? 'Você não possui contas a pagar pendentes.'
                        : 'Você não possui valores a receber pendentes.'
                    }
                    action={{
                      label: 'Nova Pendência',
                      onClick: modals.openCreateDebtModal,
                      variant: 'primary',
                    }}
                  />
                ) : (
                  <div className="space-y-2.5">
                    {filteredPendingDebts.map((debt) => {
                      const isExpanded = !!expandedItems[debt.id]
                      const isPayable = debt.type === 'payable'
                      const isPaid = debt.status === 'paid'

                      return (
                        <Card key={debt.id} id={`item-${debt.id}`} className="p-0 overflow-hidden border border-glass transition-all duration-300 relative">
                          {/* Color bar indicator for type */}
                          <div 
                            className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                              isPayable ? 'bg-expense' : 'bg-income'
                            }`}
                          />

                          {/* Accordion Header */}
                          <div 
                            className="p-3 sm:p-4 pl-4 sm:pl-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                            onClick={() => toggleExpand(debt.id)}
                          >
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs sm:text-sm font-bold text-primary truncate max-w-[180px] sm:max-w-none">{debt.name}</p>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                                  isPayable 
                                    ? 'bg-expense/10 border-expense/20 text-expense' 
                                    : 'bg-income/10 border-income/20 text-income'
                                }`}>
                                  {isPayable ? 'A Pagar' : 'A Receber'}
                                </span>
                                {debt.expense_id && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-balance/10 border border-balance/20 text-balance px-2 py-0.5 rounded-md shrink-0 cursor-help" 
                                    title="Esta pendência está integrada a uma despesa e as alterações serão sincronizadas."
                                  >
                                    <Link2 size={10} className="stroke-[3]" />
                                    Integrada
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-secondary font-mono mt-1 flex flex-wrap items-center gap-2">
                                <span>Vencimento: {formatDate(debt.due_date)}</span>
                                <span className="text-[9px] bg-secondary/80 text-secondary px-1.5 py-0.5 rounded font-sans font-bold">
                                  Ref: {formatMonth(debt.due_date.substring(0, 7))}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                              <div className="text-right">
                                <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border block text-center ${
                                  isPaid 
                                    ? 'bg-income/10 border-income/20 text-income' 
                                    : 'bg-warning/10 border-warning/20 text-warning-light'
                                }`}>
                                  {isPaid ? 'Pago' : 'Pendente'}
                                </span>
                                <p className="text-xs sm:text-sm font-bold text-primary font-mono mt-1">{formatCurrency(debt.amount)}</p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                              ) : (
                                <ChevronDown size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                              )}
                            </div>
                          </div>

                          {/* Accordion Body */}
                          {isExpanded && (
                            <div className="p-4 pl-5 border-t border-glass bg-secondary/5 space-y-4 animate-surface-enter text-left">
                              {debt.description && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Descrição</p>
                                  <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">{debt.description}</p>
                                </div>
                              )}

                              {debt.expense && (
                                <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 sm:p-4 space-y-3 relative overflow-hidden select-text">
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/30" />
                                  
                                  <div className="flex items-center gap-1.5">
                                    <Link2 size={12} className="text-primary stroke-[2.5]" />
                                    <span className="text-[10px] uppercase font-black tracking-wider text-primary">Despesa Integrada Relacionada</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs">
                                    <div>
                                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider block mb-0.5">Descrição original:</span>
                                      <span className="text-primary font-semibold block sm:truncate">{debt.expense.description || 'Sem descrição'}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider block mb-0.5">Valor da Despesa:</span>
                                      <span className="text-primary font-extrabold font-mono text-sm">{formatCurrency(debt.expense.amount)}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider block mb-0.5">Data de Lançamento:</span>
                                      <span className="text-primary font-mono">{formatDate(debt.expense.date)}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider block mb-0.5">Meio de Pagamento / Categoria:</span>
                                      <span className="text-primary block sm:truncate" title={
                                        debt.expense.payment_method === 'credit_card'
                                          ? `Cartão de Crédito (${debt.expense.credit_card?.name || 'Crédito'})${debt.expense.category?.name ? ` • ${debt.expense.category.name}` : ''}`
                                          : `${debt.expense.payment_method || 'Outro'}${debt.expense.category?.name ? ` • ${debt.expense.category.name}` : ''}`
                                      }>
                                        {debt.expense.payment_method === 'credit_card'
                                          ? `Cartão de Crédito (${debt.expense.credit_card?.name || 'Crédito'})`
                                          : debt.expense.payment_method === 'pix' ? 'Pix'
                                          : debt.expense.payment_method === 'cash' ? 'Dinheiro'
                                          : debt.expense.payment_method === 'debit' ? 'Débito'
                                          : debt.expense.payment_method === 'transfer' ? 'Transferência'
                                          : debt.expense.payment_method || 'Outro'}
                                        {debt.expense.category?.name ? ` • ${debt.expense.category.name}` : ''}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-glass/50">
                                <div className="w-full sm:w-auto">
                                  <Button 
                                    size="sm" 
                                    variant={isPaid ? 'outline' : isPayable ? 'expense' : 'income'}
                                    onClick={() => handleToggleDebtStatus(debt)}
                                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 font-bold"
                                  >
                                    <Check size={14} />
                                    {isPaid ? 'Marcar como Pendente' : isPayable ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
                                  </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:items-center sm:w-auto">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => modals.openEditDebtModal(debt)}
                                    className="w-full sm:w-auto flex items-center justify-center gap-1.5"
                                  >
                                    <Pencil size={13} />
                                    Editar
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => handleDeleteDebt(debt.id)}
                                    className="text-expense border-expense/20 hover:bg-expense/10 w-full sm:w-auto flex items-center justify-center gap-1.5"
                                  >
                                    <Trash2 size={13} />
                                    Excluir
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}

                {confirmedDebts.length > 0 && (
                  <div className="space-y-2.5 pt-3.5 border-t border-glass mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-income" />
                        Confirmadas no Mês ({confirmedDebts.length})
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {confirmedDebts.map((debt) => (
                        <div 
                          key={debt.id}
                          id={`item-${debt.id}`}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-income/5 border border-income/10 text-xs hover:bg-income/10 hover:border-income/20 transition-all select-none cursor-pointer"
                          title="Clique para reabrir esta pendência"
                          onClick={() => handleToggleDebtStatus(debt)}
                        >
                          <CheckCircle2 size={13} className="text-income shrink-0 group-hover:scale-110 transition-transform stroke-[2.5]" />
                          <span className="font-semibold text-primary truncate max-w-[140px]">{debt.name}</span>
                          <span className="text-income font-bold font-mono text-[10px]">{formatCurrency(debt.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </MonthTransitionView>
        )}
      </div>

      {/* MODAL: CARTÃO DE CRÉDITO */}
      <CardFormModal
        isOpen={modals.isCardModalOpen}
        onClose={modals.closeCardModal}
        onSubmit={handleSubmitCard}
        editingCard={modals.editingCard}
        loading={loadingCards}
        onStartDelete={modals.handleStartDelete}
      />

      {/* CONFIRM MODAL: DELETAR CARTÃO */}
      <DeleteCardConfirmModal
        isOpen={modals.isDeleteConfirmModalOpen}
        onClose={modals.handleCancelDelete}
        onConfirm={handleConfirmDelete}
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
        onSubmit={handleSubmitCycle}
        onReset={handleResetCycleToCardDefault}
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
        onSubmit={handleSubmitEditExpense}
        onDelete={handleDeleteExpense}
        expenseItem={modals.editingExpenseItem}
        categories={categories}
        creditCards={creditCards}
        loading={loading}
      />

      {/* MODAL: EDITAR PAGAMENTO INDIVIDUAL */}
      <BillPaymentModal
        isOpen={modals.isPaymentEditModalOpen}
        onClose={modals.closePaymentEditModal}
        onSubmit={handleSubmitEditPayment}
        onDelete={handleDeletePayment}
        currentMonth={currentMonth}
        editingPayment={modals.editingPaymentItem}
        loading={loading}
      />

      {/* MODAL: EDITAR ESTORNO (RENDA) */}
      <RefundIncomeEditModal
        isOpen={modals.isRefundIncomeEditModalOpen}
        onClose={modals.closeRefundIncomeEditModal}
        onSubmit={handleSubmitEditRefundIncome}
        onDelete={handleDeleteRefundIncome}
        initialData={modals.editingRefundIncomeInitialData}
        incomeCategories={incomeCategories}
        loading={loading}
      />

      {/* MODAL: ESTORNO NOVO */}
      <RefundModal
        isOpen={modals.isRefundModalOpen}
        onClose={modals.closeRefundModal}
        onSubmit={handleSubmitRefund}
        currentMonth={currentMonth}
        loading={loading}
      />

      {/* MODAL: REGISTRAR PAGAMENTO FATURA */}
      <BillPaymentModal
        isOpen={modals.isPaymentModalOpen}
        onClose={modals.closePaymentModal}
        onSubmit={handleSubmitPayment}
        currentMonth={currentMonth}
        editingPayment={null}
        loading={loading}
      />

      {/* MODAL: NOVO/EDITAR LANÇAMENTO DE PENDÊNCIA */}
      <DebtFormModal
        isOpen={modals.isDebtModalOpen}
        onClose={modals.closeDebtModal}
        onSubmit={handleSubmitDebt}
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
        onConfirmWithIncome={handleConfirmWithIncome}
        onConfirmWithoutIncome={handleConfirmWithoutIncome}
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
        onConfirm={handleConfirmIntegrated}
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
        onConfirmWithoutExpense={handleConfirmPayableWithoutExpenseDirect}
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
        onCreate={handleCreateExpenseForPayable}
        onUpdate={async () => ({ data: null, error: 'Não implementado nesta ação' })}
        onDelete={async () => ({ error: 'Não implementado nesta ação' })}
        defaultValues={modals.selectedDebtForPayableExpense ? {
          amount: modals.selectedDebtForPayableExpense.amount,
          description: modals.selectedDebtForPayableExpense.name,
          date: modals.selectedDebtForPayableExpense.due_date || format(new Date(), 'yyyy-MM-dd'),
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
    </div>
  )
}

