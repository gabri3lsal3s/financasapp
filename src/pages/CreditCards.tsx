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
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { supabase } from '@/lib/supabase'
import type { CreditCard } from '@/types'
import { APP_START_DATE, APP_START_MONTH, formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
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
import { hasExplicitCreditCardsDeepLink, resolveInitialCreditCardsMonth, shiftMonth } from '@/utils/creditCardMonthSelection'
import { Calendar, FileUp, Pencil, Plus, Wallet, Undo2, Check, Scale, CheckCircle2, AlertCircle, Clock, Lock, CreditCard as CreditCardIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { buildRefundNote, parseRefundNote } from '@/pages/creditCards/refundNote'

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

type PaymentItem = BillPaymentDisplayItem

type BillDataSnapshot = {
  expensesByCard: Record<string, number>
  paymentsByCard: Record<string, number>
  baseExpensesByCard: Record<string, number>
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

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'

const DEFAULT_FORM: CardFormState = {
  name: '',
  brand: '',
  limit_total: '',
  closing_day: '8',
  due_day: '15',
  color: '#3b82f6',
  is_active: 'true',
}

function formatDateBR(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getSafeDate(year: number, month: number, day: number) {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  const clampedDay = Math.min(day, lastDayOfMonth)
  return new Date(year, month, clampedDay)
}

interface CreditCardTimelineProps {
  card: CreditCard
  currentMonth: string
  totalPrevisto: number
  saldoAberto: number
  monthlyCycle: MonthlyCycleRow | undefined
}

function CreditCardTimeline({
  card,
  currentMonth,
  totalPrevisto,
  saldoAberto,
  monthlyCycle,
}: CreditCardTimelineProps) {
  const [yearStr, monthStr] = currentMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // 0-based for JS Date

  const effectiveClosingDay = monthlyCycle?.closing_day || card.closing_day
  const effectiveDueDay = monthlyCycle?.due_day || card.due_day

  const dueDate = getSafeDate(year, month, effectiveDueDay)

  let closingDate = getSafeDate(year, month, effectiveClosingDay)
  let startDate = getSafeDate(year, month - 1, effectiveClosingDay + 1)

  if (effectiveClosingDay >= effectiveDueDay) {
    closingDate = getSafeDate(year, month - 1, effectiveClosingDay)
    startDate = getSafeDate(year, month - 2, effectiveClosingDay + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let status: 'paid' | 'empty' | 'overdue' | 'near_due' | 'closed' | 'open' = 'open'

  if (totalPrevisto <= 0.009) {
    status = 'empty'
  } else if (saldoAberto <= 0.009) {
    status = 'paid'
  } else if (today.getTime() > dueDate.getTime()) {
    status = 'overdue'
  } else {
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays <= 3) {
      status = 'near_due'
    } else if (today.getTime() < closingDate.getTime()) {
      status = 'open'
    } else {
      status = 'closed'
    }
  }

  const themeColor = card.color || '#3b82f6'

  // Semantic/dynamic color mapping based on status
  const statusColor = {
    paid: '#10b981',
    empty: '#6b7280',
    overdue: '#ef4444',
    near_due: '#f59e0b',
    closed: themeColor,
    open: themeColor,
  }[status]

  const config = {
    paid: {
      label: 'Paga',
      icon: <CheckCircle2 size={13} className="text-emerald-500" />,
      message: 'Fatura totalmente paga! Limite restabelecido.',
    },
    empty: {
      label: 'Fatura Zerada',
      icon: <CreditCardIcon size={13} className="text-secondary" />,
      message: 'Nenhum lançamento registrado nesta competência.',
    },
    overdue: {
      label: 'Vencida',
      icon: <AlertCircle size={13} className="text-red-500" />,
      message: `ATENÇÃO: Fatura vencida em ${formatDateBR(dueDate)}. Regularize para evitar juros.`,
    },
    near_due: {
      label: 'Vence em Breve',
      icon: <Clock size={13} className="text-amber-500" />,
      message: `Atenção: Fatura fecha dia ${formatDateBR(closingDate)} e vence dia ${formatDateBR(dueDate)}. Pague logo!`,
    },
    closed: {
      label: 'Fechada',
      icon: <Lock size={13} style={{ color: themeColor }} />,
      message: `Fatura fechada em ${formatDateBR(closingDate)}. Aguardando pagamento até ${formatDateBR(dueDate)}.`,
    },
    open: {
      label: 'Em Aberto',
      icon: <CreditCardIcon size={13} style={{ color: themeColor }} />,
      message: `Fatura aberta para compras. Fechamento previsto em ${formatDateBR(closingDate)}.`,
    },
  }[status]

  let progressPct = 0
  if (status === 'paid') {
    progressPct = 100
  } else if (status === 'empty') {
    progressPct = 0
  } else {
    const tTime = today.getTime()
    const sTime = startDate.getTime()
    const cTime = closingDate.getTime()
    const dTime = dueDate.getTime()

    if (tTime <= sTime) {
      progressPct = 0
    } else if (tTime >= dTime) {
      progressPct = 100
    } else if (tTime < cTime) {
      const range = cTime - sTime
      const pct = range > 0 ? (tTime - sTime) / range : 0
      progressPct = Math.min(50, Math.max(0, pct * 50))
    } else {
      const range = dTime - cTime
      const pct = range > 0 ? (tTime - cTime) / range : 0
      progressPct = Math.min(100, Math.max(50, 50 + pct * 50))
    }
  }

  // Dynamic styling based on status color and card theme color
  const badgeStyle = {
    backgroundColor: `${statusColor}12`,
    borderColor: `${statusColor}28`,
    color: statusColor,
  }

  const containerHoverStyle = {
    '--timeline-border-hover': `${themeColor}22`,
  } as React.CSSProperties

  const barStyle = {
    width: `${progressPct}%`,
    backgroundColor: themeColor,
  }

  const nodeRingStyle = {
    backgroundColor: themeColor,
    boxShadow: `0 0 0 4px ${themeColor}28`,
    borderColor: '#ffffff',
  }

  const bannerStyle = {
    backgroundColor: `${statusColor}08`,
    borderColor: `${statusColor}18`,
  }

  return (
    <div
      className="bg-gradient-to-r from-card/50 via-background/40 to-card/50 border border-border/40 rounded-xl p-4.5 space-y-4 shadow-sm text-left transition-all duration-300 hover:border-[var(--timeline-border-hover)] animate-page-enter"
      style={containerHoverStyle}
    >
      {/* Top Header */}
      <div className="flex justify-end">
        {/* State Badge with dynamic colors */}
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all duration-300"
          style={badgeStyle}
        >
          {config.icon}
          {config.label}
        </span>
      </div>

      {/* 1. Desktop & Tablet Layout (Horizontal Timeline) */}
      <div className="hidden sm:block relative pt-4 pb-12 px-10">
        <div className="h-1.5 w-full bg-muted/20 dark:bg-muted/10 rounded-full relative">
          {/* Progress fill using Card Theme Color */}
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={barStyle}
          />

          {/* ================= NODES CIRCLES (Only circles centered on line) ================= */}
          {/* Node 1 Circle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-card flex items-center justify-center transition-all duration-500 z-10"
            style={progressPct >= 0 ? nodeRingStyle : undefined}
          />

          {/* Node 2 Circle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 z-10 ${
              progressPct >= 50
                ? 'border-card'
                : 'border-border/60 bg-background'
            }`}
            style={progressPct >= 50 ? nodeRingStyle : undefined}
          />

          {/* Node 3 Circle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 z-10 ${
              progressPct >= 100
                ? 'border-card'
                : 'border-border/60 bg-background'
            }`}
            style={progressPct >= 100 ? nodeRingStyle : undefined}
          />

          {/* ================= NODES TEXT LABELS & DATES (Positioned below line) ================= */}
          {/* Node 1 Text */}
          <div className="absolute top-4 left-0 -translate-x-1/2 flex flex-col items-center w-24 text-center">
            <span className="text-[10px] font-bold text-primary font-mono whitespace-nowrap">
              Início
            </span>
            <span className="text-[9px] text-secondary font-medium font-sans mt-0.5">
              {formatDateBR(startDate)}
            </span>
          </div>

          {/* Node 2 Text */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center w-24 text-center">
            <span className="text-[10px] font-bold text-primary font-mono whitespace-nowrap">
              Fechamento
            </span>
            <span className="text-[9px] text-secondary font-medium font-sans mt-0.5">
              {formatDateBR(closingDate)}
            </span>
          </div>

          {/* Node 3 Text */}
          <div className="absolute top-4 left-full -translate-x-1/2 flex flex-col items-center w-24 text-center">
            <span className="text-[10px] font-bold text-primary font-mono whitespace-nowrap">
              Vencimento
            </span>
            <span className="text-[9px] text-secondary font-medium font-sans mt-0.5">
              {formatDateBR(dueDate)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Mobile Layout (Creative Centered Vertical Timeline) */}
      <div className="block sm:hidden space-y-3 pt-2 pb-2">
        {/* Step 1: Início */}
        <div className="flex flex-col items-center text-center space-y-1.5 animate-page-enter">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-card flex items-center justify-center transition-all duration-500 shrink-0"
            style={progressPct >= 0 ? nodeRingStyle : undefined}
          />
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[11px] font-extrabold text-primary font-mono">Início do Ciclo</span>
              <span className="text-[10px] text-secondary font-bold font-mono">({formatDateBR(startDate)})</span>
            </div>
            <p className="text-[10px] text-secondary max-w-[240px] mt-0.5 leading-normal">Compras começam a contar nesta fatura.</p>
          </div>
        </div>

        {/* Connector 1 */}
        <div
          className="w-0.5 h-6 mx-auto transition-all duration-500 rounded-full"
          style={{
            background: progressPct >= 50
              ? themeColor
              : `linear-gradient(to bottom, ${themeColor} ${(progressPct / 50) * 100}%, rgba(100,100,100,0.15) ${(progressPct / 50) * 100}%)`
          }}
        />

        {/* Step 2: Fechamento */}
        <div className="flex flex-col items-center text-center space-y-1.5 animate-page-enter">
          <div
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 shrink-0 ${
              progressPct >= 50
                ? 'border-card'
                : 'border-border/60 bg-background'
            }`}
            style={progressPct >= 50 ? nodeRingStyle : undefined}
          />
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[11px] font-extrabold text-primary font-mono">Fechamento</span>
              <span className="text-[10px] text-secondary font-bold font-mono">({formatDateBR(closingDate)})</span>
            </div>
            <p className="text-[10px] text-secondary max-w-[240px] mt-0.5 leading-normal">Fatura encerrada para compras.</p>
          </div>
        </div>

        {/* Connector 2 */}
        <div
          className="w-0.5 h-6 mx-auto transition-all duration-500 rounded-full"
          style={{
            background: progressPct >= 100
              ? themeColor
              : progressPct >= 50
              ? `linear-gradient(to bottom, ${themeColor} ${((progressPct - 50) / 50) * 100}%, rgba(100,100,100,0.15) ${((progressPct - 50) / 50) * 100}%)`
              : 'rgba(100,100,100,0.15)'
          }}
        />

        {/* Step 3: Vencimento */}
        <div className="flex flex-col items-center text-center space-y-1.5 animate-page-enter">
          <div
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 shrink-0 ${
              progressPct >= 100
                ? 'border-card'
                : 'border-border/60 bg-background'
            }`}
            style={progressPct >= 100 ? nodeRingStyle : undefined}
          />
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[11px] font-extrabold text-primary font-mono">Vencimento</span>
              <span className="text-[10px] text-secondary font-bold font-mono">({formatDateBR(dueDate)})</span>
            </div>
            <p className="text-[10px] text-secondary max-w-[240px] mt-0.5 leading-normal">Data limite de pagamento sem encargos.</p>
          </div>
        </div>
      </div>

      {/* Dynamic Insight Banner */}
      <div
        className="flex gap-2 p-2.5 rounded-lg text-[10px] text-secondary font-sans border transition-all duration-300 leading-relaxed items-center"
        style={bannerStyle}
      >
        <span className="shrink-0">{config.icon}</span>
        <span>{config.message}</span>
      </div>
    </div>
  )
}

export default function CreditCards() {
  const [searchParams] = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const swipeHandlers = useSwipeMonth(currentMonth, setCurrentMonth)
  const [hasResolvedInitialMonth, setHasResolvedInitialMonth] = useState(false)
  const [loadingBills, setLoadingBills] = useState(true)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentCardId, setPaymentCardId] = useState<string>('')
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const [isPaymentEditModalOpen, setIsPaymentEditModalOpen] = useState(false)
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
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
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [migrationTargetCardId, setMigrationTargetCardId] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)

  const [expensesByCard, setExpensesByCard] = useState<Record<string, number>>({})
  const [paymentsByCard, setPaymentsByCard] = useState<Record<string, number>>({})
  const [baseExpensesByCard, setBaseExpensesByCard] = useState<Record<string, number>>({})
  const [billItemsByCard, setBillItemsByCard] = useState<Record<string, BillExpenseItem[]>>({})
  const [paymentItemsByCard, setPaymentItemsByCard] = useState<Record<string, PaymentItem[]>>({})
  const [monthlyCyclesByCard, setMonthlyCyclesByCard] = useState<Record<string, MonthlyCycleRow>>({})

  const {
    creditCards,
    loading,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
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

  const handleStartDelete = () => {
    setDeleteStep(1)
    setMigrationTargetCardId('')
    setIsDeleteConfirmModalOpen(true)
  }

  const handleCancelDelete = () => {
    setIsDeleteConfirmModalOpen(false)
    setDeleteStep(1)
    setMigrationTargetCardId('')
  }

  const handleConfirmDelete = async () => {
    if (!editingCard) return

    try {
      setIsDeleting(true)

      // Step 1: Check for expenses if we are still in step 1
      if (deleteStep === 1) {
        const { count, error: countError } = await supabase
          .from('expenses')
          .select('*', { count: 'exact', head: true })
          .eq('credit_card_id', editingCard.id)

        if (countError) throw countError

        if (count && count > 0) {
          setDeleteStep(2)
          return
        }
      }

      // Step 2 or no expenses: execute deletion
      if (migrationTargetCardId) {
        // Migrate expenses
        const { error: migrationError } = await supabase
          .from('expenses')
          .update({ credit_card_id: migrationTargetCardId })
          .eq('credit_card_id', editingCard.id)

        if (migrationError) throw migrationError
      } else {
        // Unbind expenses
        const { error: unbindError } = await supabase
          .from('expenses')
          .update({ credit_card_id: null, payment_method: 'other' })
          .eq('credit_card_id', editingCard.id)

        if (unbindError) throw unbindError
      }

      // Cleanup related tables
      await Promise.all([
        supabase.from('credit_card_bill_payments').delete().eq('credit_card_id', editingCard.id),
        supabase.from('credit_card_monthly_cycles').delete().eq('credit_card_id', editingCard.id),
      ])

      // Delete the card
      const { error: deleteError } = await deleteCreditCard(editingCard.id)
      if (deleteError) throw new Error(deleteError)

      handleCancelDelete()
      closeCardModal()
      await refreshCreditCards()
      await loadBillData()
    } catch (err) {
      alert(`Erro ao excluir cartão: ${err instanceof Error ? err.message : 'Ocorreu um erro inesperado'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const openPaymentModal = (cardId: string) => {
    setPaymentCardId(cardId)
    setPaymentAmount('')
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setPaymentNote('')
    setIsPaymentModalOpen(true)
  }

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false)
    setPaymentCardId('')
    setPaymentAmount('')
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setPaymentNote('')
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

  const openRefundModal = (cardId: string) => {
    setRefundCardId(cardId)
    setRefundAmount('')
    setRefundDate(format(new Date(), 'yyyy-MM-dd'))
    setRefundDescription('')
    setIsRefundModalOpen(true)
  }

  const closeRefundModal = () => {
    setIsRefundModalOpen(false)
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

    // Pós-processamento para garantir que estornos (registrados na tabela de pagamentos)
    // reduzam o valor previsto da fatura em vez de aumentar o "total pago".
    Object.entries(paymentsByCardItems).forEach(([cardId, items]) => {
      let refundTotal = 0
      items.forEach(item => {
        const { isRefund } = parseRefundNote(item.note)
        // Um estorno pode vir como valor positivo ou negativo no banco/app, 
        // mas aqui queremos o valor absoluto para subtrair dos totais.
        if (isRefund || item.amount < 0) {
          refundTotal += Math.abs(item.amount)
        }
      })
      totalRefundByCard[cardId] = Number(refundTotal.toFixed(2))
    })

    const finalExpensesByCard: Record<string, number> = {}
    const finalPaymentsByCard: Record<string, number> = {}
    const finalBaseExpensesByCard: Record<string, number> = {}

    Object.keys(summarizedBill.expensesByCard).forEach(cardId => {
      const refundAmt = totalRefundByCard[cardId] || 0
      
      // O Previsto deve ser o líquido (Gastos - Estornos)
      finalExpensesByCard[cardId] = Number((summarizedBill.expensesByCard[cardId] - refundAmt).toFixed(2))
      
      // O Pago deve conter apenas pagamentos REAIS.
      // Como o summarizedBill.paymentsByCard incluiu todos os registros da tabela de pagamentos 
      // (incluindo estornos registrados como pagamentos de ajuste), precisamos SUBTRAIR o refundAmt 
      // para isolar apenas o que foi pagamento de fatura real.
      finalPaymentsByCard[cardId] = Number((summarizedBill.paymentsByCard[cardId] - refundAmt).toFixed(2))
      
      // Calcular base total (sem pesos)
      const cardExpenses = summarizedBill.billItemsByCard[cardId] || []
      const baseTotal = cardExpenses.reduce((sum, item) => sum + (item.base_amount || 0), 0)
      finalBaseExpensesByCard[cardId] = Number((baseTotal - refundAmt).toFixed(2))
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
      setBaseExpensesByCard(snapshot.baseExpensesByCard)
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

    closePaymentModal()
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

    closeRefundModal()
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
    <div className="animate-page-enter min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
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
              className="hidden sm:inline-flex items-center gap-2 font-bold"
            >
              <Scale size={16} />
              <span>
                {creditCardsWeightsEnabled ? 'Desconsiderar pesos' : 'Considerar pesos'}
              </span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={openCreateCardModal}
              className="flex items-center gap-2 font-bold"
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
          <Loader text="Carregando cartões e faturas..." className="py-8" />
        ) : (
          <div key={currentMonth} className="animate-month-change">
            {activeCards.length === 0 ? (
              <Card className="text-center py-8 space-y-3">
                <p className="text-secondary">Nenhum cartão ativo cadastrado.</p>
                <div className="flex justify-center">
                  <Button onClick={openCreateCardModal}>Cadastrar primeiro cartão</Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
            {activeCards.map((card, index) => {
              const totalPrevisto = Number(expensesByCard[card.id] || 0)
              const totalPago = Number(paymentsByCard[card.id] || 0)
              const saldoAberto = Number((totalPrevisto - totalPago).toFixed(2))
              const billItems = billItemsByCard[card.id] || []
              const monthlyCycle = monthlyCyclesByCard[card.id]
              const effectiveClosingDay = monthlyCycle?.closing_day || card.closing_day
              const effectiveDueDay = monthlyCycle?.due_day || card.due_day
              const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
              const staggerClass = index < 5 ? staggerClasses[index] : ''

              return (
                <div key={card.id} id={`credit-card-${card.id}`} className={`animate-stagger-item ${staggerClass}`}>
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
                          icon={<Undo2 size={16} />}
                          onClick={() => openRefundModal(card.id)}
                          label="Registrar estorno"
                          title="Registrar estorno"
                        />
                        <IconButton
                          size="sm"
                          icon={<Wallet size={16} />}
                          onClick={() => openPaymentModal(card.id)}
                          label="Registrar pagamento"
                          title="Registrar pagamento"
                        />
                        <IconButton
                          size="sm"
                          icon={<FileUp size={16} />}
                          onClick={() => setReconciliationCardId(card.id)}
                          label="Anexar CSV"
                          title="Anexar CSV"
                        />
                      </div>
                    </div>

                    {/* Linha do Tempo Dinâmica da Fatura (Estilo Consultoria) */}
                    <CreditCardTimeline
                      card={card}
                      currentMonth={currentMonth}
                      totalPrevisto={totalPrevisto}
                      saldoAberto={saldoAberto}
                      monthlyCycle={monthlyCycle}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-primary bg-secondary p-3">
                        <p className="text-xs text-secondary">Total previsto</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-base font-semibold text-primary">{formatCurrency(totalPrevisto)}</p>
                          {baseExpensesByCard[card.id] !== undefined && baseExpensesByCard[card.id] !== totalPrevisto && (
                            <p className="text-[10px] text-secondary opacity-70" title="Valor base sem pesos">
                              ({formatCurrency(baseExpensesByCard[card.id])})
                            </p>
                          )}
                        </div>
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
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-primary truncate">
                                        {item.description || (isRefund ? 'Estorno' : item.category_name || 'Despesa')}
                                      </p>
                                      {(item as any).competence_source === 'manual' && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-[9px] text-primary font-medium flex items-center gap-0.5" title="Definido manualmente">
                                          <Check size={8} /> Fatura fixa
                                        </span>
                                      )}
                                    </div>
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
            submitDisabled={loading}
            onDelete={editingCard ? handleStartDelete : undefined}
            deleteLabel="Excluir cartão"
          />
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteConfirmModalOpen}
        onClose={handleCancelDelete}
        title={deleteStep === 1 ? 'Excluir cartão' : 'Migrar despesas'}
      >
        <div className="space-y-4">
          {deleteStep === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-primary">
                Deseja realmente excluir o cartão <strong>{editingCard?.name}</strong>?
              </p>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs leading-relaxed">
                <p className="font-semibold mb-1">Aviso:</p>
                <p>Esta ação é irreversível e removerá permanentemente o histórico de faturas e pagamentos deste cartão.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-secondary">
                Existem despesas vinculadas a este cartão. O que deseja fazer?
              </p>
              <div className="space-y-2">
                <label className="text-xs font-medium text-secondary ml-1">Migrar despesas para:</label>
                <Select
                  value={migrationTargetCardId}
                  onChange={(e) => setMigrationTargetCardId(e.target.value)}
                  options={[
                    { value: '', label: 'Apenas desvincular (método \'Outro\')' },
                    ...creditCards
                      .filter((c) => c.id !== editingCard?.id && c.is_active !== false)
                      .map((c) => ({ value: c.id, label: c.name }))
                  ]}
                  className="w-full"
                />
              </div>
              {migrationTargetCardId === '' && (
                <p className="text-xs text-secondary italic">* As despesas se tornarão avulsas e não pertencerão a nenhuma fatura.</p>
              )}
            </div>
          )}

          <div className="flex pt-4 justify-center items-center gap-4">
            <Button type="button" variant="outline" onClick={handleCancelDelete} className="w-full" disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={deleteStep === 1 ? 'primary' : 'danger'}
              onClick={handleConfirmDelete}
              className="w-full"
              disabled={isDeleting}
            >
              {isDeleting ? 'Processando...' : deleteStep === 1 ? 'Próximo' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </div>
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

      <Modal
        isOpen={isRefundModalOpen}
        onClose={closeRefundModal}
        title={`Registrar estorno (${currentMonth})`}
      >
        <form onSubmit={(event) => handleSubmitRefund(event, refundCardId)} className="w-full max-w-md mx-auto space-y-4">
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

          <Input
            label="Descrição (opcional)"
            value={refundDescription}
            onChange={(event) => setRefundDescription(event.target.value)}
            placeholder="Ex: Estorno compra loja X"
          />

          <p className="text-xs text-secondary">Categoria padrão: Estorno • Valor no relatório: igual ao valor do estorno.</p>

          <ModalActionFooter onCancel={closeRefundModal} submitLabel="Confirmar estorno" />
        </form>
      </Modal>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        title={`Registrar pagamento (${currentMonth})`}
      >
        <form onSubmit={handleSubmitPayment} className="w-full max-w-md mx-auto space-y-4">
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

          <Input
            label="Observação (opcional)"
            value={paymentNote}
            onChange={(event) => setPaymentNote(event.target.value)}
            placeholder="Observações adicionais..."
          />

          <ModalActionFooter onCancel={closePaymentModal} submitLabel="Confirmar pagamento" />
        </form>
      </Modal>

      <Modal
        isOpen={!!reconciliationCardId}
        onClose={() => setReconciliationCardId('')}
        title={`Conciliação de Fatura (${currentMonth})`}
        maxWidth="max-w-4xl"
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
    </div>
  )
}
