import { addMonths, format } from 'date-fns'
import { resolveBillCompetence, splitAmountIntoInstallments } from '@/utils/creditCardBilling'
import { supabase } from '@/lib/supabase'
import type { Expense } from '@/types'

/**
 * Gera as datas de cada parcela a partir da data inicial.
 * Garante no mínimo 1 e no máximo 60 parcelas.
 */
export function buildInstallmentDates(startDate: string, installmentTotal: number): string[] {
  const normalizedTotal = Math.max(1, Math.min(60, Math.trunc(installmentTotal || 1)))
  const baseDate = new Date(`${startDate}T00:00:00`)

  return Array.from({ length: normalizedTotal }, (_, index) =>
    format(addMonths(baseDate, index), 'yyyy-MM-dd'),
  )
}

/**
 * Busca o closing day padrão do cartão e eventuais overrides mensais
 * via credit_card_monthly_cycles.
 */
export async function fetchCardClosingDayContext(creditCardId: string, competences: string[]) {
  const { data: cardData, error: cardError } = await supabase
    .from('credit_cards')
    .select('closing_day')
    .eq('id', creditCardId)
    .maybeSingle()

  if (cardError) throw cardError
  if (!cardData || !Number.isFinite(cardData.closing_day)) {
    throw new Error('Não foi possível calcular a competência da fatura para este cartão.')
  }

  const uniqueCompetences = Array.from(new Set(competences.filter(Boolean)))
  let monthlyOverrides: Array<{ competence: string; closing_day: number }> = []

  if (uniqueCompetences.length) {
    const { data: cycleRows, error: cycleError } = await supabase
      .from('credit_card_monthly_cycles')
      .select('competence, closing_day')
      .eq('credit_card_id', creditCardId)
      .in('competence', uniqueCompetences)

    if (cycleError) throw cycleError
    monthlyOverrides = (cycleRows || []) as Array<{ competence: string; closing_day: number }>
  }

  const closingDayByCompetence = monthlyOverrides.reduce<Record<string, number>>((accumulator, row) => {
    if (Number.isFinite(row.closing_day)) {
      accumulator[String(row.competence)] = Number(row.closing_day)
    }
    return accumulator
  }, {})

  return {
    defaultClosingDay: Number(cardData.closing_day),
    closingDayByCompetence,
  }
}

/**
 * Gera os payloads de inserção para uma despesa, desdobrando em parcelas
 * quando installment_total > 1.
 */
export function generateInstallmentPayloads(
  expense: Omit<Expense, 'id' | 'created_at' | 'category' | 'credit_card'>,
  installments: number,
  resolveClosingDayForDate?: (expenseDate: string) => number | undefined,
): Array<Record<string, unknown>> {
  const installmentTotal = Math.max(1, Math.min(60, Math.trunc(installments || 1)))
  const baseDate = new Date(`${expense.date || format(new Date(), 'yyyy-MM-dd')}T00:00:00`)

  if (installmentTotal <= 1) {
    const singleExpenseDate = expense.date || format(new Date(), 'yyyy-MM-dd')
    const billCompetence =
      expense.bill_competence ||
      (expense.payment_method === 'credit_card' && expense.credit_card_id && resolveClosingDayForDate
        ? resolveBillCompetence(singleExpenseDate, () => resolveClosingDayForDate(singleExpenseDate))
        : undefined)

    return [{
      amount: expense.amount,
      date: singleExpenseDate,
      category_id: expense.category_id,
      ...(expense.payment_method && { payment_method: expense.payment_method }),
      ...(expense.credit_card_id && { credit_card_id: expense.credit_card_id }),
      ...(billCompetence && { bill_competence: billCompetence }),
      ...(expense.report_weight !== undefined && { report_weight: expense.report_weight }),
      ...(expense.description && { description: expense.description }),
    }]
  }

  const groupId = crypto.randomUUID()
  const installmentAmounts = splitAmountIntoInstallments(expense.amount, installmentTotal)

  return installmentAmounts.map((installmentAmount, index) => {
    const installmentDate = format(addMonths(baseDate, index), 'yyyy-MM-dd')

    let billCompetence: string | undefined
    if (expense.bill_competence && expense.payment_method === 'credit_card') {
      // Se tiver competência manual, as parcelas seguintes seguem a sequência
      const [year, month] = expense.bill_competence.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      billCompetence = format(addMonths(startDate, index), 'yyyy-MM')
    } else if (expense.payment_method === 'credit_card' && expense.credit_card_id && resolveClosingDayForDate) {
      billCompetence = resolveBillCompetence(installmentDate, () => resolveClosingDayForDate(installmentDate))
    }

    return {
      amount: installmentAmount,
      date: installmentDate,
      category_id: expense.category_id,
      ...(expense.payment_method && { payment_method: expense.payment_method }),
      ...(expense.credit_card_id && { credit_card_id: expense.credit_card_id }),
      ...(billCompetence && { bill_competence: billCompetence }),
      ...(expense.report_weight !== undefined && { report_weight: expense.report_weight }),
      ...(expense.description && { description: expense.description }),
      installment_group_id: groupId,
      installment_number: index + 1,
      installment_total: installmentTotal,
    }
  })
}
