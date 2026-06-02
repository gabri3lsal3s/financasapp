import { addMonths, format } from 'date-fns'
import { applyReportWeightToBillRow } from '@/utils/reportWeight'

const clampDay = (day: number) => Math.min(31, Math.max(1, Math.trunc(day || 1)))

export type BillExpenseItem = {
  id: string
  credit_card_id: string
  amount: number
  base_amount?: number
  report_weight?: number | null
  payment_method?: 'cash' | 'debit' | 'credit_card' | 'pix' | 'transfer' | 'other'
  date: string
  bill_competence?: string | null
  category_id?: string | null
  category_name?: string | null
  category?: { name?: string | null } | null
  description?: string | null
  installment_number?: number | null
  installment_total?: number | null
  competence_source?: 'manual' | 'auto'
}

export const resolveExpenseBillCompetence = (
  row: Pick<BillExpenseItem, 'date' | 'bill_competence' | 'credit_card_id'>,
  resolveClosingDay: (cardId: string, competence: string) => number | undefined,
) => {
  if (row.bill_competence) {
    return String(row.bill_competence)
  }

  const cardId = String(row.credit_card_id || '')
  if (!cardId) return undefined

  return resolveBillCompetence(String(row.date), (comp) => resolveClosingDay(cardId, comp))
}

export type BillPaymentItem = {
  credit_card_id: string
  amount: number
}

export type BillPaymentRowInput = {
  id: string
  credit_card_id: string
  amount: number
  payment_date: string
  bill_competence?: string | null
  note?: string | null
}

export type BillPaymentDisplayItem = BillPaymentRowInput & {
  bill_competence: string
}

export type BillExpenseRowInput = BillExpenseItem & {
  category?: { name?: string | null } | null
}

export const buildClosingDayResolver = (
  cycleClosingByCardAndMonth: Record<string, number>,
  cardClosingDays: Record<string, number>,
) => {
  return (cardId: string, competence: string): number | undefined => {
    const monthlyClosing = cycleClosingByCardAndMonth[`${cardId}:${competence}`]
    if (Number.isFinite(monthlyClosing)) return monthlyClosing

    const defaultClosing = cardClosingDays[cardId]
    return Number.isFinite(defaultClosing) ? defaultClosing : undefined
  }
}

export const filterBillExpensesForMonth = (
  rawRows: BillExpenseRowInput[],
  targetMonth: string,
  resolveClosingDay: (cardId: string, competence: string) => number | undefined,
): BillExpenseItem[] => {
  return rawRows
    .map((row) => ({
      ...row,
      category_name: row.category_name ?? row.category?.name ?? null,
    }))
    .filter((row) => {
      if (row.bill_competence) {
        return row.bill_competence === targetMonth
      }

      const rowDate = String(row.date)
      const rowCardId = String(row.credit_card_id)
      const competenceByDate = rowDate.slice(0, 7)
      const closingDay = resolveClosingDay(rowCardId, competenceByDate)

      let resolvedCompetence: string | undefined
      if (Number.isFinite(closingDay)) {
        resolvedCompetence = resolveBillCompetence(rowDate, Number(closingDay))
      } else {
        resolvedCompetence = resolveExpenseBillCompetence(row, resolveClosingDay)
      }

      row.bill_competence = resolvedCompetence
      return resolvedCompetence === targetMonth
    })
    .map((row) => ({ ...row }))
}

export const filterBillPaymentsForMonth = (
  paymentRows: BillPaymentRowInput[],
  targetMonth: string,
  _searchStartDate: string,
  _searchEndDate: string,
  resolveClosingDay: (cardId: string, competence: string) => number | undefined,
): BillPaymentDisplayItem[] => {
  const items: BillPaymentDisplayItem[] = []

  paymentRows.forEach((row) => {
    const cardId = String(row.credit_card_id || '')
    const rawNote = String(row.note || '')
    const isRefund = rawNote.startsWith('[REFUND]') || Number(row.amount || 0) < 0
    const paymentDate = String(row.payment_date || '')
    let finalCompetence = String(row.bill_competence || targetMonth)

    if (isRefund && !row.bill_competence) {
      const closingDay = resolveClosingDay(cardId, paymentDate.slice(0, 7))
      if (Number.isFinite(closingDay)) {
        finalCompetence = resolveBillCompetence(paymentDate, Number(closingDay))
      }
    }

    if (finalCompetence !== targetMonth) return
    if (!cardId) return

    items.push({
      id: String(row.id || ''),
      credit_card_id: cardId,
      amount: Number(row.amount || 0),
      payment_date: paymentDate,
      bill_competence: String(row.bill_competence || targetMonth),
      note: row.note ? String(row.note) : null,
    })
  })

  return items
}

export const prepareBillExpenseRows = (
  expenseRows: BillExpenseItem[],
  weightsEnabled: boolean,
): BillExpenseItem[] => {
  return expenseRows.map((row) => applyReportWeightToBillRow(row, weightsEnabled))
}

export const groupPaymentsByCard = (
  payments: BillPaymentDisplayItem[],
): Record<string, BillPaymentDisplayItem[]> => {
  return payments.reduce<Record<string, BillPaymentDisplayItem[]>>((accumulator, item) => {
    const cardId = item.credit_card_id
    if (!accumulator[cardId]) {
      accumulator[cardId] = []
    }
    accumulator[cardId].push(item)
    return accumulator
  }, {})
}

export const resolveBillCompetence = (
  purchaseDate: string, 
  closingDayOrResolver: number | ((competence: string) => number | undefined)
) => {
  const parsedDate = new Date(`${purchaseDate}T12:00:00`)
  if (!Number.isFinite(parsedDate.getTime())) {
    return format(new Date(), 'yyyy-MM')
  }

  const competenceByDate = format(parsedDate, 'yyyy-MM')
  const closingDay = typeof closingDayOrResolver === 'function'
    ? (closingDayOrResolver(competenceByDate) ?? 7)
    : closingDayOrResolver

  const normalizedClosingDay = clampDay(closingDay)
  const referenceDate = parsedDate.getDate() >= normalizedClosingDay
    ? addMonths(parsedDate, 1)
    : parsedDate

  return format(referenceDate, 'yyyy-MM')
}

export const splitAmountIntoInstallments = (totalAmount: number, installments: number) => {
  const installmentCount = Math.max(1, Math.trunc(installments || 1))
  const totalInCents = Math.round(totalAmount * 100)
  const baseInstallment = Math.floor(totalInCents / installmentCount)
  const remainder = totalInCents - (baseInstallment * installmentCount)

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents = baseInstallment + (index < remainder ? 1 : 0)
    return Number((cents / 100).toFixed(2))
  })
}

export const summarizeCreditCardBill = (
  expenseRows: BillExpenseItem[],
  paymentRows: BillPaymentItem[],
) => {
  const expensesByCard: Record<string, number> = {}
  const paymentsByCard: Record<string, number> = {}
  const billItemsByCard: Record<string, BillExpenseItem[]> = {}

  expenseRows.forEach((row) => {
    const cardId = String(row.credit_card_id || '')
    if (!cardId) return

    expensesByCard[cardId] = Number((expensesByCard[cardId] || 0) + Number(row.amount || 0))

    if (!billItemsByCard[cardId]) {
      billItemsByCard[cardId] = []
    }

    billItemsByCard[cardId].push({
      id: String(row.id),
      credit_card_id: cardId,
      amount: Number(row.amount || 0),
      base_amount: row.base_amount === undefined ? Number(row.amount || 0) : Number(row.base_amount || 0),
      report_weight:
        row.report_weight === null || row.report_weight === undefined
          ? null
          : Number(row.report_weight),
      payment_method: row.payment_method,
      date: String(row.date),
      bill_competence: row.bill_competence ? String(row.bill_competence) : null,
      category_id: row.category_id ? String(row.category_id) : null,
      category_name:
        row.category_name
          ? String(row.category_name)
          : (row.category?.name ? String(row.category.name) : null),
      description: row.description ? String(row.description) : undefined,
      installment_number:
        row.installment_number === null || row.installment_number === undefined
          ? null
          : Number(row.installment_number),
      installment_total:
        row.installment_total === null || row.installment_total === undefined
          ? null
          : Number(row.installment_total),
    })
  })

  paymentRows.forEach((row) => {
    const cardId = String(row.credit_card_id || '')
    if (!cardId) return

    paymentsByCard[cardId] = Number((paymentsByCard[cardId] || 0) + Number(row.amount || 0))
  })

  Object.keys(billItemsByCard).forEach((cardId) => {
    billItemsByCard[cardId] = billItemsByCard[cardId].sort((a, b) => b.date.localeCompare(a.date))
  })

  return {
    expensesByCard,
    paymentsByCard,
    billItemsByCard,
  }
}
