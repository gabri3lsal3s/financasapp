import type { PortfolioOperationType, PortfolioTransaction } from '@/types'

const INCOME_TYPES: PortfolioOperationType[] = ['dividend', 'jcp', 'fii_yield']

export function isPortfolioIncomeType(op: PortfolioOperationType): boolean {
  return INCOME_TYPES.includes(op)
}

export const PORTFOLIO_OPERATION_OPTIONS: { value: PortfolioOperationType; label: string }[] = [
  { value: 'buy', label: 'Compra' },
  { value: 'sell', label: 'Venda' },
  { value: 'dividend', label: 'Dividendo' },
  { value: 'jcp', label: 'JCP' },
  { value: 'fii_yield', label: 'Rendimento (FII)' },
  { value: 'split', label: 'Desdobro' },
  { value: 'reverse_split', label: 'Grupamento' },
  { value: 'subscription', label: 'Subscrição' },
]

export function portfolioOperationLabel(op: PortfolioOperationType): string {
  switch (op) {
    case 'buy':
      return 'Compra'
    case 'sell':
      return 'Venda'
    case 'dividend':
      return 'Dividendo'
    case 'jcp':
      return 'JCP'
    case 'fii_yield':
      return 'Rendimento (FII)'
    case 'split':
      return 'Desdobro'
    case 'reverse_split':
      return 'Grupamento'
    case 'subscription':
      return 'Subscrição'
    default:
      return op
  }
}

/**
 * Ordena transações cronologicamente de forma determinística e estável.
 * Utiliza 'date' como chave primária, desempatando por 'created_at' e depois por 'id' defensivamente.
 */
export function sortTransactionsStably(transactions: PortfolioTransaction[]): PortfolioTransaction[] {
  return [...transactions].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date)
    if (dateDiff !== 0) return dateDiff

    const createdDiff = (a.created_at || '').localeCompare(b.created_at || '')
    if (createdDiff !== 0) return createdDiff

    return (a.id || '').localeCompare(b.id || '')
  })
}

