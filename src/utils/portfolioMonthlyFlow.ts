import type { PortfolioOperationType, PortfolioTransaction } from '@/types'
import { isPortfolioIncomeType } from '@/utils/portfolioOperations'

/** Impacto no caixa do mês: compras/subscrições aumentam o total investido; vendas/proventos reduzem. */
export function transactionInvestmentAmount(
  operationType: PortfolioOperationType,
  quantity: number,
  price: number
): number {
  const gross = quantity * price
  if (!Number.isFinite(gross) || gross <= 0) return 0

  if (operationType === 'buy' || operationType === 'subscription') {
    return gross
  }
  if (operationType === 'sell' || isPortfolioIncomeType(operationType)) {
    return -gross
  }
  return 0
}

export function normalizeMonthKey(month: string): string {
  return month.length >= 7 ? month.slice(0, 7) : month
}

/** Soma fluxo de investimento do livro-razão no mês (yyyy-MM), pela data real da transação. */
export function sumPortfolioTransactionsForMonth(
  transactions: Pick<PortfolioTransaction, 'date' | 'operation_type' | 'quantity' | 'price'>[],
  month: string
): number {
  const monthKey = normalizeMonthKey(month)
  return transactions.reduce((sum, tx) => {
    if (!tx.date || normalizeMonthKey(tx.date) !== monthKey) return sum
    return (
      sum +
      transactionInvestmentAmount(
        tx.operation_type,
        Number(tx.quantity),
        Number(tx.price)
      )
    )
  }, 0)
}

/** Apenas aplicações (compras/subscrições) — vendas e proventos não entram no gráfico diário. */
function transactionInvestmentOutflowAmount(
  operationType: PortfolioOperationType,
  quantity: number,
  price: number
): number {
  const amount = transactionInvestmentAmount(operationType, quantity, price)
  return amount > 0 ? amount : 0
}

/** Valores por dia (índice 0 = dia 1) para gráfico diário de investimentos (somente saídas). */
export function portfolioInvestmentByDay(
  transactions: Pick<PortfolioTransaction, 'date' | 'operation_type' | 'quantity' | 'price'>[],
  month: string,
  daysInMonth: number
): number[] {
  const series = Array.from({ length: daysInMonth }, () => 0)
  const monthKey = normalizeMonthKey(month)

  for (const tx of transactions) {
    if (!tx.date || normalizeMonthKey(tx.date) !== monthKey) continue
    const day = new Date(`${tx.date}T00:00:00`).getDate()
    if (day < 1 || day > daysInMonth) continue
    series[day - 1] += transactionInvestmentOutflowAmount(
      tx.operation_type,
      Number(tx.quantity),
      Number(tx.price)
    )
  }

  return series
}
