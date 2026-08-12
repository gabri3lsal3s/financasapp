import { useMemo } from 'react'
import { roundToDecimals } from '@/utils/format'
import type { CreditCard, Debt } from '@/types'

export type DebtFilter = 'all' | 'payable' | 'receivable'

export interface UseContasDerivedDataParams {
  debts: Debt[]
  creditCards: CreditCard[]
  currentMonth: string
  debtFilter: DebtFilter
  paymentsByCard: Record<string, number>
  baseExpensesByCard: Record<string, number>
}

/**
 * useContasDerivedData — dados derivados da página Contas (extraído do
 * orquestrador). Centraliza os memos de cartões ativos, pendências,
 * confirmadas e o resumo de KPIs.
 */
export function useContasDerivedData({
  debts,
  creditCards,
  currentMonth,
  debtFilter,
  paymentsByCard,
  baseExpensesByCard,
}: UseContasDerivedDataParams) {
  const activeCards = useMemo(
    () => creditCards.filter((card) => card.is_active !== false),
    [creditCards],
  )

  // Pendências ativas (não pagas)
  const pendingDebts = useMemo(() => {
    return debts.filter((d) => d.status === 'pending')
  }, [debts])

  const payablePendingCount = useMemo(
    () => debts.filter((d) => d.status === 'pending' && d.type === 'payable').length,
    [debts],
  )
  const receivablePendingCount = useMemo(
    () => debts.filter((d) => d.status === 'pending' && d.type === 'receivable').length,
    [debts],
  )

  const filteredPendingDebts = useMemo(() => {
    return debts.filter((d) => {
      if (d.status !== 'pending') return false
      if (debtFilter === 'payable') return d.type === 'payable'
      if (debtFilter === 'receivable') return d.type === 'receivable'
      return true
    })
  }, [debts, debtFilter])

  // Pendências confirmadas (pagas) no mês selecionado
  const confirmedDebts = useMemo(() => {
    return debts.filter((d) => d.status === 'paid' && d.due_date.startsWith(currentMonth))
  }, [debts, currentMonth])

  const stats = useMemo(() => {
    const totalFaturasAberto = activeCards.reduce((sum, card) => {
      const previsto = Number(baseExpensesByCard[card.id] || 0)
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
  }, [activeCards, baseExpensesByCard, paymentsByCard, debts, currentMonth])

  return {
    activeCards,
    pendingDebts,
    payablePendingCount,
    receivablePendingCount,
    filteredPendingDebts,
    confirmedDebts,
    stats,
  }
}
