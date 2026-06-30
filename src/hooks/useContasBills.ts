import { useState, useCallback } from 'react'
import { endOfMonth, format, subMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { CreditCard } from '@/types'
import { roundToDecimals } from '@/utils/format'
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
import { shiftMonth } from '@/utils/creditCardMonthSelection'
import { parseRefundNote } from '@/pages/creditCards/refundNote'
import type { MonthlyCycleRow } from '@/components/creditCards/CreditCardTimeline'

type PaymentItem = BillPaymentDisplayItem

export interface BillDataSnapshot {
  expensesByCard: Record<string, number>
  paymentsByCard: Record<string, number>
  baseExpensesByCard: Record<string, number>
  billItemsByCard: Record<string, BillExpenseItem[]>
  paymentItemsByCard: Record<string, PaymentItem[]>
  monthlyCyclesByCard: Record<string, MonthlyCycleRow>
}

export interface UseContasBillsReturn {
  expensesByCard: Record<string, number>
  paymentsByCard: Record<string, number>
  baseExpensesByCard: Record<string, number>
  billItemsByCard: Record<string, BillExpenseItem[]>
  paymentItemsByCard: Record<string, PaymentItem[]>
  monthlyCyclesByCard: Record<string, MonthlyCycleRow>
  loadingBills: boolean
  getBillDataSnapshot: (targetMonth: string) => Promise<BillDataSnapshot>
  fetchReconciliationCandidates: (cardId: string, baseMonth: string) => Promise<BillExpenseItem[]>
  loadBillData: (silent?: boolean) => Promise<void>
}

export function useContasBills(
  currentMonth: string,
  creditCards: CreditCard[],
): UseContasBillsReturn {
  const [loadingBills, setLoadingBills] = useState(true)
  const [expensesByCard, setExpensesByCard] = useState<Record<string, number>>({})
  const [paymentsByCard, setPaymentsByCard] = useState<Record<string, number>>({})
  const [baseExpensesByCard, setBaseExpensesByCard] = useState<Record<string, number>>({})
  const [billItemsByCard, setBillItemsByCard] = useState<Record<string, BillExpenseItem[]>>({})
  const [paymentItemsByCard, setPaymentItemsByCard] = useState<Record<string, PaymentItem[]>>({})
  const [monthlyCyclesByCard, setMonthlyCyclesByCard] = useState<Record<string, MonthlyCycleRow>>({})

  const getBillDataSnapshot = useCallback(async (targetMonth: string): Promise<BillDataSnapshot> => {
    const competenceReferenceDate = new Date(`${targetMonth}-01T12:00:00`)
    const searchStartDate = format(subMonths(competenceReferenceDate, 2), 'yyyy-MM-01')
    const nextMonthReference = new Date(`${shiftMonth(targetMonth, 1)}-01T12:00:00`)
    const searchEndDate = format(endOfMonth(nextMonthReference), 'yyyy-MM-dd')

    const cycleMonths = [
      shiftMonth(targetMonth, -2),
      shiftMonth(targetMonth, -1),
      targetMonth,
      shiftMonth(targetMonth, 1),
    ]

    const { data: monthlyCycleRows } = await supabase
      .from('credit_card_monthly_cycles')
      .select('id, credit_card_id, competence, closing_day, due_day')
      .in('competence', cycleMonths)

    const cycleClosingByCardAndMonth = (monthlyCycleRows || []).reduce<Record<string, number>>((acc, row) => {
      const cardId = String(row.credit_card_id || '')
      const competence = String(row.competence || '')
      if (!cardId || !competence) return acc
      acc[`${cardId}:${competence}`] = Number(row.closing_day)
      return acc
    }, {})

    const currentMonthCycles = (monthlyCycleRows || []).reduce<Record<string, MonthlyCycleRow>>((acc, row) => {
      if (String(row.competence || '') !== targetMonth) return acc
      const cardId = String(row.credit_card_id || '')
      if (!cardId) return acc
      acc[cardId] = {
        id: String(row.id),
        credit_card_id: cardId,
        competence: String(row.competence),
        closing_day: Number(row.closing_day),
        due_day: Number(row.due_day),
      }
      return acc
    }, {})

    const cardClosingDays = creditCards.reduce<Record<string, number>>((acc, card) => {
      if (card.id && Number.isFinite(card.closing_day)) {
        acc[card.id] = Number(card.closing_day)
      }
      return acc
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
    const expenseRows = prepareBillExpenseRows(filteredExpenses, true)

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
  }, [creditCards])

  const loadBillData = useCallback(async (silent = false) => {
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
  }, [currentMonth, getBillDataSnapshot])

  const fetchReconciliationCandidates = useCallback(async (cardId: string, baseMonth: string): Promise<BillExpenseItem[]> => {
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
        const noteStr = String(payment.note || '')
        if (!noteStr.startsWith('[REFUND]')) return null
        let refundDesc = 'Estorno registrado'
        try {
          const parsed = JSON.parse(noteStr.slice('[REFUND]'.length))
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
  }, [getBillDataSnapshot])

  return {
    expensesByCard,
    paymentsByCard,
    baseExpensesByCard,
    billItemsByCard,
    paymentItemsByCard,
    monthlyCyclesByCard,
    loadingBills,
    getBillDataSnapshot,
    fetchReconciliationCandidates,
    loadBillData,
  }
}
