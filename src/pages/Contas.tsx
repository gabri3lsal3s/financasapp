import { useEffect, useMemo, useState } from 'react'
import { endOfMonth, format, subMonths } from 'date-fns'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import KpiCard from '@/components/KpiCard'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Input from '@/components/Input'
import Modal from '@/components/Modal'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ConfirmModal from '@/components/ConfirmModal'
import Select from '@/components/Select'
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
import { APP_START_DATE, formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput, roundToDecimals, formatMonth } from '@/utils/format'
import { CREDIT_CARD_DEFAULT_COLOR, ensureHexColor } from '@/utils/colorValue'
import BillExpenseRowButton from '@/components/creditCards/BillExpenseRowButton'
import CardColorField from '@/components/creditCards/CardColorField'
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
import { Calendar, FileUp, Pencil, Plus, Wallet, Undo2, Scale, CheckCircle2, AlertCircle, Clock, Lock, CreditCard as CreditCardIcon, ChevronDown, ChevronUp, Check, Trash2, TrendingUp, TrendingDown, Link2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { buildRefundNote, parseRefundNote } from '@/pages/creditCards/refundNote'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import GlassChoiceCard from '@/components/GlassChoiceCard'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import ModalIntro from '@/components/ModalIntro'

type CardFormState = {
  name: string
  brand: string
  limit_total: string
  closing_day: string
  due_day: string
  color: string
  is_active: string
}

type DebtFormState = {
  name: string
  type: 'payable' | 'receivable'
  amount: string
  due_date: string
  description: string
  status: 'pending' | 'paid'
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

const DEFAULT_DEBT_FORM = (): DebtFormState => ({
  name: '',
  type: 'payable',
  amount: '',
  due_date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  status: 'pending',
})

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'

const DEFAULT_FORM: CardFormState = {
  name: '',
  brand: '',
  limit_total: '',
  closing_day: '8',
  due_day: '15',
  color: CREDIT_CARD_DEFAULT_COLOR,
  is_active: 'true',
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
  totalPago: number
  saldoAberto: number
  monthlyCycle: MonthlyCycleRow | undefined
  baseExpense?: number
}

function CreditCardTimeline({
  card,
  currentMonth,
  totalPrevisto,
  totalPago,
  saldoAberto,
  monthlyCycle,
  baseExpense,
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

  const themeColor = card.color ? ensureHexColor(card.color) : 'var(--credit-card-default-color)'

  const statusBadgeClass: Record<typeof status, string> = {
    paid: 'bg-income/10 border-income/30 text-income',
    empty: 'bg-secondary border-primary text-secondary',
    overdue: 'bg-expense/10 border-expense/30 text-expense',
    near_due: 'bg-warning/10 border-warning/30 text-warning',
    closed: '',
    open: '',
  }

  const usesThemeAccent = status === 'closed' || status === 'open'
  const themeAccentStyle = usesThemeAccent
    ? {
        backgroundColor: `color-mix(in srgb, ${themeColor} 7%, transparent)`,
        borderColor: `color-mix(in srgb, ${themeColor} 16%, transparent)`,
        color: themeColor,
      }
    : undefined

  const statusBannerClass: Record<typeof status, string> = {
    paid: 'bg-income/5 border-income/20',
    empty: 'bg-secondary/50 border-primary/30',
    overdue: 'bg-expense/5 border-expense/20',
    near_due: 'bg-warning/5 border-warning/20',
    closed: '',
    open: '',
  }

  const themeBannerStyle = usesThemeAccent
    ? {
        backgroundColor: `color-mix(in srgb, ${themeColor} 5%, transparent)`,
        borderColor: `color-mix(in srgb, ${themeColor} 10%, transparent)`,
      }
    : undefined

  const config = {
    paid: {
      label: 'Paga',
      icon: <CheckCircle2 size={13} className="text-income" />,
      message: 'Fatura totalmente paga! Limite restabelecido.',
    },
    empty: {
      label: 'Fatura Zerada',
      icon: <CreditCardIcon size={13} className="text-secondary" />,
      message: 'Nenhum lançamento registrado nesta competência.',
    },
    overdue: {
      label: 'Vencida',
      icon: <AlertCircle size={13} className="text-expense" />,
      message: `ATENÇÃO: Fatura vencida em ${formatDate(dueDate)}. Regularize para evitar juros.`,
    },
    near_due: {
      label: 'Vence em Breve',
      icon: <Clock size={13} className="text-warning" />,
      message: `Atenção: Fatura fecha dia ${formatDate(closingDate)} e vence dia ${formatDate(dueDate)}. Pague logo!`,
    },
    closed: {
      label: 'Fechada',
      icon: <Lock size={13} style={{ color: themeColor }} />,
      message: `Fatura fechada em ${formatDate(closingDate)}. Aguardando pagamento até ${formatDate(dueDate)}.`,
    },
    open: {
      label: 'Em Aberto',
      icon: <CreditCardIcon size={13} style={{ color: themeColor }} />,
      message: `Fatura aberta para compras. Fechamento previsto em ${formatDate(closingDate)}.`,
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

  const containerHoverStyle = {
    '--timeline-halo-color': themeColor,
  } as React.CSSProperties

  const barStyle = {
    width: `${progressPct}%`,
    backgroundColor: themeColor,
  }

  const nodeRingStyle = {
    backgroundColor: themeColor,
    boxShadow: `0 0 0 4px ${themeColor}28`,
    borderColor: 'var(--color-bg-primary)',
  }

  const timelineItems = [
    {
      title: 'Início do Ciclo',
      date: startDate,
      desc: 'Compras começam a contar.',
      metricLabel: 'Previsto',
      metricVal: totalPrevisto,
      extraMetric: baseExpense !== undefined && baseExpense !== totalPrevisto ? baseExpense : undefined,
      isActive: true,
      isLast: false,
    },
    {
      title: 'Fechamento',
      date: closingDate,
      desc: 'Fatura encerrada para compras.',
      metricLabel: 'Pago',
      metricVal: totalPago,
      isActive: progressPct >= 50,
      isLast: false,
    },
    {
      title: 'Vencimento',
      date: dueDate,
      desc: 'Vencimento da fatura.',
      metricLabel: 'Saldo',
      metricVal: saldoAberto,
      isActive: progressPct >= 100,
      isLast: true,
    },
  ]

  return (
    <div
      className="glass-timeline-card p-4 sm:p-5 space-y-4 text-left transition-all duration-300"
      style={containerHoverStyle}
    >
      <div className="flex justify-end">
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all duration-300 ${statusBadgeClass[status]}`}
          style={themeAccentStyle}
        >
          {config.icon}
          {config.label}
        </span>
      </div>

      <div className="hidden sm:block relative pt-20 pb-16 px-20">
        <div className="h-1.5 w-full bg-muted/20 dark:bg-muted/10 rounded-full relative">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={barStyle}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center transition-all duration-500 z-10"
            style={progressPct >= 0 ? nodeRingStyle : undefined}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all duration-500 z-10 ${
              progressPct >= 50
                ? 'border-card'
                : 'border-border/60 bg-background'
            }`}
            style={progressPct >= 50 ? nodeRingStyle : undefined}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all duration-500 z-10 ${
              progressPct >= 100
                ? 'border-card'
                : 'border-border/60 bg-background'
            }`}
            style={progressPct >= 100 ? nodeRingStyle : undefined}
          />

          <div className="absolute bottom-5 left-0 -translate-x-1/2 flex flex-col items-center w-36 text-center">
            <span className="text-xs font-extrabold text-primary font-sans leading-tight whitespace-nowrap">
              Início do Ciclo
            </span>
            <span className="text-[10px] text-secondary font-bold font-mono mt-0.5">
              ({formatDate(startDate)})
            </span>
            <p className="text-[9px] text-secondary mt-1 leading-normal max-w-[120px]">
              Compras começam a contar.
            </p>
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center w-36 text-center">
            <span className="text-xs font-extrabold text-primary font-sans leading-tight whitespace-nowrap">
              Fechamento
            </span>
            <span className="text-[10px] text-secondary font-bold font-mono mt-0.5">
              ({formatDate(closingDate)})
            </span>
            <p className="text-[9px] text-secondary mt-1 leading-normal max-w-[120px]">
              Fatura encerrada para compras.
            </p>
          </div>

          <div className="absolute bottom-5 left-full -translate-x-1/2 flex flex-col items-center w-36 text-center">
            <span className="text-xs font-extrabold text-primary font-sans leading-tight whitespace-nowrap">
              Vencimento
            </span>
            <span className="text-[10px] text-secondary font-bold font-mono mt-0.5">
              ({formatDate(dueDate)})
            </span>
            <p className="text-[9px] text-secondary mt-1 leading-normal max-w-[120px]">
              Vencimento da fatura.
            </p>
          </div>

          <div className="absolute top-5 left-0 -translate-x-1/2 flex flex-col items-center w-36 text-center select-none">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
              Previsto
            </span>
            <span className="text-sm font-extrabold text-primary font-mono mt-0.5 whitespace-nowrap">
              {formatCurrency(totalPrevisto)}
            </span>
            {baseExpense !== undefined && baseExpense !== totalPrevisto && (
              <span className="text-[9px] text-secondary opacity-70 font-sans" title="Valor base sem pesos">
                ({formatCurrency(baseExpense)})
              </span>
            )}
          </div>

          <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center w-36 text-center select-none">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
              Pago
            </span>
            <span className="text-sm font-extrabold text-income font-mono mt-0.5 whitespace-nowrap">
              {formatCurrency(totalPago)}
            </span>
          </div>

          <div className="absolute top-5 left-full -translate-x-1/2 flex flex-col items-center w-36 text-center select-none">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
              Saldo
            </span>
            <span className={`text-sm font-extrabold font-mono mt-0.5 whitespace-nowrap ${saldoAberto > 0.009 ? 'text-primary' : 'text-secondary'}`}>
              {formatCurrency(saldoAberto)}
            </span>
          </div>
        </div>
      </div>

      <div className="block sm:hidden relative pt-2 pb-2">
        <div className="space-y-0 text-left">
          {timelineItems.map((item, index) => {
            const isItemPaid = item.metricLabel === 'Pago'
            return (
              <div key={index} className="grid grid-cols-[24px_1fr] gap-x-4">
                {/* Left timeline line and dot */}
                <div className="flex flex-col items-center">
                  {/* Top connector line */}
                  <div 
                    className="w-0.5 h-3 shrink-0 transition-all duration-500" 
                    style={{ 
                      backgroundColor: index > 0 && timelineItems[index - 1].isActive 
                        ? themeColor 
                        : index > 0 
                          ? 'var(--color-border-muted)' 
                          : 'transparent' 
                    }} 
                  />
                  
                  {/* Dot */}
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 border-card z-10 shrink-0 transition-all duration-500"
                    style={item.isActive ? nodeRingStyle : { backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}
                  />

                  {/* Bottom connector line */}
                  <div 
                    className="w-0.5 flex-1 min-h-[24px] transition-all duration-500" 
                    style={{ 
                      backgroundColor: !item.isLast && item.isActive 
                        ? themeColor 
                        : !item.isLast 
                          ? 'var(--color-border-muted)' 
                          : 'transparent' 
                    }} 
                  />
                </div>

                {/* Right content */}
                <div className="pb-6">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-xs sm:text-sm font-extrabold text-primary leading-tight">{item.title}</span>
                    <span className="text-[10px] text-secondary font-bold font-mono">({formatDate(item.date)})</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-secondary leading-normal mt-0.5">{item.desc}</p>
                  
                  {/* Metric details */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] font-bold text-secondary uppercase tracking-wider">{item.metricLabel}:</span>
                    <span className={`text-xs font-extrabold font-mono ${isItemPaid ? 'text-income' : 'text-primary'}`}>
                      {formatCurrency(item.metricVal)}
                    </span>
                    {item.extraMetric !== undefined && (
                      <span className="text-[9px] text-secondary opacity-70 font-sans" title="Valor base sem pesos">
                        ({formatCurrency(item.extraMetric)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className={`flex gap-2 p-2.5 rounded-lg text-[10px] text-secondary font-sans border transition-all duration-300 leading-relaxed items-center ${statusBannerClass[status]}`}
        style={themeBannerStyle}
      >
        <span className="shrink-0">{config.icon}</span>
        <span>{config.message}</span>
      </div>
    </div>
  )
}

export default function Contas() {
  const [searchParams] = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const swipeHandlers = useSwipeMonth(currentMonth, setCurrentMonth)
  const [hasResolvedInitialMonth, setHasResolvedInitialMonth] = useState(false)
  const [loadingBills, setLoadingBills] = useState(true)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentNote, setPaymentNote] = useState('')
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

  // Modais e Estados de Dívidas
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [debtForm, setDebtForm] = useState<DebtFormState>(DEFAULT_DEBT_FORM())

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
      color: card.color || CREDIT_CARD_DEFAULT_COLOR,
      is_active: card.is_active === false ? 'false' : 'true',
    })
    setIsCardModalOpen(true)
  }

  const closeCardModal = () => {
    setIsCardModalOpen(false)
    setEditingCard(null)
    setCardForm(DEFAULT_FORM)
  }

  // Modais de Dívidas
  const openCreateDebtModal = () => {
    setEditingDebt(null)
    setDebtForm(DEFAULT_DEBT_FORM())
    setIsDebtModalOpen(true)
  }

  const openEditDebtModal = (debt: Debt) => {
    setEditingDebt(debt)
    setDebtForm({
      name: debt.name,
      type: debt.type,
      amount: String(debt.amount),
      due_date: debt.due_date,
      description: debt.description || '',
      status: debt.status,
    })
    setIsDebtModalOpen(true)
  }

  const closeDebtModal = () => {
    setIsDebtModalOpen(false)
    setEditingDebt(null)
    setDebtForm(DEFAULT_DEBT_FORM())
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

      if (migrationTargetCardId) {
        const { error: migrationError } = await supabase
          .from('expenses')
          .update({ credit_card_id: migrationTargetCardId })
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
    setExpenseEditForm({
      amount: formatMoneyInput(Math.abs(item.amount)),
      report_amount: item.report_weight !== undefined && item.report_weight !== null
        ? formatMoneyInput(roundToDecimals(Math.abs(item.amount) * item.report_weight, 2))
        : '',
      date: item.date,
      installment_total: '1',
      payment_method: item.payment_method || 'credit_card',
      credit_card_id: item.credit_card_id || '',
      category_id: item.category_id || '',
      description: item.description || '',
    })
    setIsExpenseEditModalOpen(true)
  }

  const closeExpenseEditModal = () => {
    setIsExpenseEditModalOpen(false)
    setEditingExpenseItem(null)
    setExpenseEditForm(DEFAULT_EXPENSE_FORM())
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
      setRefundIncomeEditForm({
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
    setRefundIncomeEditForm(DEFAULT_REFUND_INCOME_FORM())
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

  const handleSubmitEditRefundIncome = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingRefundPaymentItem || !editingRefundIncomeId) return

    const amountBase = parseMoneyInput(refundIncomeEditForm.amount)
    if (Number.isNaN(amountBase) || amountBase <= 0) {
      alert('Informe o valor base do estorno.')
      return
    }

    const reportAmount = refundIncomeEditForm.report_amount
      ? parseMoneyInput(refundIncomeEditForm.report_amount)
      : amountBase

    if (Number.isNaN(reportAmount) || reportAmount < 0 || reportAmount > amountBase) {
      alert('O valor no relatório deve estar entre 0 e o valor do estorno.')
      return
    }

    const reportWeight = amountBase > 0 ? roundToDecimals(reportAmount / amountBase, 4) : 1

    try {
      const { error: incomeUpdateError } = await supabase
        .from('incomes')
        .update({
          amount: amountBase,
          report_weight: reportWeight,
          date: refundIncomeEditForm.date,
          income_category_id: refundIncomeEditForm.income_category_id,
          description: refundIncomeEditForm.description || null,
        })
        .eq('id', editingRefundIncomeId)

      if (incomeUpdateError) throw incomeUpdateError

      const refundNoteText = buildRefundNote(editingRefundIncomeId, refundIncomeEditForm.description || '')
      const { error: paymentUpdateError } = await supabase
        .from('credit_card_bill_payments')
        .update({
          amount: -amountBase,
          payment_date: refundIncomeEditForm.date,
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

  const handleSubmitRefund = async (event: React.FormEvent, cardId: string) => {
    event.preventDefault()
    if (!cardId) return

    const baseVal = parseMoneyInput(refundAmount)
    if (Number.isNaN(baseVal) || baseVal <= 0) {
      alert('Informe um valor de estorno válido.')
      return
    }

    try {
      const estornoCategoryId = await getOrCreateRefundIncomeCategoryId()
      const { data: incomeData, error: incomeError } = await supabase
        .from('incomes')
        .insert([{
          amount: baseVal,
          report_weight: 1.0,
          date: refundDate,
          type: 'other',
          income_category_id: estornoCategoryId,
          description: refundDescription.trim() || 'Estorno fatura',
        }])
        .select('id')
        .single()

      if (incomeError) throw incomeError
      if (!incomeData?.id) throw new Error('Não foi possível obter o ID gerado para a receita de estorno.')

      const refundNoteText = buildRefundNote(String(incomeData.id), refundDescription.trim() || 'Estorno fatura')

      const { error: paymentError } = await supabase
        .from('credit_card_bill_payments')
        .insert([{
          credit_card_id: cardId,
          bill_competence: currentMonth,
          amount: -baseVal,
          payment_date: refundDate,
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

  const handleSubmitCard = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!cardForm.name.trim()) {
      alert('Informe o nome do cartão.')
      return
    }

    const closingDay = Number(cardForm.closing_day)
    const dueDay = Number(cardForm.due_day)

    if (!isFinite(closingDay) || closingDay < 1 || closingDay > 31) {
      alert('O dia de fechamento deve estar entre 1 e 31.')
      return
    }
    if (!isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
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
    await loadBillData(true)
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
    await loadBillData(true)
  }

  const handleSubmitEditPayment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingPaymentItem) return

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

  const handleSubmitCycle = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedCardIdForCycle) return

    const closingDay = Number(cycleForm.closing_day)
    const dueDay = Number(cycleForm.due_day)

    if (!isFinite(closingDay) || closingDay < 1 || closingDay > 31) {
      alert('O dia de fechamento deve estar entre 1 e 31.')
      return
    }
    if (!isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      alert('O dia de vencimento deve estar entre 1 e 31.')
      return
    }

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

  const handleSubmitEditExpense = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingExpenseItem) return

    const amountBase = parseMoneyInput(expenseEditForm.amount)
    if (Number.isNaN(amountBase) || amountBase <= 0) {
      alert('Informe o valor base da despesa.')
      return
    }

    const reportAmount = expenseEditForm.report_amount
      ? parseMoneyInput(expenseEditForm.report_amount)
      : amountBase

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
    const reportWeight = amountBase > 0 ? roundToDecimals(reportAmount / amountBase, 4) : 1

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

  // Submit Dívidas
  const handleSubmitDebt = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!debtForm.name.trim()) {
      alert('Informe o nome da pendência.')
      return
    }
    const debtAmount = Number(debtForm.amount)
    if (isNaN(debtAmount) || debtAmount <= 0) {
      alert('Informe um valor válido e maior que zero.')
      return
    }

    const payload = {
      name: debtForm.name.trim(),
      type: debtForm.type,
      amount: debtAmount,
      due_date: debtForm.due_date,
      description: debtForm.description.trim() || null,
      status: debtForm.status,
    }

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

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm('Deseja excluir este registro de pendência?')) return
    const { error } = await deleteDebt(debtId)
    if (error) {
      alert(`Erro ao excluir: ${error}`)
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
      <ModalForm
        isOpen={isCardModalOpen}
        onClose={closeCardModal}
        title={editingCard ? 'Editar cartão de crédito' : 'Novo cartão de crédito'}
        onSubmit={handleSubmitCard}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={closeCardModal}
            submitLabel={editingCard ? 'Salvar alterações' : 'Salvar cartão'}
            submitDisabled={loadingCards}
            onDelete={editingCard ? handleStartDelete : undefined}
            deleteLabel="Excluir cartão"
          />
        )}
      >
        <Input
          label="Nome do Cartão"
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

        <div className="modal-field-row">
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

        <div className="modal-field-row">
          <CardColorField
            value={cardForm.color}
            onChange={(color) => setCardForm((prev) => ({ ...prev, color }))}
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
      </ModalForm>

      {/* CONFIRM MODAL: DELETAR CARTÃO */}
      <ConfirmModal
        isOpen={isDeleteConfirmModalOpen}
        onClose={handleCancelDelete}
        title={deleteStep === 1 ? 'Excluir cartão' : 'Migrar despesas'}
        confirmLabel={isDeleting ? 'Processando...' : deleteStep === 1 ? 'Próximo' : 'Confirmar Exclusão'}
        confirmVariant={deleteStep === 2 ? 'danger' : 'primary'}
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      >
        {deleteStep === 1 ? (
          <>
            <p className="text-sm text-primary">
              Deseja realmente excluir o cartão <strong>{editingCard?.name}</strong>?
            </p>
            <div className="modal-alert modal-alert--danger text-xs leading-relaxed">
              <p className="mb-1 font-semibold">Aviso:</p>
              <p>Esta ação é irreversível e removerá permanentemente o histórico de faturas e pagamentos deste cartão.</p>
            </div>
          </>
        ) : (
          <>
            <p className="modal-intro text-sm">
              Existem despesas vinculadas a este cartão. O que deseja fazer?
            </p>
            <Select
              label="Migrar despesas para:"
              value={migrationTargetCardId}
              onChange={(e) => setMigrationTargetCardId(e.target.value)}
              options={[
                { value: '', label: "Apenas desvincular (método 'Outro')" },
                ...creditCards
                  .filter((c) => c.id !== editingCard?.id && c.is_active !== false)
                  .map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            {migrationTargetCardId === '' && (
              <p className="text-xs italic text-secondary">* As despesas se tornarão avulsas e não pertencerão a nenhuma fatura.</p>
            )}
          </>
        )}
      </ConfirmModal>

      {/* MODAL: AJUSTAR CICLO */}
      <ModalForm
        isOpen={isCycleModalOpen}
        onClose={closeCycleModal}
        title={`Ajustar fechamento e vencimento (${currentMonth})`}
        onSubmit={handleSubmitCycle}
        footer={(formId) => (
          <ModalFooter formId={formId} onCancel={closeCycleModal} submitLabel="Salvar ajuste" />
        )}
      >
        <div className="modal-field-row">
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

        <p className="modal-intro">
          Este ajuste vale apenas para a competência {currentMonth}.
        </p>

        <Button type="button" variant="outline" fullWidth onClick={handleResetCycleToCardDefault}>
          Usar padrão do cartão neste mês
        </Button>
      </ModalForm>

      {/* MODAL: EDITAR DESPESA DA FATURA */}
      <ModalForm
        isOpen={isExpenseEditModalOpen}
        onClose={closeExpenseEditModal}
        title="Editar despesa"
        onSubmit={handleSubmitEditExpense}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={closeExpenseEditModal}
            submitLabel="Salvar alterações"
            submitDisabled={!expenseEditForm.category_id}
            deleteLabel="Excluir despesa"
            onDelete={handleDeleteExpense}
          />
        )}
      >
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
          <p className="modal-intro">
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
      </ModalForm>

      {/* MODAL: EDITAR PAGAMENTO INDIVIDUAL */}
      <ModalForm
        isOpen={isPaymentEditModalOpen}
        onClose={closePaymentEditModal}
        title="Editar pagamento"
        onSubmit={handleSubmitEditPayment}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={closePaymentEditModal}
            submitLabel="Salvar pagamento"
            deleteLabel="Excluir pagamento"
            onDelete={handleDeletePayment}
          />
        )}
      >
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
      </ModalForm>

      {/* MODAL: EDITAR ESTORNO (RENDA) */}
      <ModalForm
        isOpen={isRefundIncomeEditModalOpen}
        onClose={closeRefundIncomeEditModal}
        title="Editar estorno (renda)"
        onSubmit={handleSubmitEditRefundIncome}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={closeRefundIncomeEditModal}
            submitLabel="Salvar alterações"
            deleteLabel="Excluir estorno"
            onDelete={handleDeleteRefundIncome}
          />
        )}
      >
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
      </ModalForm>

      {/* MODAL: ESTORNO NOVO */}
      <ModalForm
        isOpen={isRefundModalOpen}
        onClose={closeRefundModal}
        title={`Registrar estorno (${currentMonth})`}
        onSubmit={(event) => handleSubmitRefund(event, refundCardId)}
        footer={(formId) => (
          <ModalFooter formId={formId} onCancel={closeRefundModal} submitLabel="Confirmar estorno" />
        )}
      >
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

        <p className="modal-intro">Categoria padrão: Estorno • Valor no relatório: igual ao valor do estorno.</p>
      </ModalForm>

      {/* MODAL: REGISTRAR PAGAMENTO FATURA */}
      <ModalForm
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        title={`Registrar pagamento (${currentMonth})`}
        onSubmit={handleSubmitPayment}
        footer={(formId) => (
          <ModalFooter formId={formId} onCancel={closePaymentModal} submitLabel="Confirmar pagamento" />
        )}
      >
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
      </ModalForm>

      {/* MODAL: NOVO/EDITAR LANÇAMENTO DE PENDÊNCIA */}
      <ModalForm
        isOpen={isDebtModalOpen}
        onClose={closeDebtModal}
        title={editingDebt ? 'Editar Pendência' : 'Nova Pendência'}
        onSubmit={handleSubmitDebt}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={closeDebtModal}
            submitLabel={editingDebt ? 'Salvar Alterações' : 'Salvar Lançamento'}
            submitDisabled={loadingDebts}
          />
        )}
      >
        <Input
          label="Título/Nome"
          value={debtForm.name}
          onChange={(e) => setDebtForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Empréstimo do João, Conta de Energia..."
          required
        />

        <Select
          label="Tipo"
          value={debtForm.type}
          onChange={(e) => setDebtForm((prev) => ({ ...prev, type: e.target.value as 'payable' | 'receivable' }))}
          options={[
            { value: 'payable', label: 'A Pagar (Saída / Pendência de Pagamento)' },
            { value: 'receivable', label: 'A Receber (Entrada / Pendência de Recebimento)' },
          ]}
          required
        />

        <Input
          label="Valor (R$)"
          type="number"
          min="0.01"
          step="0.01"
          value={debtForm.amount}
          onChange={(e) => setDebtForm((prev) => ({ ...prev, amount: e.target.value }))}
          placeholder="0,00"
          required
        />

        <Input
          label="Data de Vencimento"
          type="date"
          value={debtForm.due_date}
          onChange={(e) => setDebtForm((prev) => ({ ...prev, due_date: e.target.value }))}
          required
        />

        <Select
          label="Status Inicial"
          value={debtForm.status}
          onChange={(e) => setDebtForm((prev) => ({ ...prev, status: e.target.value as 'pending' | 'paid' }))}
          options={[
            { value: 'pending', label: 'Pendente' },
            { value: 'paid', label: 'Pago / Recebido' },
          ]}
          required
        />

        <Input
          label="Descrição/Observação (opcional)"
          value={debtForm.description}
          onChange={(e) => setDebtForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Adicione notas adicionais..."
        />
      </ModalForm>

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
      <Modal
        isOpen={isIncomeConfirmModalOpen}
        onClose={() => {
          setIsIncomeConfirmModalOpen(false)
          setSelectedDebtForIncome(null)
        }}
        title="Confirmar Recebimento"
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              onClick={handleConfirmWithIncome}
            >
              Receber e Criar Renda
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={handleConfirmWithoutIncome}
            >
              Apenas Receber (sem renda)
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setIsIncomeConfirmModalOpen(false)
                setSelectedDebtForIncome(null)
              }}
              className="opacity-70 hover:opacity-100"
            >
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-left">
          <div className="bg-secondary/15 border border-glass rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">Descrição do Recebimento</span>
              <span className="text-xs font-bold text-primary truncate max-w-[200px]">{selectedDebtForIncome?.name}</span>
            </div>
            <div className="flex items-center justify-between border-t border-glass/40 pt-2.5">
              <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">Valor do Recebimento</span>
              <span className="text-base font-extrabold text-income font-mono">
                {selectedDebtForIncome ? formatCurrency(selectedDebtForIncome.amount) : ''}
              </span>
            </div>
          </div>

          <div className="modal-alert modal-alert--info text-xs leading-relaxed p-3.5 rounded-xl">
            <p className="font-semibold mb-1">Deseja criar a renda correspondente?</p>
            <p className="opacity-90">
              Se escolher <strong>Receber e Criar Renda</strong>, criaremos uma nova receita automaticamente nas suas Finanças. Caso contrário, a cobrança será apenas marcada como concluída.
            </p>
          </div>
        </div>
      </Modal>

      {/* MODAL: CONFIRMAR RECEBIMENTO INTEGRADO (DESPESA VINCULADA) */}
      <Modal
        isOpen={isIntegratedModalOpen}
        onClose={() => {
          setIsIntegratedModalOpen(false)
          setSelectedDebtForIntegrated(null)
          setLinkedExpense(null)
        }}
        title="Confirmar Recebimento Integrado"
        footer={
          <div className="flex w-full flex-col sm:flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsIntegratedModalOpen(false)
                setSelectedDebtForIntegrated(null)
                setLinkedExpense(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmIntegrated}
            >
              Confirmar e Atualizar Despesa
            </Button>
          </div>
        }
      >
        {linkedExpense && selectedDebtForIntegrated && (
          <div className="space-y-4">
            <p className="text-sm text-primary">
              Este recebimento está integrado à despesa <strong>"{linkedExpense.description || 'Sem descrição'}"</strong>.
            </p>
            
            <div className="grid grid-cols-2 gap-4 bg-secondary/10 p-3 rounded-lg border border-glass text-xs">
              <div>
                <span className="text-secondary font-semibold">Valor Total da Despesa:</span>
                <p className="font-mono text-sm font-bold text-primary">{formatCurrency(linkedExpense.amount)}</p>
              </div>
              <div>
                <span className="text-secondary font-semibold">Valor Atual no Relatório:</span>
                <p className="font-mono text-sm font-bold text-primary">{formatCurrency(linkedExpense.amount * (linkedExpense.report_weight ?? 1))}</p>
              </div>
              <div className="col-span-2 border-t border-glass pt-2 mt-1">
                <span className="text-secondary font-semibold">Valor do Pagamento/Recebimento:</span>
                <p className="font-mono text-sm font-bold text-income">{formatCurrency(selectedDebtForIntegrated.amount)}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <Input
                label="Valor final no relatório da despesa"
                type="text"
                inputMode="decimal"
                value={integratedReportValueInput}
                onChange={(e) => setIntegratedReportValueInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseMoneyInput(integratedReportValueInput)
                  if (!Number.isNaN(parsed) && parsed >= 0) {
                    setIntegratedReportValueInput(formatMoneyInput(parsed))
                  }
                }}
                placeholder="0,00"
                required
              />
              <p className="text-[10px] text-secondary">
                * O valor final sugerido acima foi reduzido automaticamente pelo pagamento. Você pode editar este valor caso deseje outro peso de relatório.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: CONFIRMAR PAGAMENTO DÍVIDA (CADASTRAR DESPESA?) */}
      <Modal
        isOpen={isPayableConfirmModalOpen}
        onClose={() => {
          setIsPayableConfirmModalOpen(false)
          setSelectedDebtForPayableExpense(null)
        }}
        title="Confirmar Pagamento"
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setIsPayableConfirmModalOpen(false)
                setIsPayableExpenseModalOpen(true)
              }}
            >
              Pagar e Cadastrar Despesa
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={handleConfirmPayableWithoutExpenseDirect}
            >
              Apenas Pagar (sem despesa)
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setIsPayableConfirmModalOpen(false)
                setSelectedDebtForPayableExpense(null)
              }}
              className="opacity-70 hover:opacity-100"
            >
              Cancelar
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-left">
          <div className="bg-secondary/15 border border-glass rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">Título da Pendência</span>
              <span className="text-xs font-bold text-primary truncate max-w-[200px]">{selectedDebtForPayableExpense?.name}</span>
            </div>
            <div className="flex items-center justify-between border-t border-glass/40 pt-2.5">
              <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">Valor do Pagamento</span>
              <span className="text-base font-extrabold text-expense font-mono">
                {selectedDebtForPayableExpense ? formatCurrency(selectedDebtForPayableExpense.amount) : ''}
              </span>
            </div>
          </div>

          <div className="modal-alert modal-alert--info text-xs leading-relaxed p-3.5 rounded-xl">
            <p className="font-semibold mb-1">Deseja cadastrar a despesa vinculada?</p>
            <p className="opacity-90">
              Ao escolher <strong>Pagar e Cadastrar Despesa</strong>, você criará um registro de saída correspondente no fluxo de caixa. Caso contrário, a pendência será apenas marcada como paga sem afetar seu fluxo.
            </p>
          </div>
        </div>
      </Modal>

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

