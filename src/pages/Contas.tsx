import { useEffect, useMemo, useState } from 'react'
import { endOfMonth, format, subMonths } from 'date-fns'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import KpiCard from '@/components/KpiCard'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Modal from '@/components/Modal'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import CreditCardCsvReconciliationPanel from '@/components/CreditCardCsvReconciliationPanel'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import Loader from '@/components/Loader'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useDebts } from '@/hooks/useDebts'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { supabase } from '@/lib/supabase'
import type { CreditCard, Debt, Expense } from '@/types'
import { formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput, roundToDecimals, formatMonth } from '@/utils/format'
import BillExpenseRowButton from '@/components/creditCards/BillExpenseRowButton'
import PaymentRowButton from '@/components/creditCards/PaymentRowButton'
import {
  buildClosingDayResolver,
  filterBillExpensesForMonth,
  filterBillPaymentsForMonth,
  groupPaymentsByCard,
  prepareBillExpenseRows,
  summarizeCreditCardBill,
  type BillExpenseItem,
  type BillExpenseRowInput,
  type BillPaymentDisplayItem,
  type BillPaymentRowInput,
} from '@/utils/creditCardBilling'
import { hasExplicitCreditCardsDeepLink, shiftMonth } from '@/utils/creditCardMonthSelection'
import { Calendar, FileUp, Pencil, Plus, Wallet, Undo2, Scale, CheckCircle2, CreditCard as CreditCardIcon, ChevronDown, ChevronUp, Check, Trash2, TrendingUp, TrendingDown, Link2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { buildRefundNote, parseRefundNote } from '@/pages/creditCards/refundNote'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import GlassChoiceCard from '@/components/GlassChoiceCard'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import ModalIntro from '@/components/ModalIntro'

// Componentes refatorados de Cartão e Dívidas
import CreditCardTimeline, { MonthlyCycleRow } from '@/components/creditCards/CreditCardTimeline'
import CardFormModal from '@/components/creditCards/CardFormModal'
import BillPaymentModal from '@/components/creditCards/BillPaymentModal'
import RefundModal from '@/components/creditCards/RefundModal'
import CycleConfigModal from '@/components/creditCards/CycleConfigModal'
import DeleteCardConfirmModal from '@/components/creditCards/DeleteCardConfirmModal'
import ExpenseEditModal from '@/components/creditCards/ExpenseEditModal'
import RefundIncomeEditModal from '@/components/creditCards/RefundIncomeEditModal'
import DebtFormModal from '@/components/debts/DebtFormModal'
import {
  IncomeConfirmModal,
  IntegratedDebtModal,
  PayableConfirmModal,
} from '@/components/debts/DebtActionConfirmModals'

type PaymentItem = BillPaymentDisplayItem

type BillDataSnapshot = {
  expensesByCard: Record<string, number>
  paymentsByCard: Record<string, number>
  baseExpensesByCard: Record<string, number>
  billItemsByCard: Record<string, BillExpenseItem[]>
  paymentItemsByCard: Record<string, PaymentItem[]>
  monthlyCyclesByCard: Record<string, MonthlyCycleRow>
}

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'


export default function Contas() {
  const [searchParams] = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const swipeHandlers = useSwipeMonth(currentMonth, setCurrentMonth)
  const [hasResolvedInitialMonth, setHasResolvedInitialMonth] = useState(false)
  const [loadingBills, setLoadingBills] = useState(true)
  const [paymentCardId, setPaymentCardId] = useState<string>('')
  
  // Modais de Cartão
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const [isPaymentEditModalOpen, setIsPaymentEditModalOpen] = useState(false)
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [selectedCardIdForCycle, setSelectedCardIdForCycle] = useState<string>('')
  const [editingPaymentItem, setEditingPaymentItem] = useState<PaymentItem | null>(null)
  const [refundCardId, setRefundCardId] = useState<string>('')
  const [isExpenseEditModalOpen, setIsExpenseEditModalOpen] = useState(false)
  const [editingExpenseItem, setEditingExpenseItem] = useState<BillExpenseItem | null>(null)
  const [isRefundIncomeEditModalOpen, setIsRefundIncomeEditModalOpen] = useState(false)
  const [editingRefundPaymentItem, setEditingRefundPaymentItem] = useState<PaymentItem | null>(null)
  const [editingRefundIncomeId, setEditingRefundIncomeId] = useState<string>('')
  const [editingRefundIncomeInitialData, setEditingRefundIncomeInitialData] = useState<{
    amount: string
    report_amount: string
    date: string
    income_category_id: string
    description: string
  } | null>(null)
  const [reconciliationCardId, setReconciliationCardId] = useState<string>('')
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Modais e Estados de Dívidas
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)

  // Modais customizados para confirmação de recebimentos
  const [isIncomeConfirmModalOpen, setIsIncomeConfirmModalOpen] = useState(false)
  const [selectedDebtForIncome, setSelectedDebtForIncome] = useState<Debt | null>(null)

  const [isIntegratedModalOpen, setIsIntegratedModalOpen] = useState(false)
  const [selectedDebtForIntegrated, setSelectedDebtForIntegrated] = useState<Debt | null>(null)
  const [linkedExpense, setLinkedExpense] = useState<Expense | null>(null)
  const [integratedReportValueInput, setIntegratedReportValueInput] = useState('')

  // Modal e estados para criação de despesa vinculada ao pagar uma dívida (payable)
  const [isPayableConfirmModalOpen, setIsPayableConfirmModalOpen] = useState(false)
  const [isPayableExpenseModalOpen, setIsPayableExpenseModalOpen] = useState(false)
  const [selectedDebtForPayableExpense, setSelectedDebtForPayableExpense] = useState<Debt | null>(null)

  // Selector modal
  const [isAddSelectorOpen, setIsAddSelectorOpen] = useState(false)

  // Accordion local state keys (creditCardIds, debtIds)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const [expensesByCard, setExpensesByCard] = useState<Record<string, number>>({})
  const [paymentsByCard, setPaymentsByCard] = useState<Record<string, number>>({})
  const [baseExpensesByCard, setBaseExpensesByCard] = useState<Record<string, number>>({})
  const [billItemsByCard, setBillItemsByCard] = useState<Record<string, BillExpenseItem[]>>({})
  const [paymentItemsByCard, setPaymentItemsByCard] = useState<Record<string, PaymentItem[]>>({})
  const [monthlyCyclesByCard, setMonthlyCyclesByCard] = useState<Record<string, MonthlyCycleRow>>({})

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
  const { creditCardsWeightsEnabled, setCreditCardsWeightsEnabled } = useAppSettings()

  const activeCards = useMemo(
    () => creditCards.filter((card) => card.is_active !== false),
    [creditCards],
  )

  // Pendências ativas (não pagas)
  const pendingDebts = useMemo(() => {
    return debts.filter((d) => d.status === 'pending')
  }, [debts])

  // Pendências confirmadas (pagas) no mês selecionado
  const confirmedDebts = useMemo(() => {
    return debts.filter((d) => d.status === 'paid' && d.due_date.startsWith(currentMonth))
  }, [debts, currentMonth])

  const stats = useMemo(() => {
    const totalFaturasAberto = activeCards.reduce((sum, card) => {
      const previsto = Number(expensesByCard[card.id] || 0)
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
  }, [activeCards, expensesByCard, paymentsByCard, debts, currentMonth])

  const loading = loadingCards || loadingDebts

  const cycleCard = useMemo(() => {
    return creditCards.find(c => c.id === selectedCardIdForCycle) || null
  }, [creditCards, selectedCardIdForCycle])

  const openCreateCardModal = () => {
    setEditingCard(null)
    setIsCardModalOpen(true)
  }

  const openEditCardModal = (card: CreditCard) => {
    setEditingCard(card)
    setIsCardModalOpen(true)
  }

  const closeCardModal = () => {
    setIsCardModalOpen(false)
    setEditingCard(null)
  }

  // Modais de Dívidas
  const openCreateDebtModal = () => {
    setEditingDebt(null)
    setIsDebtModalOpen(true)
  }

  const openEditDebtModal = (debt: Debt) => {
    setEditingDebt(debt)
    setIsDebtModalOpen(true)
  }

  const closeDebtModal = () => {
    setIsDebtModalOpen(false)
    setEditingDebt(null)
  }

  const handleStartDelete = () => {
    setIsDeleteConfirmModalOpen(true)
  }

  const handleCancelDelete = () => {
    setIsDeleteConfirmModalOpen(false)
  }

  const handleConfirmDelete = async (migrationCardId: string | null) => {
    if (!editingCard) return

    try {
      setIsDeleting(true)

      if (migrationCardId) {
        const { error: migrationError } = await supabase
          .from('expenses')
          .update({ credit_card_id: migrationCardId })
          .eq('credit_card_id', editingCard.id)

        if (migrationError) throw migrationError
      } else {
        const { error: unbindError } = await supabase
          .from('expenses')
          .update({ credit_card_id: null, payment_method: 'other' })
          .eq('credit_card_id', editingCard.id)

        if (unbindError) throw unbindError
      }

      await Promise.all([
        supabase.from('credit_card_bill_payments').delete().eq('credit_card_id', editingCard.id),
        supabase.from('credit_card_monthly_cycles').delete().eq('credit_card_id', editingCard.id),
      ])

      const { error: deleteError } = await deleteCreditCard(editingCard.id)
      if (deleteError) throw new Error(deleteError)

      handleCancelDelete()
      closeCardModal()
      await refreshCreditCards()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao excluir cartão: ${err instanceof Error ? err.message : 'Ocorreu um erro inesperado'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const openPaymentModal = (cardId: string) => {
    setPaymentCardId(cardId)
    setIsPaymentModalOpen(true)
  }

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false)
    setPaymentCardId('')
  }

  const openRefundModal = (cardId: string) => {
    setRefundCardId(cardId)
    setIsRefundModalOpen(true)
  }

  const closeRefundModal = () => {
    setIsRefundModalOpen(false)
    setRefundCardId('')
  }

  const openPaymentEditModal = (item: PaymentItem) => {
    setEditingPaymentItem(item)
    setIsPaymentEditModalOpen(true)
  }

  const closePaymentEditModal = () => {
    setIsPaymentEditModalOpen(false)
    setEditingPaymentItem(null)
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

  const openExpenseEditModal = (item: BillExpenseItem) => {
    setEditingExpenseItem(item)
    setIsExpenseEditModalOpen(true)
  }

  const closeExpenseEditModal = () => {
    setIsExpenseEditModalOpen(false)
    setEditingExpenseItem(null)
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
      setEditingRefundPaymentItem(paymentItem)
      setEditingRefundIncomeId(parsedRefund.incomeId)
      setEditingRefundIncomeInitialData({
        amount: formatMoneyInput(data.amount),
        report_amount: data.report_weight !== undefined && data.report_weight !== null
          ? formatMoneyInput(roundToDecimals(data.amount * data.report_weight, 2))
          : '',
        date: data.date,
        income_category_id: data.income_category_id,
        description: data.description || '',
      })
      setIsRefundIncomeEditModalOpen(true)
    } else {
      openPaymentEditModal(paymentItem)
    }
  }

  const closeRefundIncomeEditModal = () => {
    setIsRefundIncomeEditModalOpen(false)
    setEditingRefundPaymentItem(null)
    setEditingRefundIncomeId('')
    setEditingRefundIncomeInitialData(null)
  }

  const handleSubmitEditRefundIncome = async (payload: {
    amount: number
    reportAmount: number
    date: string
    incomeCategoryId: string
    description: string
  }) => {
    if (!editingRefundPaymentItem || !editingRefundIncomeId) return

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
        .eq('id', editingRefundIncomeId)

      if (incomeUpdateError) throw incomeUpdateError

      const refundNoteText = buildRefundNote(editingRefundIncomeId, description || '')
      const { error: paymentUpdateError } = await supabase
        .from('credit_card_bill_payments')
        .update({
          amount: -amount,
          payment_date: date,
          note: refundNoteText,
        })
        .eq('id', editingRefundPaymentItem.id)

      if (paymentUpdateError) throw paymentUpdateError

      closeRefundIncomeEditModal()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao atualizar estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }

  const handleDeleteRefundIncome = async () => {
    if (!editingRefundPaymentItem || !editingRefundIncomeId) return
    const confirmed = window.confirm('Deseja realmente excluir este estorno?')
    if (!confirmed) return

    try {
      const { error: incomeDeleteError } = await supabase
        .from('incomes')
        .delete()
        .eq('id', editingRefundIncomeId)

      if (incomeDeleteError) throw incomeDeleteError

      const { error: paymentDeleteError } = await supabase
        .from('credit_card_bill_payments')
        .delete()
        .eq('id', editingRefundPaymentItem.id)

      if (paymentDeleteError) throw paymentDeleteError

      closeRefundIncomeEditModal()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao excluir estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }

  const handleSubmitRefund = async (amount: number, date: string, description: string) => {
    if (!refundCardId) return

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
          credit_card_id: refundCardId,
          bill_competence: currentMonth,
          amount: -amount,
          payment_date: date,
          note: refundNoteText,
        }])

      if (paymentError) {
        await supabase.from('incomes').delete().eq('id', incomeData.id)
        throw paymentError
      }

      closeRefundModal()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao registrar estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }

  const openCycleModal = (card: CreditCard) => {
    setSelectedCardIdForCycle(card.id)
    setIsCycleModalOpen(true)
  }

  const closeCycleModal = () => {
    setIsCycleModalOpen(false)
    setSelectedCardIdForCycle('')
  }

  const getBillDataSnapshot = async (targetMonth: string): Promise<BillDataSnapshot> => {
    const competenceReferenceDate = new Date(`${targetMonth}-01T12:00:00`)
    const searchStartDate = format(subMonths(competenceReferenceDate, 2), 'yyyy-MM-01')
    const nextMonthReference = new Date(`${shiftMonth(targetMonth, 1)}-01T12:00:00`)
    const searchEndDate = format(endOfMonth(nextMonthReference), 'yyyy-MM-dd')

    const previousMonth = shiftMonth(targetMonth, -1)
    const cycleMonths = [
      shiftMonth(targetMonth, -2),
      previousMonth,
      targetMonth,
      shiftMonth(targetMonth, 1),
    ]

    const { data: monthlyCycleRows } = await supabase
      .from('credit_card_monthly_cycles')
      .select('id, credit_card_id, competence, closing_day, due_day')
      .in('competence', cycleMonths)

    const cycleClosingByCardAndMonth = (monthlyCycleRows || []).reduce<Record<string, number>>((accumulator, row) => {
      const cardId = String(row.credit_card_id || '')
      const competence = String(row.competence || '')
      if (!cardId || !competence) return accumulator
      accumulator[`${cardId}:${competence}`] = Number(row.closing_day)
      return accumulator
    }, {})

    const currentMonthCycles = (monthlyCycleRows || []).reduce<Record<string, MonthlyCycleRow>>((accumulator, row) => {
      if (String(row.competence || '') !== targetMonth) return accumulator
      const cardId = String(row.credit_card_id || '')
      if (!cardId) return accumulator
      accumulator[cardId] = {
        id: String(row.id),
        credit_card_id: cardId,
        competence: String(row.competence),
        closing_day: Number(row.closing_day),
        due_day: Number(row.due_day),
      }
      return accumulator
    }, {})

    const cardClosingDays = creditCards.reduce<Record<string, number>>((accumulator, card) => {
      if (card.id && Number.isFinite(card.closing_day)) {
        accumulator[card.id] = Number(card.closing_day)
      }
      return accumulator
    }, {})

    const { data: rawExpenseRows } = await supabase
      .from('expenses')
      .select('id, credit_card_id, amount, report_weight, payment_method, date, bill_competence, category_id, description, installment_number, installment_total, category:categories(name)')
      .not('credit_card_id', 'is', null)
      .or(`bill_competence.eq.${targetMonth},and(date.gte.${searchStartDate},date.lte.${searchEndDate})`)

    const resolveClosingDay = buildClosingDayResolver(cycleClosingByCardAndMonth, cardClosingDays)
    const filteredExpenses = filterBillExpensesForMonth(
      (rawExpenseRows || []) as BillExpenseRowInput[],
      targetMonth,
      resolveClosingDay,
    )
    const expenseRows = prepareBillExpenseRows(filteredExpenses, creditCardsWeightsEnabled)

    const { data: paymentRows } = await supabase
      .from('credit_card_bill_payments')
      .select('id, credit_card_id, amount, payment_date, bill_competence, note')
      .not('credit_card_id', 'is', null)
      .or(`bill_competence.eq.${targetMonth},and(amount.lt.0,payment_date.gte.${searchStartDate},payment_date.lte.${searchEndDate})`)

    const paymentList = filterBillPaymentsForMonth(
      (paymentRows || []) as BillPaymentRowInput[],
      targetMonth,
      searchStartDate,
      searchEndDate,
      resolveClosingDay,
    )
    const paymentsByCardItems = groupPaymentsByCard(paymentList)

    Object.keys(paymentsByCardItems).forEach((cardId) => {
      paymentsByCardItems[cardId] = paymentsByCardItems[cardId]
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    })

    const summarizedBill = summarizeCreditCardBill(
      expenseRows,
      (paymentRows || []).map((row) => ({
        credit_card_id: String(row.credit_card_id || ''),
        amount: Number(row.amount || 0),
      })),
    )

    const totalRefundByCard: Record<string, number> = {}
    Object.entries(paymentsByCardItems).forEach(([cardId, items]) => {
      let refundTotal = 0
      items.forEach(item => {
        const { isRefund } = parseRefundNote(item.note)
        if (isRefund || item.amount < 0) {
          refundTotal += Math.abs(item.amount)
        }
      })
      totalRefundByCard[cardId] = roundToDecimals(refundTotal, 2)
    })

    const finalExpensesByCard: Record<string, number> = {}
    const finalPaymentsByCard: Record<string, number> = {}
    const finalBaseExpensesByCard: Record<string, number> = {}

    Object.keys(summarizedBill.expensesByCard).forEach(cardId => {
      const refundAmt = totalRefundByCard[cardId] || 0
      finalExpensesByCard[cardId] = roundToDecimals(summarizedBill.expensesByCard[cardId] - refundAmt, 2)
      finalPaymentsByCard[cardId] = roundToDecimals(summarizedBill.paymentsByCard[cardId] - refundAmt, 2)
      const cardExpenses = summarizedBill.billItemsByCard[cardId] || []
      const baseTotal = cardExpenses.reduce((sum, item) => sum + (item.base_amount || 0), 0)
      finalBaseExpensesByCard[cardId] = roundToDecimals(baseTotal - refundAmt, 2)
    })

    return {
      expensesByCard: finalExpensesByCard,
      paymentsByCard: finalPaymentsByCard,
      baseExpensesByCard: finalBaseExpensesByCard,
      billItemsByCard: summarizedBill.billItemsByCard,
      paymentItemsByCard: paymentsByCardItems,
      monthlyCyclesByCard: currentMonthCycles,
    }
  }

  const fetchReconciliationCandidates = async (cardId: string, baseMonth: string): Promise<BillExpenseItem[]> => {
    const prevMonth = shiftMonth(baseMonth, -1)
    const nextMonth = shiftMonth(baseMonth, 1)

    const [prevSnapshot, currSnapshot, nextSnapshot] = await Promise.all([
      getBillDataSnapshot(prevMonth),
      getBillDataSnapshot(baseMonth),
      getBillDataSnapshot(nextMonth),
    ])

    const allBillItems = [
      ...(prevSnapshot.billItemsByCard[cardId] || []),
      ...(currSnapshot.billItemsByCard[cardId] || []),
      ...(nextSnapshot.billItemsByCard[cardId] || []),
    ]

    const refundItems = [
      ...(prevSnapshot.paymentItemsByCard[cardId] || []),
      ...(currSnapshot.paymentItemsByCard[cardId] || []),
      ...(nextSnapshot.paymentItemsByCard[cardId] || []),
    ]
      .map((payment) => {
        const note = String(payment.note || '')
        if (!note.startsWith('[REFUND]')) return null
        let refundDesc = 'Estorno registrado'
        try {
          const parsed = JSON.parse(note.slice('[REFUND]'.length))
          if (parsed.description) refundDesc = parsed.description
        } catch {
          // ignore
        }
        const amt = -Math.abs(Number(payment.amount || 0))
        return {
          id: `refund-payment-${payment.id}`,
          credit_card_id: cardId,
          amount: amt,
          base_amount: amt,
          date: String(payment.payment_date || ''),
          description: refundDesc,
          category_name: 'Estorno',
          category_id: '__refund_registered__',
          installment_number: null,
          installment_total: null,
          bill_competence: String(payment.bill_competence || ''),
        } as BillExpenseItem
      })
      .filter((item): item is BillExpenseItem => Boolean(item))

    return [...allBillItems, ...refundItems]
  }

  const loadBillData = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingBills(true)
      }
      const snapshot = await getBillDataSnapshot(currentMonth)
      setExpensesByCard(snapshot.expensesByCard)
      setPaymentsByCard(snapshot.paymentsByCard)
      setBaseExpensesByCard(snapshot.baseExpensesByCard)
      setBillItemsByCard(snapshot.billItemsByCard)
      setPaymentItemsByCard(snapshot.paymentItemsByCard)
      setMonthlyCyclesByCard(snapshot.monthlyCyclesByCard)
    } finally {
      if (!silent) {
        setLoadingBills(false)
      }
    }
  }

  useEffect(() => {
    if (hasResolvedInitialMonth) return
    if (loadingCards) return

    if (hasExplicitCreditCardsDeepLink(searchParams, getCurrentMonthString())) {
      const targetMonth = searchParams.get('month')
      if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
        setCurrentMonth(targetMonth)
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
  }, [hasResolvedInitialMonth, currentMonth, creditCards, creditCardsWeightsEnabled])

  useEffect(() => {
    const targetCardId = searchParams.get('card')
    if (!targetCardId || loadingCards || loadingBills) return
    const targetElement = document.getElementById(`credit-card-${targetCardId}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searchParams, loadingCards, loadingBills, currentMonth])

  const handleSubmitCard = async (payload: {
    name: string
    brand: string | null
    limit_total: number | null
    closing_day: number
    due_day: number
    color: string | null
    is_active: boolean
  }) => {
    if (editingCard) {
      const { error } = await updateCreditCard(editingCard.id, payload)
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

    closeCardModal()
    await refreshCreditCards()
    await loadBillData(true)
  }

  const handleSubmitPayment = async (amount: number, date: string, note: string) => {
    if (!paymentCardId) {
      alert('Selecione um cartão válido.')
      return
    }

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .insert([{
        credit_card_id: paymentCardId,
        bill_competence: currentMonth,
        amount: amount,
        payment_date: date,
        ...(note.trim() ? { note: note.trim() } : {}),
      }])

    if (error) {
      alert(`Erro ao registrar pagamento: ${error.message}`)
      return
    }

    closePaymentModal()
    await loadBillData(true)
  }

  const handleSubmitEditPayment = async (amount: number, date: string, note: string) => {
    if (!editingPaymentItem) return

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .update({
        amount: amount,
        payment_date: date,
        note: note.trim() || null,
      })
      .eq('id', editingPaymentItem.id)

    if (error) {
      alert(`Erro ao atualizar pagamento: ${error.message}`)
      return
    }

    closePaymentEditModal()
    await loadBillData(true)
  }

  const handleDeletePayment = async () => {
    if (!editingPaymentItem) return
    const confirmed = window.confirm('Deseja excluir este pagamento?')
    if (!confirmed) return

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .delete()
      .eq('id', editingPaymentItem.id)

    if (error) {
      alert(`Erro ao excluir pagamento: ${error.message}`)
      return
    }

    closePaymentEditModal()
    await loadBillData(true)
  }

  const handleSubmitCycle = async (closingDay: number, dueDay: number) => {
    if (!selectedCardIdForCycle) return

    const existingCycle = monthlyCyclesByCard[selectedCardIdForCycle]

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
          credit_card_id: selectedCardIdForCycle,
          competence: currentMonth,
          closing_day: closingDay,
          due_day: dueDay,
        }])

      if (error) {
        alert(`Erro ao criar ajuste de ciclo: ${error.message}`)
        return
      }
    }

    closeCycleModal()
    await loadBillData(true)
  }

  const handleResetCycleToCardDefault = async () => {
    if (!selectedCardIdForCycle) return
    const existingCycle = monthlyCyclesByCard[selectedCardIdForCycle]
    if (!existingCycle) {
      closeCycleModal()
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

    closeCycleModal()
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
    if (!editingExpenseItem) return

    const isRefund = Number(editingExpenseItem.base_amount ?? editingExpenseItem.amount ?? 0) < 0
    const signedAmount = isRefund ? -Math.abs(payload.amount) : payload.amount
    const reportWeight = payload.amount > 0 ? roundToDecimals(payload.reportAmount / payload.amount, 4) : 1

    const { error } = await updateExpense(editingExpenseItem.id, {
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

    closeExpenseEditModal()
    await loadBillData(true)
  }

  const handleDeleteExpense = async () => {
    if (!editingExpenseItem?.id) return
    const confirmed = window.confirm('Deseja excluir esta despesa?')
    if (!confirmed) return

    const { error } = await deleteExpense(editingExpenseItem.id)
    if (error) {
      alert(`Erro ao excluir despesa: ${error}`)
      return
    }

    closeExpenseEditModal()
    await loadBillData(true)
  }

  const handleSubmitDebt = async (payload: {
    name: string
    type: 'payable' | 'receivable'
    amount: number
    due_date: string
    description: string
    status: 'pending' | 'paid'
  }) => {
    if (editingDebt) {
      const { error } = await updateDebt(editingDebt.id, payload)
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

    closeDebtModal()
  }

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm('Deseja excluir este registro de pendência?')) return
    const { error } = await deleteDebt(debtId)
    if (error) {
      alert(`Erro ao excluir: ${error}`)
      return
    }
  }

  const resolveIncomeCategoryId = async () => {
    // Try to find "Outros" first (case-insensitive)
    let cat = incomeCategories.find(c => (c.name || '').toLowerCase() === 'outros')
    if (cat) return cat.id
    
    // Try to find "Sem categoria"
    cat = incomeCategories.find(c => (c.name || '').toLowerCase() === 'sem categoria')
    if (cat) return cat.id

    // Take the first available category
    if (incomeCategories.length > 0) return incomeCategories[0].id

    // If none exists, get or create "Sem categoria" category in database
    const { data } = await supabase
      .from('income_categories')
      .select('id')
      .eq('name', 'Sem categoria')
      .maybeSingle()

    if (data?.id) return data.id

    // Otherwise, insert it
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
    if (!selectedDebtForIncome) return
    try {
      const categoryId = await resolveIncomeCategoryId()
      const { error: incomeError } = await createIncome({
        amount: selectedDebtForIncome.amount,
        description: selectedDebtForIncome.name,
        date: selectedDebtForIncome.due_date || format(new Date(), 'yyyy-MM-dd'),
        income_category_id: categoryId,
        report_weight: 1.0,
      })
      if (incomeError) {
        alert(`Erro ao criar receita: ${incomeError}`)
      }
    } catch (err) {
      alert(`Erro ao criar receita: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }

    const { error } = await updateDebt(selectedDebtForIncome.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    setIsIncomeConfirmModalOpen(false)
    setSelectedDebtForIncome(null)
  }

  const handleConfirmWithoutIncome = async () => {
    if (!selectedDebtForIncome) return
    const { error } = await updateDebt(selectedDebtForIncome.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    setIsIncomeConfirmModalOpen(false)
    setSelectedDebtForIncome(null)
  }

  const handleConfirmIntegrated = async () => {
    if (!selectedDebtForIntegrated || !linkedExpense) return

    const parsedVal = parseMoneyInput(integratedReportValueInput)
    if (Number.isNaN(parsedVal) || parsedVal < 0 || parsedVal > linkedExpense.amount) {
      alert(`Valor inválido. Deve ser entre 0 e ${formatCurrency(linkedExpense.amount)}.`)
      return
    }

    try {
      const reportWeight = linkedExpense.amount > 0 ? roundToDecimals(parsedVal / linkedExpense.amount, 4) : 1
      const { error: updateExpenseError } = await updateExpense(linkedExpense.id, {
        report_weight: reportWeight
      })

      if (updateExpenseError) {
        alert(`Erro ao atualizar despesa vinculada: ${updateExpenseError}`)
        return
      }

      // Mark debt as paid (keep the debt amount as original)
      const { error } = await updateDebt(selectedDebtForIntegrated.id, {
        status: 'paid'
      })
      if (error) {
        alert(`Erro ao atualizar status do recebimento: ${error}`)
      }
    } catch (err) {
      alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }

    setIsIntegratedModalOpen(false)
    setSelectedDebtForIntegrated(null)
    setLinkedExpense(null)
  }

  const handleCreateExpenseForPayable = async (expenseData: Omit<Expense, 'id' | 'created_at' | 'category'>) => {
    if (!selectedDebtForPayableExpense) return { data: null, error: 'Dívida não selecionada' }

    const { data: createdExpense, error } = await createExpense(expenseData)

    if (error) {
      return { data: null, error }
    }

    if (createdExpense) {
      const { error: updateDebtError } = await updateDebt(selectedDebtForPayableExpense.id, {
        status: 'paid',
        expense_id: createdExpense.id
      })

      if (updateDebtError) {
        alert(`Erro ao vincular despesa à dívida: ${updateDebtError}`)
      }
    }

    setIsPayableExpenseModalOpen(false)
    setSelectedDebtForPayableExpense(null)

    return { data: createdExpense, error: null }
  }

  const handleConfirmPayableWithoutExpenseDirect = async () => {
    if (selectedDebtForPayableExpense) {
      const { error } = await updateDebt(selectedDebtForPayableExpense.id, { status: 'paid' })
      if (error) {
        alert(`Erro ao marcar dívida como paga: ${error}`)
      }
    }
    setIsPayableConfirmModalOpen(false)
    setSelectedDebtForPayableExpense(null)
  }

  const handleToggleDebtStatus = async (debt: Debt) => {
    const nextStatus = debt.status === 'pending' ? 'paid' : 'pending'

    if (nextStatus === 'paid') {
      if (debt.type === 'receivable') {
        if (debt.expense_id) {
          // Integrated cobrança! DO NOT suggest income, just show integrated confirmation modal
          try {
            const { data: expense, error: fetchExpenseError } = await supabase
              .from('expenses')
              .select('*')
              .eq('id', debt.expense_id)
              .maybeSingle()

            if (fetchExpenseError) throw fetchExpenseError

            if (expense) {
              const currentReportValue = roundToDecimals(expense.amount * (expense.report_weight ?? 1), 2)
              // Automática diminuindo o valor no relatório da despesa pelo pagamento (debt.amount)
              const finalValue = Math.max(0, roundToDecimals(currentReportValue - debt.amount, 2))

              setLinkedExpense(expense)
              setSelectedDebtForIntegrated(debt)
              setIntegratedReportValueInput(formatMoneyInput(finalValue))
              setIsIntegratedModalOpen(true)
              return // Will be handled inside handleConfirmIntegrated
            }
          } catch (err) {
            alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
            return
          }
        } else {
          // Non-integrated receivable! Open custom income confirmation modal
          setSelectedDebtForIncome(debt)
          setIsIncomeConfirmModalOpen(true)
          return // Will be handled inside handleConfirmWithIncome or handleConfirmWithoutIncome
        }
      } else if (debt.type === 'payable') {
        // Confirming a payable debt! Open custom confirmation modal first
        setSelectedDebtForPayableExpense(debt)
        setIsPayableConfirmModalOpen(true)
        return // Will open the custom modal to choose between paying only or paying + registering expense
      }
    }

    const { error } = await updateDebt(debt.id, { status: nextStatus })
    if (error) {
      alert(`Erro ao atualizar status: ${error}`)
    }
  }



  return (
    <div className="animate-page-enter min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
      <PageHeader
        title="Contas"
        subtitle="Controle de cartões, faturas e pendências (a pagar e receber)"
        action={
          <PageHeaderActions>
            <PageHeaderActionButton
              intent="neutral"
              icon={Scale}
              label={creditCardsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
              compactOnMobile={false}
              onClick={() => setCreditCardsWeightsEnabled(!creditCardsWeightsEnabled)}
            />
            <PageHeaderActionButton
              intent="primary"
              icon={Plus}
              label="Adicionar"
              onClick={() => setIsAddSelectorOpen(true)}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6 space-y-6">
        {hasResolvedInitialMonth ? (
          <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
        ) : (
          <div className="mb-4 h-10" aria-hidden="true" />
        )}

        {loading || !hasResolvedInitialMonth || loadingBills ? (
          <Loader text="Carregando dados..." className="py-8" />
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

            <Tabs defaultValue="cards" className="w-full">
              <TabsList className="grid grid-cols-2 w-full max-w-md mb-6 mx-auto">
                <TabsTrigger value="cards" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-2 px-1 sm:px-2">
                  <CreditCardIcon size={14} />
                  Cartões ({activeCards.length})
                </TabsTrigger>
                <TabsTrigger value="debts" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-2 px-1 sm:px-2">
                  <Scale size={14} />
                  Pendências ({pendingDebts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cards" className="space-y-4 outline-none animate-surface-enter">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-glass pb-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <CreditCardIcon size={18} className="text-primary-light" />
                      Cartões de Crédito
                    </h2>
                    <span className="text-xs bg-tertiary border border-primary px-2 py-0.5 rounded-full font-semibold text-secondary">
                      {activeCards.length}
                    </span>
                  </div>

                  {activeCards.length === 0 ? (
                    <Card className="text-center py-8 space-y-3">
                      <p className="text-secondary text-sm">Nenhum cartão cadastrado.</p>
                      <div className="flex justify-center">
                        <Button size="sm" onClick={openCreateCardModal}>Cadastrar primeiro cartão</Button>
                      </div>
                    </Card>
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
                          <Card key={card.id} className="p-0 overflow-hidden border border-glass transition-all duration-300">
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
                                    {card.brand || 'Crédito'} • Fechamento: {effectiveClosingDay} • Vencimento: {effectiveDueDay}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                                <div className="text-right">
                                  <p className="text-[10px] sm:text-xs text-secondary leading-tight">Fatura Atual</p>
                                  <p className="text-xs sm:text-sm font-bold text-primary font-mono mt-0.5">{formatCurrency(totalPrevisto)}</p>
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
                              <div className="p-4 border-t border-glass bg-secondary/5 space-y-6 animate-surface-enter text-left w-full">
                                
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
                                      onClick={() => openEditCardModal(card)}
                                      label="Editar Cartão"
                                      title="Editar configurações do cartão"
                                    />
                                    <IconButton
                                      size="sm"
                                      icon={<Calendar size={14} />}
                                      onClick={() => openCycleModal(card)}
                                      label="Ajustar Ciclo"
                                      title="Ajustar fechamento/vencimento do mês"
                                    />
                                    <IconButton
                                      size="sm"
                                      icon={<Undo2 size={14} />}
                                      onClick={() => openRefundModal(card.id)}
                                      label="Estorno"
                                      title="Registrar estorno"
                                    />
                                    <IconButton
                                      size="sm"
                                      icon={<Wallet size={14} />}
                                      onClick={() => openPaymentModal(card.id)}
                                      label="Pagar Fatura"
                                      title="Registrar pagamento"
                                    />
                                    <IconButton
                                      size="sm"
                                      icon={<FileUp size={14} />}
                                      onClick={() => setReconciliationCardId(card.id)}
                                      label="CSV"
                                      title="Anexar CSV"
                                    />
                                  </div>
                                </div>

                                {/* Lançamentos da Fatura */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between border-b border-glass pb-1.5">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-primary">
                                      Lançamentos da fatura ({currentMonth})
                                    </h4>
                                    <span className="text-[10px] bg-secondary border border-primary px-2 py-0.5 rounded-full font-semibold text-secondary">
                                      {billItems.length} {billItems.length === 1 ? 'item' : 'itens'}
                                    </span>
                                  </div>
                                  {billItems.length === 0 ? (
                                    <p className="text-xs text-secondary italic">Sem lançamentos registrados nesta competência.</p>
                                  ) : (
                                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                      {billItems.map((item) => (
                                        <BillExpenseRowButton
                                          key={item.id}
                                          item={item}
                                          creditCardsWeightsEnabled={creditCardsWeightsEnabled}
                                          onOpen={openExpenseEditModal}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Pagamentos e Ajustes */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between border-b border-glass pb-1.5">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-primary">
                                      Pagamentos e Ajustes ({currentMonth})
                                    </h4>
                                    <span className="text-[10px] bg-secondary border border-primary px-2 py-0.5 rounded-full font-semibold text-secondary">
                                      {(paymentItemsByCard[card.id] || []).length} {(paymentItemsByCard[card.id] || []).length === 1 ? 'registro' : 'registros'}
                                    </span>
                                  </div>
                                  {(paymentItemsByCard[card.id] || []).length === 0 ? (
                                    <p className="text-xs text-secondary italic">Sem pagamentos registrados nesta competência.</p>
                                  ) : (
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                      {(paymentItemsByCard[card.id] || []).map((payment) => {
                                        const refundMeta = parseRefundNote(payment.note)
                                        return (
                                          <PaymentRowButton
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
                                          </PaymentRowButton>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                              </div>
                            )}
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="debts" className="space-y-4 outline-none animate-surface-enter">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-glass pb-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <Scale size={18} className="text-primary-light" />
                      Pendências
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-tertiary border border-primary px-2 py-0.5 rounded-full font-semibold text-secondary">
                        {pendingDebts.length}
                      </span>
                    </div>
                  </div>

                  {pendingDebts.length === 0 ? (
                    <Card className="text-center py-6 space-y-3">
                      <p className="text-secondary text-sm">Nenhuma pendência ativa para este período.</p>
                      <div className="flex justify-center">
                        <Button size="sm" onClick={openCreateDebtModal}>Nova Pendência</Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {pendingDebts.map((debt) => {
                        const isExpanded = !!expandedItems[debt.id]
                        const isPayable = debt.type === 'payable'
                        const isPaid = debt.status === 'paid'

                        return (
                          <Card key={debt.id} className="p-0 overflow-hidden border border-glass transition-all duration-300 relative">
                            {/* Color bar indicator for type */}
                            <div 
                              className={`absolute left-0 top-0 bottom-0 w-1 ${
                                isPayable ? 'bg-expense' : 'bg-income'
                              }`}
                            />

                            {/* Accordion Header */}
                            <div 
                              className="p-3 sm:p-4 pl-4 sm:pl-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                              onClick={() => toggleExpand(debt.id)}
                            >
                              <div className="min-w-0 flex-1 text-left">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-xs sm:text-sm font-bold text-primary truncate max-w-[140px] sm:max-w-none">{debt.name}</p>
                                  <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                    isPayable ? 'text-expense' : 'text-income'
                                  }`}>
                                    {isPayable ? 'A Pagar' : 'A Receber'}
                                  </span>
                                  {debt.expense_id && (
                                    <span 
                                      className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-primary shrink-0 cursor-help" 
                                      title="Esta pendência está integrada a uma despesa e as alterações serão sincronizadas."
                                    >
                                      <Link2 size={10} className="stroke-[3]" />
                                      Integrada
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-secondary font-mono mt-1 flex flex-wrap items-center gap-1.5">
                                  <span>Venc.: {formatDate(debt.due_date)}</span>
                                  <span className="text-[8px] bg-secondary/80 text-secondary px-1 py-0.5 rounded font-sans font-bold">
                                    Ref: {formatMonth(debt.due_date.substring(0, 7))}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                                <div className="text-right">
                                  <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block ${
                                    isPaid ? 'text-income' : 'text-warning'
                                  }`}>
                                    {isPaid ? 'Pago' : 'Pendente'}
                                  </span>
                                  <p className="text-xs sm:text-sm font-bold text-primary font-mono mt-0.5">{formatCurrency(debt.amount)}</p>
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

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                                  <div className="w-full sm:w-auto">
                                    <Button 
                                      size="sm" 
                                      variant={isPaid ? 'outline' : 'primary'}
                                      onClick={() => handleToggleDebtStatus(debt)}
                                      className="w-full sm:w-auto flex items-center justify-center gap-1.5"
                                    >
                                      <Check size={14} />
                                      {isPaid ? 'Marcar como Pendente' : isPayable ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:items-center sm:w-auto">
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => openEditDebtModal(debt)}
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
                    <div className="space-y-3 pt-4 border-t border-glass mt-4">
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
                            className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-income/5 border border-income/10 text-xs hover:bg-income/10 hover:border-income/20 transition-all select-none cursor-pointer"
                            title="Clique para reabrir esta pendência"
                            onClick={() => handleToggleDebtStatus(debt)}
                          >
                            <CheckCircle2 size={13} className="text-income shrink-0 group-hover:scale-110 transition-transform stroke-[2.5]" />
                            <span className="font-semibold text-primary truncate max-w-[120px]">{debt.name}</span>
                            <span className="text-income font-bold font-mono text-[10px]">{formatCurrency(debt.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </MonthTransitionView>
        )}
      </div>

      {/* MODAL: CARTÃO DE CRÉDITO */}
      <CardFormModal
        isOpen={isCardModalOpen}
        onClose={closeCardModal}
        onSubmit={handleSubmitCard}
        editingCard={editingCard}
        loading={loadingCards}
        onStartDelete={handleStartDelete}
      />

      {/* CONFIRM MODAL: DELETAR CARTÃO */}
      <DeleteCardConfirmModal
        isOpen={isDeleteConfirmModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        editingCard={editingCard}
        creditCards={creditCards}
        isDeleting={isDeleting}
        hasExpensesLinked={
          editingCard
            ? (billItemsByCard[editingCard.id] || []).length > 0
            : false
        }
      />

      {/* MODAL: AJUSTAR CICLO */}
      <CycleConfigModal
        isOpen={isCycleModalOpen}
        onClose={closeCycleModal}
        onSubmit={handleSubmitCycle}
        onReset={handleResetCycleToCardDefault}
        currentMonth={currentMonth}
        initialClosingDay={
          cycleCard
            ? monthlyCyclesByCard[selectedCardIdForCycle]?.closing_day ||
              cycleCard.closing_day
            : 8
        }
        initialDueDay={
          cycleCard
            ? monthlyCyclesByCard[selectedCardIdForCycle]?.due_day ||
              cycleCard.due_day
            : 15
        }
        loading={loadingBills}
      />

      {/* MODAL: EDITAR DESPESA DA FATURA */}
      <ExpenseEditModal
        isOpen={isExpenseEditModalOpen}
        onClose={closeExpenseEditModal}
        onSubmit={handleSubmitEditExpense}
        onDelete={handleDeleteExpense}
        expenseItem={editingExpenseItem}
        categories={categories}
        creditCards={creditCards}
        loading={loading}
      />

      {/* MODAL: EDITAR PAGAMENTO INDIVIDUAL */}
      <BillPaymentModal
        isOpen={isPaymentEditModalOpen}
        onClose={closePaymentEditModal}
        onSubmit={handleSubmitEditPayment}
        onDelete={handleDeletePayment}
        currentMonth={currentMonth}
        editingPayment={editingPaymentItem}
        loading={loading}
      />

      {/* MODAL: EDITAR ESTORNO (RENDA) */}
      <RefundIncomeEditModal
        isOpen={isRefundIncomeEditModalOpen}
        onClose={closeRefundIncomeEditModal}
        onSubmit={handleSubmitEditRefundIncome}
        onDelete={handleDeleteRefundIncome}
        initialData={editingRefundIncomeInitialData}
        incomeCategories={incomeCategories}
        loading={loading}
      />

      {/* MODAL: ESTORNO NOVO */}
      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={closeRefundModal}
        onSubmit={handleSubmitRefund}
        currentMonth={currentMonth}
        loading={loading}
      />

      {/* MODAL: REGISTRAR PAGAMENTO FATURA */}
      <BillPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        onSubmit={handleSubmitPayment}
        currentMonth={currentMonth}
        editingPayment={null}
        loading={loading}
      />

      {/* MODAL: NOVO/EDITAR LANÇAMENTO DE PENDÊNCIA */}
      <DebtFormModal
        isOpen={isDebtModalOpen}
        onClose={closeDebtModal}
        onSubmit={handleSubmitDebt}
        editingDebt={editingDebt}
        loading={loadingDebts}
      />

      {/* MODAL: CONCILIAÇÃO DE FATURA */}
      <Modal
        isOpen={!!reconciliationCardId}
        onClose={() => setReconciliationCardId('')}
        title={`Conciliação de Fatura (${currentMonth})`}
        size="2xl"
      >
        {reconciliationCardId && (() => {
          const card = creditCards.find((c) => c.id === reconciliationCardId)
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

      {/* MODAL: SELETOR DE NOVO LANÇAMENTO */}
      <Modal
        isOpen={isAddSelectorOpen}
        onClose={() => setIsAddSelectorOpen(false)}
        title="Novo Registro"
      >
        <div className="modal-body-stack">
          <ModalIntro align="center">Escolha o tipo de registro que deseja adicionar:</ModalIntro>
          <ModalChoiceGrid>
            <GlassChoiceCard
              label="Cartão de Crédito"
              icon={<CreditCardIcon size={24} />}
              intent="balance"
              onClick={() => {
                setIsAddSelectorOpen(false)
                openCreateCardModal()
              }}
            />
            <GlassChoiceCard
              label="Pendência (Pagar/Receber)"
              icon={<Scale size={24} />}
              intent="neutral"
              onClick={() => {
                setIsAddSelectorOpen(false)
                openCreateDebtModal()
              }}
            />
          </ModalChoiceGrid>
        </div>
      </Modal>

      {/* MODAL: CONFIRMAR RECEBIMENTO (CRIAR RENDA) */}
      <IncomeConfirmModal
        isOpen={isIncomeConfirmModalOpen}
        onClose={() => {
          setIsIncomeConfirmModalOpen(false)
          setSelectedDebtForIncome(null)
        }}
        debt={selectedDebtForIncome}
        onConfirmWithIncome={handleConfirmWithIncome}
        onConfirmWithoutIncome={handleConfirmWithoutIncome}
      />

      {/* MODAL: CONFIRMAR RECEBIMENTO INTEGRADO (DESPESA VINCULADA) */}
      <IntegratedDebtModal
        isOpen={isIntegratedModalOpen}
        onClose={() => {
          setIsIntegratedModalOpen(false)
          setSelectedDebtForIntegrated(null)
          setLinkedExpense(null)
        }}
        debt={selectedDebtForIntegrated}
        linkedExpense={linkedExpense}
        reportValueInput={integratedReportValueInput}
        onReportValueChange={setIntegratedReportValueInput}
        onConfirm={handleConfirmIntegrated}
      />

      {/* MODAL: CONFIRMAR PAGAMENTO DÍVIDA (CADASTRAR DESPESA?) */}
      <PayableConfirmModal
        isOpen={isPayableConfirmModalOpen}
        onClose={() => {
          setIsPayableConfirmModalOpen(false)
          setSelectedDebtForPayableExpense(null)
        }}
        debt={selectedDebtForPayableExpense}
        onConfirmWithExpense={() => {
          setIsPayableConfirmModalOpen(false)
          setIsPayableExpenseModalOpen(true)
        }}
        onConfirmWithoutExpense={handleConfirmPayableWithoutExpenseDirect}
      />

      {/* MODAL: CADASTRAR DESPESA VINCULADA AO PAGAR DÍVIDA */}
      <ExpenseFormModal
        isOpen={isPayableExpenseModalOpen}
        onClose={() => {
          setIsPayableExpenseModalOpen(false)
          setSelectedDebtForPayableExpense(null)
        }}
        editingExpense={null}
        categories={categories}
        creditCards={creditCards}
        onCreate={handleCreateExpenseForPayable}
        onUpdate={async () => ({ data: null, error: 'Não implementado nesta ação' })}
        onDelete={async () => ({ error: 'Não implementado nesta ação' })}
        defaultValues={selectedDebtForPayableExpense ? {
          amount: selectedDebtForPayableExpense.amount,
          description: selectedDebtForPayableExpense.name,
          date: selectedDebtForPayableExpense.due_date || format(new Date(), 'yyyy-MM-dd')
        } : undefined}
      />
    </div>
  )
}

