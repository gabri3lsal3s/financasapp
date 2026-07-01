import { addMonths, format } from 'date-fns'
import { resolveBillCompetence } from '@/utils/creditCardBilling'
// Re-exporta a função de busca de closing day do expenseInstallments para evitar duplicação
export { fetchCardClosingDayContext as fetchClosingDayForCard } from '@/utils/expenseInstallments'

/**
 * Calcula a competência de fatura para uma data de despesa.
 * Se já tiver competência fornecida, retorna ela.
 * Se for cartão de crédito, calcula com base no closing day.
 */
export function resolveExpenseCompetence(
  date: string,
  paymentMethod: string | undefined,
  creditCardId: string | undefined | null,
  billCompetenceOverride: string | undefined | null,
  resolveClosingDay: (competence: string) => number | undefined,
): string | undefined {
  // Se já tem competência explícita, usa ela
  if (billCompetenceOverride) {
    return billCompetenceOverride
  }

  // Se não é cartão de crédito, não tem competência
  if (paymentMethod !== 'credit_card' || !creditCardId) {
    return undefined
  }

  return resolveBillCompetence(date, (comp: string) => resolveClosingDay(comp))
}

/**
 * Gera a sequência de competências para parcelas de cartão de crédito.
 * A partir da competência base, gera meses sequenciais.
 */
export function buildInstallmentCompetences(
  baseCompetence: string,
  installmentCount: number,
): string[] {
  const [year, month] = baseCompetence.split('-').map(Number)
  const baseDate = new Date(year, month - 1, 1)

  return Array.from({ length: installmentCount }, (_, index) =>
    format(addMonths(baseDate, index), 'yyyy-MM'),
  )
}

/**
 * Resolve o closing day para uma determinada competência, considerando
 * overrides mensais e fallback para o closing day padrão.
 */
export function resolveClosingDay(
  competence: string,
  defaultClosingDay: number,
  closingDayByCompetence: Record<string, number>,
): number {
  return closingDayByCompetence[competence] || defaultClosingDay
}
