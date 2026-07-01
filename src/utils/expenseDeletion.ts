import { Expense, Debt } from '@/types'
import { enqueueOfflineOperation, removeOfflineCreateOperation } from '@/utils/offlineQueue'
import { getCache, setCache } from '@/services/offlineCache'
import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

/**
 * Determina quais IDs de despesa devem ser deletados com base no modo
 * de exclusão (single / all / subsequent).
 */
export function resolveExpenseIdsToDelete(
  expenses: Expense[],
  targetId: string,
  mode: 'single' | 'all' | 'subsequent',
): string[] {
  const target = expenses.find((exp) => exp.id === targetId)
  if (!target) return []

  const targetGroupId = target.installment_group_id
  const targetInstallmentNumber = target.installment_number

  if (mode === 'single' || !targetGroupId) {
    return [targetId]
  }

  return expenses
    .filter((exp) => {
      if (exp.installment_group_id !== targetGroupId) return false
      if (mode === 'all') return true
      if (mode === 'subsequent') {
        return (exp.installment_number ?? 1) >= (targetInstallmentNumber ?? 1)
      }
      return false
    })
    .map((exp) => exp.id)
}

/**
 * Busca no banco os IDs de despesas relacionadas por grupo de parcelas,
 * usada quando a exclusão ocorre online e precisamos garantir que todos
 * os registros no servidor sejam capturados.
 */
export async function fetchGroupExpenseIdsFromDb(
  groupId: string,
  mode: 'all' | 'subsequent',
  targetInstallmentNumber?: number | null,
): Promise<string[]> {
  let query = supabase
    .from('expenses')
    .select('id')
    .eq('installment_group_id', groupId)

  if (mode === 'subsequent' && targetInstallmentNumber !== null && targetInstallmentNumber !== undefined) {
    query = query.gte('installment_number', targetInstallmentNumber)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map((row) => row.id)
}

/**
 * Deleta dívidas pendentes associadas às despesas no Supabase e
 * atualiza o cache local de dívidas.
 */
export async function deletePendingDebtsForExpenses(expenseIds: string[]): Promise<void> {
  if (expenseIds.length === 0) return

  await supabase
    .from('debts')
    .delete()
    .in('expense_id', expenseIds)
    .eq('status', 'pending')

  // Atualiza cache local
  const debtsCache = await getCache<Debt[]>('debts-all')
  if (debtsCache) {
    const nextDebts = debtsCache.filter(
      (d) => !(d.expense_id && expenseIds.includes(d.expense_id) && d.status === 'pending'),
    )
    await setCache('debts-all', nextDebts)
    window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
  }
}

/**
 * Enfileira operações offline para exclusão de despesas e suas dívidas
 * associadas. Retorna os IDs que foram enfileirados.
 */
export async function enqueueOfflineExpenseDeletion(
  expenses: Expense[],
  idsToDelete: string[],
): Promise<void> {
  for (const exp of expenses) {
    if (!idsToDelete.includes(exp.id)) continue

    if (exp.id.startsWith('offline-')) {
      removeOfflineCreateOperation(exp.id)
    } else {
      enqueueOfflineOperation({
        entity: 'expenses',
        action: 'delete',
        recordId: exp.id,
      })
    }
  }

  // Enfileira deleção de dívidas pendentes associadas
  const debtsCache = await getCache<Debt[]>('debts-all')
  if (debtsCache) {
    const linkedPendingDebts = debtsCache.filter(
      (d) => d.expense_id && idsToDelete.includes(d.expense_id) && d.status === 'pending',
    )
    for (const debt of linkedPendingDebts) {
      if (debt.id.startsWith('offline-')) {
        removeOfflineCreateOperation(debt.id)
      } else {
        enqueueOfflineOperation({
          entity: 'debts',
          action: 'delete',
          recordId: debt.id,
        })
      }
    }

    const nextDebts = debtsCache.filter(
      (d) => !(d.expense_id && idsToDelete.includes(d.expense_id) && d.status === 'pending'),
    )
    await setCache('debts-all', nextDebts)
    window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
  }
}

/**
 * Log centralizado de erro de exclusão.
 */
export function handleDeleteError(err: unknown): string {
  const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar despesa'
  logger.error('Error deleting expense:', err)
  return errorMessage
}
