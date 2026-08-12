/**
 * Status de dívidas por vencimento (DRY): deriva um estado tipado a partir
 * de `due_date`/`status` para os chips do DebtsSection. Lógica pura em
 * utils/ — testável e reutilizável em qualquer tela.
 */
import type { Debt } from '@/types'

export type DebtDueStatus = 'paid' | 'overdue' | 'due_today' | 'due_soon' | 'pending'

export const DEBT_DUE_STATUS_LABEL: Record<DebtDueStatus, string> = {
  paid: 'Quitada',
  overdue: 'Atrasada',
  due_today: 'Vence Hoje',
  due_soon: 'Vence em Breve',
  pending: 'A Vencer',
}

const DAY_MS = 24 * 60 * 60 * 1000
/** Janela de "vence em breve" (dias até o vencimento). */
const DUE_SOON_DAYS = 3

/**
 * Deriva o status de uma dívida:
 * - `paid`: já quitada (status === 'paid');
 * - `overdue`: vencimento anterior a hoje;
 * - `due_today`: vencimento hoje;
 * - `due_soon`: vencimento em até 3 dias;
 * - `pending`: vence depois da janela.
 */
export function getDebtDueStatus(
  debt: Pick<Debt, 'status' | 'due_date'>,
  today: Date = new Date(),
): DebtDueStatus {
  if (debt.status === 'paid') return 'paid'

  const due = new Date(`${debt.due_date}T00:00:00`)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (Number.isNaN(due.getTime())) return 'pending'

  if (due.getTime() < startOfToday.getTime()) return 'overdue'
  if (due.getTime() === startOfToday.getTime()) return 'due_today'

  // Diferença em dias de calendário via Date.UTC (imune a DST).
  const dueUTC = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())
  const todayUTC = Date.UTC(
    startOfToday.getFullYear(),
    startOfToday.getMonth(),
    startOfToday.getDate(),
  )
  const diffDays = Math.round((dueUTC - todayUTC) / DAY_MS)
  return diffDays <= DUE_SOON_DAYS ? 'due_soon' : 'pending'
}
