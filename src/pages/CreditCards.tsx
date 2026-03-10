import { useEffect, useMemo, useState } from 'react'
import { endOfMonth, format, subMonths } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Input from '@/components/Input'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Select from '@/components/Select'
import MonthSelector from '@/components/MonthSelector'
import CreditCardCsvReconciliationPanel from '@/components/CreditCardCsvReconciliationPanel'
import { PAGE_HEADERS } from '@/constants/pages'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { supabase } from '@/lib/supabase'
import type { CreditCard } from '@/types'
import { APP_START_DATE, APP_START_MONTH, formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import { resolveBillCompetence, resolveExpenseBillCompetence, summarizeCreditCardBill, type BillExpenseItem } from '@/utils/creditCardBilling'
import { hasExplicitCreditCardsDeepLink, resolveInitialCreditCardsMonth, shiftMonth } from '@/utils/creditCardMonthSelection'
import { Calendar, FileUp, Pencil, Plus, Wallet, Undo2, X, Check, Scale } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

type CardFormState = {
  name: string
  brand: string
  limit_total: string
  closing_day: string
  due_day: string
  color: string
  is_active: string
}

type MonthlyCycleRow = {
  id: string
  credit_card_id: string
  competence: string
  closing_day: number
  due_day: number
}

type PaymentItem = {
  id: string
  credit_card_id: string
  amount: number
  payment_date: string
  bill_competence?: string
  note?: string | null
}

type BillDataSnapshot = {
  expensesByCard: Record<string, number>
  paymentsByCard: Record<string, number>
  billItemsByCard: Record<string, BillExpenseItem[]>
  paymentItemsByCard: Record<string, PaymentItem[]>
  monthlyCyclesByCard: Record<string, MonthlyCycleRow>
}

type RefundIncomeFormState = {
  amount: string
  report_amount: string
  date: string
  income_category_id: string
  description: string
}

type ExpenseFormState = {
  amount: string
  report_amount: string
  date: string
  installment_total: string
  payment_method: string
  credit_card_id: string
  category_id: string
  description: string
}

const DEFAULT_EXPENSE_FORM = (categoryId = ''): ExpenseFormState => ({
  amount: '',
  report_amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  installment_total: '1',
  payment_method: 'other',
  credit_card_id: '',
  category_id: categoryId,
  description: '',
})

const DEFAULT_REFUND_INCOME_FORM = (incomeCategoryId = ''): RefundIncomeFormState => ({
  amount: '',
  report_amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  income_category_id: incomeCategoryId,
  description: '',
})

const REFUND_NOTE_PREFIX = '[REFUND]'
const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'

const buildRefundNote = (incomeId: string, description: string) =>
  `${REFUND_NOTE_PREFIX}${JSON.stringify({ incomeId, description })}`

const parseRefundNote = (rawNote?: string | null) => {
  const note = String(rawNote || '')
  if (!note.startsWith(REFUND_NOTE_PREFIX)) {
    return { isRefund: false as const }
  }

  const payload = note.slice(REFUND_NOTE_PREFIX.length)

  try {
    const parsed = JSON.parse(payload) as { incomeId?: string; description?: string }
    if (!parsed?.incomeId) {
      return { isRefund: false as const }
    }

    return {
      isRefund: true as const,
      incomeId: String(parsed.incomeId),
      description: String(parsed.description || ''),
    }
  } catch {
    return { isRefund: false as const }
  }
}

const DEFAULT_FORM: CardFormState = {
  name: '',
  brand: '',
  limit_total: '',
  closing_day: '8',
  due_day: '15',
  color: '#3b82f6',
  is_active: 'true',
}

export default function CreditCards() {
  const [searchParams] = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [hasResolvedInitialMonth, setHasResolvedInitialMonth] = useState(false)
  const [loadingBills, setLoadingBills] = useState(true)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentCardId, setPaymentCardId] = useState<string>('')
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const [isPaymentEditModalOpen, setIsPaymentEditModalOpen] = useState(false)
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [selectedCardIdForCycle, setSelectedCardIdForCycle] = useState<string>('')
  const [editingPaymentItem, setEditingPaymentItem] = useState<PaymentItem | null>(null)
  const [paymentEditAmount, setPaymentEditAmount] = useState('')
  const [paymentEditDate, setPaymentEditDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentEditNote, setPaymentEditNote] = useState('')
  const [cardForm, setCardForm] = useState<CardFormState>(DEFAULT_FORM)
  const [cycleForm, setCycleForm] = useState({ closing_day: '8', due_day: '15' })
  const [refundCardId, setRefundCardId] = useState<string>('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDate, setRefundDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [refundDescription, setRefundDescription] = useState('')
  const [isExpenseEditModalOpen, setIsExpenseEditModalOpen] = useState(false)
  const [editingExpenseItem, setEditingExpenseItem] = useState<BillExpenseItem | null>(null)
  const [expenseEditForm, setExpenseEditForm] = useState<ExpenseFormState>(DEFAULT_EXPENSE_FORM())
  const [isRefundIncomeEditModalOpen, setIsRefundIncomeEditModalOpen] = useState(false)
  const [editingRefundPaymentItem, setEditingRefundPaymentItem] = useState<PaymentItem | null>(null)
  const [editingRefundIncomeId, setEditingRefundIncomeId] = useState<string>('')
  const [refundIncomeEditForm, setRefundIncomeEditForm] = useState<RefundIncomeFormState>(DEFAULT_REFUND_INCOME_FORM())
  const [reconciliationCardId, setReconciliationCardId] = useState<string>('')

  const [expensesByCard, setExpensesByCard] = useState<Record<string, number>>({})
  const [paymentsByCard, setPaymentsByCard] = useState<Record<string, number>>({})
  const [billItemsByCard, setBillItemsByCard] = useState<Record<string, BillExpenseItem[]>>({})
  const [paymentItemsByCard, setPaymentItemsByCard] = useState<Record<string, PaymentItem[]>>({})
  const [monthlyCyclesByCard, setMonthlyCyclesByCard] = useState<Record<string, MonthlyCycleRow>>({})

  const {
    creditCards,
    loading,
    createCreditCard,
    updateCreditCard,
    refreshCreditCards,
  } = useCreditCards()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { createExpense, updateExpense, deleteExpense } = useExpenses()
  useIncomes()
  const { creditCardsWeightsEnabled, setCreditCardsWeightsEnabled } = useAppSettings()

  const activeCards = useMemo(
    () => creditCards.filter((card) => card.is_active !== false),
    [creditCards],
  )

  const openCreateCardModal = () => {
    setEditingCard(null)
    setCardForm(DEFAULT_FORM)
    setIsCardModalOpen(true)
  }

  const openEditCardModal = (card: CreditCard) => {
    setEditingCard(card)
    setCardForm({
      name: card.name,
      brand: card.brand || '',
      limit_total: card.limit_total ? String(card.limit_total) : '',
      closing_day: String(card.closing_day),
      due_day: String(card.due_day),
      color: card.color || '#3b82f6',
      is_active: card.is_active === false ? 'false' : 'true',
    })
    setIsCardModalOpen(true)
  }

  const closeCardModal = () => {
    setIsCardModalOpen(false)
    setEditingCard(null)
    setCardForm(DEFAULT_FORM)
  }

  const openPaymentField = (cardId: string) => {
    setPaymentCardId(cardId)
    setPaymentAmount('')
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setPaymentNote('')
  }

  const closePaymentField = () => {
    setPaymentCardId('')
    setPaymentAmount('')
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setPaymentNote('')
  }

  const toggleReconciliationField = (cardId: string) => {
    if (reconciliationCardId === cardId) {
      setReconciliationCardId('')
      return
    }

    setReconciliationCardId(cardId)
  }

  const togglePaymentField = (cardId: string) => {
    if (paymentCardId === cardId) {
      closePaymentField()
      return
    }

    openPaymentField(cardId)
  }

  const openPaymentEditModal = (item: PaymentItem) => {
    setEditingPaymentItem(item)
    setPaymentEditAmount(String(item.amount || ''))
    setPaymentEditDate(item.payment_date || format(new Date(), 'yyyy-MM-dd'))
    setPaymentEditNote(item.note || '')
    setIsPaymentEditModalOpen(true)
  }

  const closePaymentEditModal = () => {
    setIsPaymentEditModalOpen(false)
    setEditingPaymentItem(null)
    setPaymentEditAmount('')
    setPaymentEditDate(format(new Date(), 'yyyy-MM-dd'))
    setPaymentEditNote('')
  }

  const handleExpenseAmountChange = (nextAmount: string) => {
    setExpenseEditForm((previous) => {
      const previousAmount = parseMoneyInput(previous.amount)
      const previousReportAmount = parseMoneyInput(previous.report_amount)
      const shouldSyncReportAmount =
        !previous.report_amount ||
        (!Number.isNaN(previousAmount) &&
          !Number.isNaN(previousReportAmount) &&
          Math.abs(previousReportAmount - previousAmount) < 0.009)

      return {
        ...previous,
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : previous.report_amount,
      }
    })
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
        color: '#16a34a',
      }])
      .select('id')
      .single()

    if (error || !data?.id) {
      throw new Error(error?.message || 'Não foi possível criar a categoria de renda Estorno.')
    }

    return String(data.id)
  }

  const openCycleModal = (card: CreditCard) => {
    const currentCycle = monthlyCyclesByCard[card.id]

    setSelectedCardIdForCycle(card.id)
    setCycleForm({
      closing_day: String(currentCycle?.closing_day || card.closing_day),
      due_day: String(currentCycle?.due_day || card.due_day),
    })
    setIsCycleModalOpen(true)
  }

  const closeCycleModal = () => {
    setIsCycleModalOpen(false)
    setSelectedCardIdForCycle('')
    setCycleForm({ closing_day: '8', due_day: '15' })
  }

  const toggleRefundField = (cardId: string) => {
    if (refundCardId === cardId) {
      setRefundCardId('')
      return
    }

    setRefundCardId(cardId)
    setRefundAmount('')
    setRefundDate(format(new Date(), 'yyyy-MM-dd'))
    setRefundDescription('')
  }

  const closeRefundField = () => {
    setRefundCardId('')
    setRefundAmount('')
    setRefundDate(format(new Date(), 'yyyy-MM-dd'))
    setRefundDescription('')
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
        .gte('date', searchStartDate)
        .lte('date', searchEndDate)

      const resolveClosingDay = (cardId: string, competence: string) => {
        const monthlyClosing = cycleClosingByCardAndMonth[`${cardId}:${competence}`]
        if (Number.isFinite(monthlyClosing)) return monthlyClosing

        const defaultClosing = cardClosingDays[cardId]
        return Number.isFinite(defaultClosing) ? defaultClosing : undefined
      }

      const expenseRows = (rawExpenseRows || []).map((row) => {
        return {
          ...(row as BillExpenseItem),
          category_name: (row as { category?: { name?: string | null } | null }).category?.name || null,
        }
      }).filter((row) => {
        const rowDate = String(row.date)
        const rowCardId = String(row.credit_card_id)
        
        const competenceByDate = rowDate.slice(0, 7)
        const closingDay = resolveClosingDay(rowCardId, competenceByDate)
        
        let resolvedCompetence = row.bill_competence
        // Recálculo dinâmico da fatura baseado no dia de fechamento vigente, 
        // ignorando o "bill_competence" predefinido no BD (que seria obsoleto se o ciclo mudou)
        if (Number.isFinite(closingDay)) {
          resolvedCompetence = resolveBillCompetence(rowDate, Number(closingDay))
        } else if (!resolvedCompetence) {
          resolvedCompetence = resolveExpenseBillCompetence(row as any, resolveClosingDay)
        }

        row.bill_competence = resolvedCompetence
        return resolvedCompetence === targetMonth
      }).map((row) => {
        const baseAmount = Number(row.amount || 0)

        if (!creditCardsWeightsEnabled) {
          return {
            ...row,
            amount: baseAmount,
            base_amount: baseAmount,
          }
        }

        const weight = Number(row.report_weight ?? 1)
        const safeWeight = Number.isFinite(weight) ? weight : 1

        return {
          ...row,
          amount: Number((baseAmount * safeWeight).toFixed(2)),
          base_amount: baseAmount,
        }
      })

      const { data: paymentRows } = await supabase
        .from('credit_card_bill_payments')
        .select('id, credit_card_id, amount, payment_date, bill_competence, note')
        .not('credit_card_id', 'is', null)
        .or(`bill_competence.eq.${targetMonth},and(amount.lt.0,payment_date.gte.${searchStartDate},payment_date.lte.${searchEndDate})`)

      const paymentsByCardItems = (paymentRows || []).reduce<Record<string, PaymentItem[]>>((accumulator, row) => {
        const cardId = String(row.credit_card_id || '')
        const rawNote = String(row.note || '')
        const isRefund = Number(row.amount || 0) < 0 && rawNote.startsWith('[REFUND]')
        const paymentDate = String(row.payment_date || '')
        let finalCompetence = String(row.bill_competence || targetMonth)

        if (isRefund) {
          const closingDay = resolveClosingDay(cardId, paymentDate.slice(0, 7))
          if (Number.isFinite(closingDay)) {
            finalCompetence = resolveBillCompetence(paymentDate, Number(closingDay))
          }
        }

        if (finalCompetence !== targetMonth) return accumulator

        if (!cardId) return accumulator

        if (!accumulator[cardId]) {
          accumulator[cardId] = []
        }

        accumulator[cardId].push({
          id: String(row.id || ''),
          credit_card_id: cardId,
          amount: Number(row.amount || 0),
          payment_date: String(row.payment_date || ''),
          bill_competence: String(row.bill_competence || targetMonth),
          note: row.note ? String(row.note) : null,
        })

        return accumulator
      }, {})

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

      return {
        expensesByCard: summarizedBill.expensesByCard,
        paymentsByCard: summarizedBill.paymentsByCard,
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

  const hasPendingBalanceForActiveCards = (snapshot: Pick<BillDataSnapshot, 'expensesByCard' | 'paymentsByCard'>) => {
    if (!activeCards.length) return false

    return activeCards.some((card) => {
      const totalPrevisto = Number(snapshot.expensesByCard[card.id] || 0)
      const totalPago = Number(snapshot.paymentsByCard[card.id] || 0)
      return Number((totalPrevisto - totalPago).toFixed(2)) > 0.009
    })
  }

  const loadBillData = async () => {
    try {
      setLoadingBills(true)

      const snapshot = await getBillDataSnapshot(currentMonth)
      setExpensesByCard(snapshot.expensesByCard)
      setPaymentsByCard(snapshot.paymentsByCard)
      setBillItemsByCard(snapshot.billItemsByCard)
      setPaymentItemsByCard(snapshot.paymentItemsByCard)
      setMonthlyCyclesByCard(snapshot.monthlyCyclesByCard)
    } finally {
      setLoadingBills(false)
    }
  }

  useEffect(() => {
    if (hasResolvedInitialMonth) return
    if (loading) return

    if (hasExplicitCreditCardsDeepLink(searchParams, getCurrentMonthString())) {
      const targetMonth = searchParams.get('month')
      if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
        setCurrentMonth(targetMonth)
      }
      setHasResolvedInitialMonth(true)
      return
    }

    let isCancelled = false

    const resolveInitialMonth = async () => {
      const resolvedMonth = await resolveInitialCreditCardsMonth({
        currentMonth,
        appStartMonth: APP_START_MONTH,
        hasPendingForMonth: async (month) => {
          const monthSnapshot = await getBillDataSnapshot(month)
          if (isCancelled) return false
          return hasPendingBalanceForActiveCards(monthSnapshot)
        },
      })

      if (isCancelled) return

      if (resolvedMonth !== currentMonth) {
        setCurrentMonth(resolvedMonth)
      }

      setHasResolvedInitialMonth(true)
    }

    void resolveInitialMonth()

    return () => {
      isCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasResolvedInitialMonth,
    loading,
    searchParams,
    currentMonth,
    activeCards,
  ])

  useEffect(() => {
    if (!hasResolvedInitialMonth) return
    void loadBillData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResolvedInitialMonth, currentMonth, creditCards, creditCardsWeightsEnabled])

  useEffect(() => {
    const targetCardId = searchParams.get('card')
    if (!targetCardId || loading || loadingBills) return

    const targetElement = document.getElementById(`credit-card-${targetCardId}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [searchParams, loading, loadingBills, currentMonth])

  const handleSubmitCard = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!cardForm.name.trim()) {
      alert('Informe o nome do cartão.')
      return
    }

    const closingDay = Number(cardForm.closing_day)
    const dueDay = Number(cardForm.due_day)

    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
      alert('O dia de fechamento deve estar entre 1 e 31.')
      return
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      alert('O dia de vencimento deve estar entre 1 e 31.')
      return
    }

    const limitTotal = cardForm.limit_total ? Number(cardForm.limit_total) : null
    if (limitTotal !== null && (!Number.isFinite(limitTotal) || limitTotal < 0)) {
      alert('O limite deve ser zero ou maior.')
      return
    }

    const payload = {
      name: cardForm.name.trim(),
      brand: cardForm.brand.trim() || null,
      limit_total: limitTotal,
      closing_day: closingDay,
      due_day: dueDay,
      color: cardForm.color || null,
      is_active: cardForm.is_active !== 'false',
    }

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
    await loadBillData()
  }

  const handleSubmitPayment = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!paymentCardId) {
      alert('Selecione um cartão válido.')
      return
    }

    const parsedAmount = Number(paymentAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Informe um valor de pagamento maior que zero.')
      return
    }

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .insert([{
        credit_card_id: paymentCardId,
        bill_competence: currentMonth,
        amount: parsedAmount,
        payment_date: paymentDate,
        ...(paymentNote.trim() ? { note: paymentNote.trim() } : {}),
      }])

    if (error) {
      alert(`Erro ao registrar pagamento: ${error.message}`)
      return
    }

    closePaymentField()
    await loadBillData()
  }

  const handleSubmitEditPayment = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!editingPaymentItem?.id) {
      alert('Pagamento inválido para edição.')
      return
    }

    // Estornos não podem ser editados como pagamentos comuns — devem usar o modal de estorno
    const refundMeta = parseRefundNote(editingPaymentItem.note)
    if (refundMeta.isRefund) {
      closePaymentEditModal()
      await openRefundIncomeEditModal(editingPaymentItem, refundMeta.incomeId, refundMeta.description || 'Estorno de compra')
      return
    }

    const parsedAmount = Number(paymentEditAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Informe um valor de pagamento maior que zero.')
      return
    }

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .update({
        amount: parsedAmount,
        payment_date: paymentEditDate,
        note: paymentEditNote.trim() || null,
      })
      .eq('id', editingPaymentItem.id)

    if (error) {
      alert(`Erro ao editar pagamento: ${error.message}`)
      return
    }

    closePaymentEditModal()
    await loadBillData()
  }

  const handleDeletePayment = async () => {
    if (!editingPaymentItem?.id) return

    const confirmed = window.confirm('Deseja excluir este pagamento?')
    if (!confirmed) return

    // Verifica se é um estorno — se sim, deve excluir a renda vinculada junto
    const refundMeta = parseRefundNote(editingPaymentItem.note)
    if (refundMeta.isRefund) {
      // Redireciona para o fluxo correto que exclui ambos
      closePaymentEditModal()
      await openRefundIncomeEditModal(editingPaymentItem, refundMeta.incomeId, refundMeta.description || 'Estorno de compra')
      return
    }

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .delete()
      .eq('id', editingPaymentItem.id)

    if (error) {
      alert(`Erro ao excluir pagamento: ${error.message}`)
      return
    }

    closePaymentEditModal()
    await loadBillData()
  }

  const handleRefundIncomeAmountChange = (nextAmount: string) => {
    setRefundIncomeEditForm((previous) => {
      const previousAmount = parseMoneyInput(previous.amount)
      const previousReportAmount = parseMoneyInput(previous.report_amount)
      const shouldSyncReportAmount =
        !previous.report_amount ||
        (!Number.isNaN(previousAmount) &&
          !Number.isNaN(previousReportAmount) &&
          Math.abs(previousReportAmount - previousAmount) < 0.009)

      return {
        ...previous,
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : previous.report_amount,
      }
    })
  }

  const openRefundIncomeEditModal = async (payment: PaymentItem, incomeId: string, fallbackDescription: string) => {
    const { data: incomeRow, error } = await supabase
      .from('incomes')
      .select('id, amount, report_weight, date, income_category_id, description')
      .eq('id', incomeId)
      .maybeSingle()

    if (error || !incomeRow) {
      alert('Não foi possível carregar a renda vinculada a este estorno.')
      return
    }

    setEditingRefundPaymentItem(payment)
    setEditingRefundIncomeId(String(incomeRow.id))
    setRefundIncomeEditForm({
      amount: formatMoneyInput(Number(incomeRow.amount || 0)),
      report_amount: formatMoneyInput(Number(incomeRow.amount || 0) * Number(incomeRow.report_weight ?? 1)),
      date: String(incomeRow.date || payment.payment_date || format(new Date(), 'yyyy-MM-dd')),
      income_category_id: String(incomeRow.income_category_id || incomeCategories[0]?.id || ''),
      description: String(incomeRow.description || fallbackDescription || ''),
    })
    setIsRefundIncomeEditModalOpen(true)
  }

  const closeRefundIncomeEditModal = () => {
    setIsRefundIncomeEditModalOpen(false)
    setEditingRefundPaymentItem(null)
    setEditingRefundIncomeId('')
    setRefundIncomeEditForm(DEFAULT_REFUND_INCOME_FORM(incomeCategories[0]?.id || ''))
  }

  const handleSubmitEditRefundIncome = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!editingRefundPaymentItem?.id || !editingRefundIncomeId) {
      alert('Estorno inválido para edição.')
      return
    }

    const amount = parseMoneyInput(refundIncomeEditForm.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount = refundIncomeEditForm.report_amount ? parseMoneyInput(refundIncomeEditForm.report_amount) : amount
    if (Number.isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da renda')
      return
    }

    if (!refundIncomeEditForm.income_category_id) {
      alert('Selecione uma categoria de renda para o estorno.')
      return
    }

    const reportWeight = amount > 0 ? Number((reportAmount / amount).toFixed(4)) : 1
    const description = refundIncomeEditForm.description.trim() || `Estorno de compra (${currentMonth})`

    const { error: incomeUpdateError } = await supabase
      .from('incomes')
      .update({
        amount,
        report_weight: reportWeight,
        date: refundIncomeEditForm.date,
        income_category_id: refundIncomeEditForm.income_category_id,
        description,
      })
      .eq('id', editingRefundIncomeId)

    if (incomeUpdateError) {
      alert(`Erro ao editar renda de estorno: ${incomeUpdateError.message}`)
      return
    }

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .update({
        amount,
        payment_date: refundIncomeEditForm.date,
        note: buildRefundNote(editingRefundIncomeId, description),
      })
      .eq('id', editingRefundPaymentItem.id)

    if (error) {
      alert(`Erro ao editar ajuste de fatura do estorno: ${error.message}`)
      return
    }

    closeRefundIncomeEditModal()
    await loadBillData()
  }

  const handleDeleteRefundIncome = async () => {
    if (!editingRefundPaymentItem?.id || !editingRefundIncomeId) return

    const confirmed = window.confirm('Deseja excluir este estorno?')
    if (!confirmed) return

    const paymentDelete = await supabase
      .from('credit_card_bill_payments')
      .delete()
      .eq('id', editingRefundPaymentItem.id)

    if (paymentDelete.error) {
      alert(`Erro ao excluir ajuste de fatura: ${paymentDelete.error.message}`)
      return
    }

    const { error: incomeDeleteError } = await supabase
      .from('incomes')
      .delete()
      .eq('id', editingRefundIncomeId)

    if (incomeDeleteError) {
      alert(`Ajuste da fatura removido, mas houve erro ao excluir a renda: ${incomeDeleteError.message}`)
    }

    closeRefundIncomeEditModal()
    await loadBillData()
  }

  const handleOpenPaymentItem = async (payment: PaymentItem) => {
    const refundMeta = parseRefundNote(payment.note)

    if (refundMeta.isRefund) {
      await openRefundIncomeEditModal(payment, refundMeta.incomeId, refundMeta.description || 'Estorno de compra')
      return
    }

    openPaymentEditModal(payment)
  }

  const handleSubmitCycle = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!selectedCardIdForCycle) {
      alert('Selecione um cartão válido.')
      return
    }

    const closingDay = Number(cycleForm.closing_day)
    const dueDay = Number(cycleForm.due_day)

    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
      alert('O dia de fechamento do mês deve estar entre 1 e 31.')
      return
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      alert('O dia de vencimento do mês deve estar entre 1 e 31.')
      return
    }

    const { error } = await supabase
      .from('credit_card_monthly_cycles')
      .upsert([{
        credit_card_id: selectedCardIdForCycle,
        competence: currentMonth,
        closing_day: closingDay,
        due_day: dueDay,
      }], {
        onConflict: 'credit_card_id,competence',
      })

    if (error) {
      alert(`Erro ao salvar ajuste mensal: ${error.message}`)
      return
    }

    closeCycleModal()
    await loadBillData()
  }

  const handleResetCycleToCardDefault = async () => {
    if (!selectedCardIdForCycle) return

    const { error } = await supabase
      .from('credit_card_monthly_cycles')
      .delete()
      .eq('credit_card_id', selectedCardIdForCycle)
      .eq('competence', currentMonth)

    if (error) {
      alert(`Erro ao remover ajuste mensal: ${error.message}`)
      return
    }

    closeCycleModal()
    await loadBillData()
  }

  const handleSubmitRefund = async (event: React.FormEvent, cardId: string) => {
    event.preventDefault()

    if (!cardId) {
      alert('Selecione um cartão válido para registrar o estorno.')
      return
    }

    const parsedAmount = parseMoneyInput(refundAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Informe um valor de estorno maior que zero.')
      return
    }

    let refundIncomeCategoryId = ''
    try {
      refundIncomeCategoryId = await getOrCreateRefundIncomeCategoryId()
    } catch (categoryError) {
      alert(categoryError instanceof Error ? categoryError.message : 'Não foi possível preparar a categoria Estorno.')
      return
    }

    const description = refundDescription.trim() || `Estorno de compra (${currentMonth})`

    // Busca o user_id atual para garantir conformidade com as políticas RLS
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    // Insere diretamente no Supabase com user_id para evitar falha silenciosa de RLS
    const { data: incomeData, error: incomeError } = await supabase
      .from('incomes')
      .insert([{
        amount: parsedAmount,
        report_weight: 1,
        date: refundDate,
        income_category_id: refundIncomeCategoryId,
        description,
        type: 'other',
        ...(userId ? { user_id: userId } : {}),
      }])
      .select('id')
      .single()

    if (incomeError || !incomeData?.id) {
      alert(`Erro ao registrar renda de estorno: ${incomeError?.message || 'Falha ao criar renda.'}`)
      return
    }

    const createdIncomeId = String(incomeData.id)

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .insert([{
        credit_card_id: cardId,
        bill_competence: currentMonth,
        amount: parsedAmount,
        payment_date: refundDate,
        note: buildRefundNote(createdIncomeId, description),
        ...(userId ? { user_id: userId } : {}),
      }])

    if (error) {
      // Reverter a renda criada para evitar órfão
      await supabase.from('incomes').delete().eq('id', createdIncomeId)
      alert(`Erro ao registrar estorno: ${error.message}`)
      return
    }

    closeRefundField()
    await loadBillData()
  }

  const openExpenseEditModal = (item: BillExpenseItem) => {
    const absoluteAmount = Math.abs(Number(item.base_amount ?? item.amount ?? 0))
    const weight = Number(item.report_weight ?? 1)

    setEditingExpenseItem(item)
    setExpenseEditForm({
      amount: formatMoneyInput(absoluteAmount),
      report_amount: formatMoneyInput(absoluteAmount * weight),
      date: item.date || format(new Date(), 'yyyy-MM-dd'),
      installment_total: String(item.installment_total || 1),
      payment_method: item.payment_method || 'credit_card',
      credit_card_id: item.credit_card_id || '',
      category_id: item.category_id || categories[0]?.id || '',
      description: item.description || '',
    })
    setIsExpenseEditModalOpen(true)
  }

  const closeExpenseEditModal = () => {
    setIsExpenseEditModalOpen(false)
    setEditingExpenseItem(null)
    setExpenseEditForm(DEFAULT_EXPENSE_FORM(categories[0]?.id || ''))
  }

  const handleSubmitEditExpense = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!editingExpenseItem?.id || !expenseEditForm.category_id) return

    const amountBase = parseMoneyInput(expenseEditForm.amount)
    if (Number.isNaN(amountBase) || amountBase <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount = expenseEditForm.report_amount ? parseMoneyInput(expenseEditForm.report_amount) : amountBase
    if (Number.isNaN(reportAmount) || reportAmount < 0 || reportAmount > amountBase) {
      alert('O valor no relatório deve estar entre 0 e o valor da despesa')
      return
    }

    if (expenseEditForm.payment_method === 'credit_card' && !expenseEditForm.credit_card_id) {
      alert('Selecione um cartão de crédito para compras no crédito.')
      return
    }

    const isRefund = Number(editingExpenseItem.base_amount ?? editingExpenseItem.amount ?? 0) < 0
    const signedAmount = isRefund ? -Math.abs(amountBase) : amountBase
    const reportWeight = amountBase > 0 ? Number((reportAmount / amountBase).toFixed(4)) : 1

    const { error } = await updateExpense(editingExpenseItem.id, {
      amount: signedAmount,
      report_weight: reportWeight,
      date: expenseEditForm.date,
      payment_method: expenseEditForm.payment_method as BillExpenseItem['payment_method'],
      credit_card_id: expenseEditForm.payment_method === 'credit_card' ? expenseEditForm.credit_card_id : null,
      category_id: expenseEditForm.category_id,
      description: expenseEditForm.description || undefined,
    })

    if (error) {
      alert(`Erro ao editar despesa: ${error}`)
      return
    }

    closeExpenseEditModal()
    await loadBillData()
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
    await loadBillData()
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.creditCards.title}
        subtitle={PAGE_HEADERS.creditCards.description}
        action={(
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreditCardsWeightsEnabled(!creditCardsWeightsEnabled)}
              title={creditCardsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
              className="flex items-center gap-2"
            >
              <Scale size={16} />
              <span className="hidden sm:inline">
                {creditCardsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
              </span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreateCardModal}
              className="flex items-center gap-2"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Novo cartão</span>
            </Button>
          </div>
        )}
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        {hasResolvedInitialMonth ? (
          <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
        ) : (
          <div className="mb-4 h-10" aria-hidden="true" />
        )}

        {loading || !hasResolvedInitialMonth || loadingBills ? (
          <Card className="text-center py-8">Carregando cartões e faturas...</Card>
        ) : activeCards.length === 0 ? (
          <Card className="text-center py-8 space-y-3">
            <p className="text-secondary">Nenhum cartão ativo cadastrado.</p>
            <div className="flex justify-center">
              <Button onClick={openCreateCardModal}>Cadastrar primeiro cartão</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeCards.map((card) => {
              const totalPrevisto = Number(expensesByCard[card.id] || 0)
              const totalPago = Number(paymentsByCard[card.id] || 0)
              const saldoAberto = Number((totalPrevisto - totalPago).toFixed(2))
              const billItems = billItemsByCard[card.id] || []
              const monthlyCycle = monthlyCyclesByCard[card.id]
              const effectiveClosingDay = monthlyCycle?.closing_day || card.closing_day
              const effectiveDueDay = monthlyCycle?.due_day || card.due_day

              return (
                <div key={card.id} id={`credit-card-${card.id}`}>
                  <Card className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: card.color || 'var(--color-primary)' }}
                        />
                        <p className="text-base font-semibold text-primary">{card.name}</p>
                      </div>
                      <p className="text-xs text-secondary mt-1">
                        {card.brand || 'Sem bandeira'} • {currentMonth}: fecha dia {effectiveClosingDay} • vence dia {effectiveDueDay}
                        {monthlyCycle ? ' (ajuste mensal)' : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-start gap-2">
                      <IconButton
                        size="sm"
                        icon={<Pencil size={16} />}
                        onClick={() => openEditCardModal(card)}
                        label="Editar cartão"
                        title="Editar cartão"
                      />
                      <IconButton
                        size="sm"
                        icon={<Calendar size={16} />}
                        onClick={() => openCycleModal(card)}
                        label="Ajustar ciclo do mês"
                        title="Ajustar ciclo do mês"
                      />
                      <IconButton
                        size="sm"
                        icon={refundCardId === card.id ? <X size={16} /> : <Undo2 size={16} />}
                        onClick={() => toggleRefundField(card.id)}
                        label={refundCardId === card.id ? 'Fechar estorno' : 'Registrar estorno'}
                        title={refundCardId === card.id ? 'Fechar estorno' : 'Registrar estorno'}
                      />
                      <IconButton
                        size="sm"
                        icon={paymentCardId === card.id ? <X size={16} /> : <Wallet size={16} />}
                        onClick={() => togglePaymentField(card.id)}
                        label={paymentCardId === card.id ? 'Fechar pagamento' : 'Registrar pagamento'}
                        title={paymentCardId === card.id ? 'Fechar pagamento' : 'Registrar pagamento'}
                      />
                      <IconButton
                        size="sm"
                        icon={reconciliationCardId === card.id ? <X size={16} /> : <FileUp size={16} />}
                        onClick={() => toggleReconciliationField(card.id)}
                        label={reconciliationCardId === card.id ? 'Fechar CSV' : 'Anexar CSV'}
                        title={reconciliationCardId === card.id ? 'Fechar CSV' : 'Anexar CSV'}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-primary bg-secondary p-3">
                      <p className="text-xs text-secondary">Total previsto</p>
                      <p className="text-base font-semibold text-primary">{formatCurrency(totalPrevisto)}</p>
                    </div>
                    <div className="rounded-lg border border-primary bg-secondary p-3">
                      <p className="text-xs text-secondary">Total pago</p>
                      <p className="text-base font-semibold text-primary">{formatCurrency(totalPago)}</p>
                    </div>
                    <div className="rounded-lg border border-primary bg-secondary p-3">
                      <p className="text-xs text-secondary">Saldo em aberto</p>
                      <p className="text-base font-semibold text-primary">{formatCurrency(saldoAberto)}</p>
                    </div>
                  </div>

                  {refundCardId === card.id && (
                    <form
                      onSubmit={(event) => handleSubmitRefund(event, card.id)}
                      className="rounded-lg border border-primary bg-secondary p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-secondary">
                          Estorno de compra ({currentMonth})
                        </p>
                        <IconButton
                          type="button"
                          size="sm"
                          icon={<X size={16} />}
                          onClick={closeRefundField}
                          label="Fechar formulário de estorno"
                          title="Fechar formulário de estorno"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          label="Valor do estorno"
                          type="text"
                          inputMode="decimal"
                          value={refundAmount}
                          onChange={(event) => setRefundAmount(event.target.value)}
                          onBlur={() => {
                            const parsed = parseMoneyInput(refundAmount)
                            if (!Number.isNaN(parsed) && parsed >= 0) {
                              setRefundAmount(formatMoneyInput(parsed))
                            }
                          }}
                          placeholder="0,00"
                          required
                        />

                        <Input
                          label="Data"
                          type="date"
                          value={refundDate}
                          onChange={(event) => setRefundDate(event.target.value)}
                          required
                        />

                        <div className="flex items-end justify-center">
                          <Button 
                            type="submit" 
                            size="sm" 
                            variant="ghost" 
                            className="btn-discrete-save px-4"
                            title="Confirmar estorno"
                          >
                            <Check size={24} />
                          </Button>
                        </div>
                      </div>

                      <Input
                        label="Descrição (opcional)"
                        value={refundDescription}
                        onChange={(event) => setRefundDescription(event.target.value)}
                        placeholder="Ex: Estorno compra loja X"
                      />

                      <p className="text-xs text-secondary">Categoria padrão: Estorno • Valor no relatório: igual ao valor do estorno.</p>
                    </form>
                  )}

                  {paymentCardId === card.id && (
                    <form
                      onSubmit={handleSubmitPayment}
                      className="rounded-lg border border-primary bg-secondary p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-secondary">
                          Registrar pagamento ({currentMonth})
                        </p>
                        <IconButton
                          type="button"
                          size="sm"
                          icon={<X size={16} />}
                          onClick={closePaymentField}
                          label="Fechar formulário de pagamento"
                          title="Fechar formulário de pagamento"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          label="Valor pago"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          required
                        />

                        <Input
                          label="Data do pagamento"
                          type="date"
                          value={paymentDate}
                          onChange={(event) => setPaymentDate(event.target.value)}
                          required
                        />

                        <div className="flex items-end justify-center">
                          <Button 
                            type="submit" 
                            size="sm" 
                            variant="ghost"
                            className="btn-discrete-save px-4"
                            title="Confirmar pagamento"
                          >
                            <Check size={24} />
                          </Button>
                        </div>
                      </div>

                      <Input
                        label="Observação (opcional)"
                        value={paymentNote}
                        onChange={(event) => setPaymentNote(event.target.value)}
                      />
                    </form>
                  )}

                  {reconciliationCardId === card.id && (
                    <CreditCardCsvReconciliationPanel
                      card={card}
                      currentMonth={currentMonth}
                      paymentItems={paymentItemsByCard[card.id] || []}
                      categories={categories.map((category) => ({
                        id: category.id,
                        name: category.name,
                      }))}
                      onClose={() => setReconciliationCardId('')}
                      onReloadBillData={loadBillData}
                      createExpense={createExpense}
                      updateExpense={updateExpense}
                      fetchReconciliationCandidates={fetchReconciliationCandidates}
                    />
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-secondary">
                      Lançamentos da fatura ({currentMonth})
                    </p>

                    {billItems.length === 0 ? (
                      <p className="text-sm text-secondary">Sem lançamentos neste cartão para a competência selecionada.</p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                        {billItems.map((item) => {
                          const isRefund = item.amount < 0
                          const installmentLabel =
                            Number(item.installment_total || 1) > 1
                              ? `Parcela ${item.installment_number || 1}/${item.installment_total}`
                              : ''

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openExpenseEditModal(item)}
                              className="w-full rounded-lg border border-primary bg-primary p-2.5 text-left motion-standard hover-lift-subtle press-subtle hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-primary truncate">
                                    {item.description || (isRefund ? 'Estorno' : item.category_name || 'Despesa')}
                                  </p>
                                  <p className="text-xs text-secondary mt-0.5">
                                    {formatDate(item.date)}
                                    {installmentLabel ? ` • ${installmentLabel}` : ''}
                                    {isRefund ? ' • Estorno' : ''}
                                  </p>
                                </div>

                                <div className="flex flex-col gap-1.5 sm:items-end">
                                  <p className={`text-sm font-semibold ${Number(item.base_amount ?? item.amount ?? 0) < 0 ? 'text-income' : 'text-primary'}`}>
                                    {formatCurrency(item.amount)}
                                  </p>

                                  {(() => {
                                    const baseAmount = Number(item.base_amount ?? item.amount ?? 0)
                                    const weightedAmount = Number((baseAmount * Number(item.report_weight ?? 1)).toFixed(2))
                                    const hasDifference = Math.abs(weightedAmount - baseAmount) > 0.009

                                    if (!hasDifference) return null

                                    return (
                                      <p className="text-xs text-secondary">
                                        {creditCardsWeightsEnabled
                                          ? `Sem pesos: ${formatCurrency(baseAmount)}`
                                          : `Com pesos: ${formatCurrency(weightedAmount)}`}
                                      </p>
                                    )
                                  })()}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {(paymentItemsByCard[card.id] || []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-secondary">
                        Pagamentos registrados ({currentMonth})
                      </p>

                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                        {(paymentItemsByCard[card.id] || []).map((payment) => (
                          <button
                            key={payment.id}
                            type="button"
                            onClick={() => {
                              void handleOpenPaymentItem(payment)
                            }}
                            className="w-full rounded-lg border border-primary bg-primary p-2.5 text-left motion-standard hover-lift-subtle press-subtle hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                {(() => {
                                  const refundMeta = parseRefundNote(payment.note)

                                  return (
                                    <>
                                      <p className="text-sm font-medium text-primary truncate">
                                        {refundMeta.isRefund
                                          ? (refundMeta.description || 'Estorno de compra')
                                          : (payment.note || 'Pagamento de fatura')}
                                      </p>
                                      <p className="text-xs text-secondary mt-0.5">
                                        {formatDate(payment.payment_date)}
                                        {refundMeta.isRefund ? ' • Estorno' : ''}
                                      </p>
                                    </>
                                  )
                                })()}
                              </div>
                              <p className="text-sm font-semibold text-income">{formatCurrency(payment.amount)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isCardModalOpen}
        onClose={closeCardModal}
        title={editingCard ? 'Editar cartão de crédito' : 'Novo cartão de crédito'}
      >
        <form onSubmit={handleSubmitCard} className="w-full max-w-md mx-auto space-y-4">
          <Input
            label="Nome"
            value={cardForm.name}
            onChange={(event) => setCardForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />

          <Input
            label="Bandeira"
            value={cardForm.brand}
            onChange={(event) => setCardForm((prev) => ({ ...prev, brand: event.target.value }))}
            placeholder="Ex: Visa, Master"
          />

          <Input
            label="Limite total (opcional)"
            type="number"
            min="0"
            step="0.01"
            value={cardForm.limit_total}
            onChange={(event) => setCardForm((prev) => ({ ...prev, limit_total: event.target.value }))}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Dia de fechamento"
              type="number"
              min="1"
              max="31"
              value={cardForm.closing_day}
              onChange={(event) => setCardForm((prev) => ({ ...prev, closing_day: event.target.value }))}
              required
            />
            <Input
              label="Dia de vencimento"
              type="number"
              min="1"
              max="31"
              value={cardForm.due_day}
              onChange={(event) => setCardForm((prev) => ({ ...prev, due_day: event.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Cor"
              type="color"
              value={cardForm.color}
              onChange={(event) => setCardForm((prev) => ({ ...prev, color: event.target.value }))}
            />
            <Select
              label="Status"
              value={cardForm.is_active}
              onChange={(event) => setCardForm((prev) => ({ ...prev, is_active: event.target.value }))}
              options={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
            />
          </div>

          <ModalActionFooter
            onCancel={closeCardModal}
            submitLabel={editingCard ? 'Salvar alterações' : 'Salvar cartão'}
          />
        </form>
      </Modal>

      <Modal
        isOpen={isCycleModalOpen}
        onClose={closeCycleModal}
        title={`Ajustar fechamento e vencimento (${currentMonth})`}
      >
        <form onSubmit={handleSubmitCycle} className="w-full max-w-md mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Fechamento do mês"
              type="number"
              min="1"
              max="31"
              value={cycleForm.closing_day}
              onChange={(event) => setCycleForm((previous) => ({ ...previous, closing_day: event.target.value }))}
              required
            />
            <Input
              label="Vencimento do mês"
              type="number"
              min="1"
              max="31"
              value={cycleForm.due_day}
              onChange={(event) => setCycleForm((previous) => ({ ...previous, due_day: event.target.value }))}
              required
            />
          </div>

          <p className="text-xs text-secondary">
            Este ajuste vale apenas para a competência {currentMonth}.
          </p>

          <ModalActionFooter onCancel={closeCycleModal} submitLabel="Salvar ajuste" />

          <Button type="button" variant="outline" fullWidth onClick={handleResetCycleToCardDefault}>
            Usar padrão do cartão neste mês
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={isExpenseEditModalOpen}
        onClose={closeExpenseEditModal}
        title="Editar despesa"
      >
        <form onSubmit={handleSubmitEditExpense} className="w-full max-w-md mx-auto space-y-4">
          <Input
            label="Valor"
            type="text"
            inputMode="decimal"
            value={expenseEditForm.amount}
            onChange={(event) => handleExpenseAmountChange(event.target.value)}
            onBlur={() => {
              const parsed = parseMoneyInput(expenseEditForm.amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                handleExpenseAmountChange(formatMoneyInput(parsed))
              }
            }}
            placeholder="0,00"
            required
          />

          <Input
            label="Valor no relatório (opcional)"
            type="text"
            inputMode="decimal"
            value={expenseEditForm.report_amount}
            onChange={(event) => setExpenseEditForm((previous) => ({ ...previous, report_amount: event.target.value }))}
            onBlur={() => {
              if (!expenseEditForm.report_amount) return
              const parsed = parseMoneyInput(expenseEditForm.report_amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                setExpenseEditForm((previous) => ({ ...previous, report_amount: formatMoneyInput(parsed) }))
              }
            }}
            placeholder="Se vazio, usa o valor total"
          />

          <Input
            label="Data"
            type="date"
            value={expenseEditForm.date}
            onChange={(event) => setExpenseEditForm((previous) => ({ ...previous, date: event.target.value }))}
            min={APP_START_DATE}
            required
          />

          <Select
            label="Forma de pagamento"
            value={expenseEditForm.payment_method}
            onChange={(event) => setExpenseEditForm((previous) => ({
              ...previous,
              payment_method: event.target.value,
              credit_card_id: event.target.value === 'credit_card' ? previous.credit_card_id : '',
            }))}
            options={[
              { value: 'other', label: 'Outros' },
              { value: 'cash', label: 'Dinheiro' },
              { value: 'debit', label: 'Débito' },
              { value: 'credit_card', label: 'Cartão de crédito' },
              { value: 'pix', label: 'PIX' },
              { value: 'transfer', label: 'Transferência' },
            ]}
          />

          {expenseEditForm.payment_method === 'credit_card' && (
            <Select
              label="Cartão"
              value={expenseEditForm.credit_card_id}
              onChange={(event) => setExpenseEditForm((previous) => ({ ...previous, credit_card_id: event.target.value }))}
              options={[
                { value: '', label: 'Selecionar cartão' },
                ...creditCards
                  .filter((card) => card.is_active !== false || card.id === expenseEditForm.credit_card_id)
                  .map((card) => ({ value: card.id, label: card.name })),
              ]}
              required
            />
          )}

          {editingExpenseItem && Number(editingExpenseItem.installment_total || 1) > 1 && (
            <p className="text-xs text-secondary">
              Esta despesa pertence ao parcelamento {editingExpenseItem.installment_number || 1}/{editingExpenseItem.installment_total}. A edição afeta apenas esta parcela.
            </p>
          )}

          <Select
            label="Categoria"
            value={expenseEditForm.category_id}
            onChange={(event) => setExpenseEditForm((previous) => ({ ...previous, category_id: event.target.value }))}
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />

          <Input
            label="Descrição (opcional)"
            value={expenseEditForm.description}
            onChange={(event) => setExpenseEditForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="Ex: Almoço, Uber..."
          />

          <ModalActionFooter
            onCancel={closeExpenseEditModal}
            submitLabel="Salvar alterações"
            submitDisabled={!expenseEditForm.category_id}
            deleteLabel="Excluir despesa"
            onDelete={handleDeleteExpense}
          />
        </form>
      </Modal>

      <Modal
        isOpen={isPaymentEditModalOpen}
        onClose={closePaymentEditModal}
        title="Editar pagamento"
      >
        <form onSubmit={handleSubmitEditPayment} className="w-full max-w-md mx-auto space-y-4">
          <Input
            label="Valor pago"
            type="number"
            min="0.01"
            step="0.01"
            value={paymentEditAmount}
            onChange={(event) => setPaymentEditAmount(event.target.value)}
            required
          />

          <Input
            label="Data do pagamento"
            type="date"
            value={paymentEditDate}
            onChange={(event) => setPaymentEditDate(event.target.value)}
            required
          />

          <Input
            label="Observação (opcional)"
            value={paymentEditNote}
            onChange={(event) => setPaymentEditNote(event.target.value)}
          />

          <ModalActionFooter
            onCancel={closePaymentEditModal}
            submitLabel="Salvar pagamento"
            deleteLabel="Excluir pagamento"
            onDelete={handleDeletePayment}
          />
        </form>
      </Modal>

      <Modal
        isOpen={isRefundIncomeEditModalOpen}
        onClose={closeRefundIncomeEditModal}
        title="Editar estorno (renda)"
      >
        <form onSubmit={handleSubmitEditRefundIncome} className="w-full max-w-md mx-auto space-y-4">
          <Input
            label="Valor"
            type="text"
            inputMode="decimal"
            value={refundIncomeEditForm.amount}
            onChange={(event) => handleRefundIncomeAmountChange(event.target.value)}
            onBlur={() => {
              const parsed = parseMoneyInput(refundIncomeEditForm.amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                handleRefundIncomeAmountChange(formatMoneyInput(parsed))
              }
            }}
            placeholder="0,00"
            required
          />

          <Input
            label="Valor no relatório (opcional)"
            type="text"
            inputMode="decimal"
            value={refundIncomeEditForm.report_amount}
            onChange={(event) => setRefundIncomeEditForm((previous) => ({ ...previous, report_amount: event.target.value }))}
            onBlur={() => {
              if (!refundIncomeEditForm.report_amount) return
              const parsed = parseMoneyInput(refundIncomeEditForm.report_amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                setRefundIncomeEditForm((previous) => ({ ...previous, report_amount: formatMoneyInput(parsed) }))
              }
            }}
            placeholder="Se vazio, usa o valor total"
          />

          <Input
            label="Data"
            type="date"
            value={refundIncomeEditForm.date}
            onChange={(event) => setRefundIncomeEditForm((previous) => ({ ...previous, date: event.target.value }))}
            min={APP_START_DATE}
            required
          />

          <Select
            label="Categoria de Renda"
            value={refundIncomeEditForm.income_category_id}
            onChange={(event) => setRefundIncomeEditForm((previous) => ({ ...previous, income_category_id: event.target.value }))}
            options={incomeCategories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            required
          />

          <Input
            label="Descrição (opcional)"
            value={refundIncomeEditForm.description}
            onChange={(event) => setRefundIncomeEditForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="Ex: Estorno compra loja X"
          />

          <ModalActionFooter
            onCancel={closeRefundIncomeEditModal}
            submitLabel="Salvar alterações"
            deleteLabel="Excluir estorno"
            onDelete={handleDeleteRefundIncome}
          />
        </form>
      </Modal>
    </div>
  )
}
