import { useCallback } from 'react'
import type { CreditCard } from '@/types'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'

const sortCreditCards = (items: CreditCard[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export function useCreditCards() {
  const table = useSupabaseTable<CreditCard>({
    table: 'credit_cards',
    select: '*',
    orderBy: { column: 'name', ascending: true },
    sortBy: sortCreditCards,
    errorMessage: 'Erro ao carregar cartões de crédito',
  })

  const createCreditCard = useCallback(
    async (payload: Omit<CreditCard, 'id' | 'created_at'>) => {
      return table.create(payload)
    },
    [table],
  )

  const updateCreditCard = useCallback(
    async (id: string, updates: Partial<CreditCard>) => {
      return table.update(id, updates)
    },
    [table],
  )

  const deactivateCreditCard = useCallback(
    async (id: string) => {
      return table.update(id, { is_active: false })
    },
    [table],
  )

  const deleteCreditCard = useCallback(
    async (id: string) => {
      return table.remove(id)
    },
    [table],
  )

  return {
    creditCards: table.data,
    loading: table.loading,
    error: table.error,
    createCreditCard,
    updateCreditCard,
    deactivateCreditCard,
    deleteCreditCard,
    refreshCreditCards: table.refresh,
  }
}
