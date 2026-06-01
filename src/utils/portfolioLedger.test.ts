import { describe, it, expect } from 'vitest'
import { buildPortfolioLedger, computeTickerQuantity } from './portfolioLedger'
import type { PortfolioTransaction } from '@/types'

function tx(
  overrides: Partial<PortfolioTransaction> & Pick<PortfolioTransaction, 'ticker' | 'operation_type' | 'quantity' | 'date'>
): PortfolioTransaction {
  return {
    id: '1',
    portfolio_id: 'p1',
    price: 10,
    created_at: '',
    ...overrides,
  }
}

describe('portfolioLedger', () => {
  it('desdobro soma cotas creditadas (não multiplica)', () => {
    const transactions: PortfolioTransaction[] = [
      tx({ date: '2024-01-01', ticker: 'BBAS3', operation_type: 'buy', quantity: 18, price: 50 }),
      tx({ date: '2024-04-17', ticker: 'BBAS3', operation_type: 'split', quantity: 12, price: 0 }),
    ]
    expect(computeTickerQuantity(transactions, 'BBAS3')).toBe(30)
  })

  it('desdobro com 10 + split 45 = 55 (não 10×45)', () => {
    const transactions: PortfolioTransaction[] = [
      tx({ date: '2023-11-01', ticker: 'GGRC11', operation_type: 'buy', quantity: 10, price: 9 }),
      tx({ date: '2024-03-07', ticker: 'GGRC11', operation_type: 'split', quantity: 45, price: 0 }),
    ]
    expect(computeTickerQuantity(transactions, 'GGRC11')).toBe(55)
  })

  it('BCFF11: compras + desdobro + venda por transferência → 0', () => {
    const transactions: PortfolioTransaction[] = [
      tx({ date: '2023-11-03', ticker: 'BCFF11', operation_type: 'buy', quantity: 1, price: 68.6 }),
      tx({ date: '2023-11-30', ticker: 'BCFF11', operation_type: 'split', quantity: 7, price: 0 }),
      tx({ date: '2023-12-18', ticker: 'BCFF11', operation_type: 'buy', quantity: 2, price: 8.69 }),
      tx({ date: '2024-02-16', ticker: 'BCFF11', operation_type: 'buy', quantity: 2, price: 9.07 }),
      tx({ date: '2024-03-04', ticker: 'BCFF11', operation_type: 'buy', quantity: 4, price: 9.04 }),
      tx({ date: '2024-03-18', ticker: 'BCFF11', operation_type: 'buy', quantity: 1, price: 9.09 }),
      tx({ date: '2024-04-16', ticker: 'BCFF11', operation_type: 'buy', quantity: 2, price: 9.11 }),
      tx({ date: '2024-04-29', ticker: 'BCFF11', operation_type: 'buy', quantity: 1, price: 8.99 }),
      tx({ date: '2024-07-18', ticker: 'BCFF11', operation_type: 'sell', quantity: 20, price: 0 }),
    ]
    expect(computeTickerQuantity(transactions, 'BCFF11')).toBe(0)
  })

  it('ALZM11: compras + desdobro + venda → 0', () => {
    const transactions: PortfolioTransaction[] = [
      tx({ date: '2023-11-30', ticker: 'ALZM11', operation_type: 'buy', quantity: 3, price: 85 }),
      tx({ date: '2024-01-02', ticker: 'ALZM11', operation_type: 'split', quantity: 27, price: 0 }),
      tx({ date: '2024-02-15', ticker: 'ALZM11', operation_type: 'buy', quantity: 5, price: 8.7 }),
      tx({ date: '2024-03-21', ticker: 'ALZM11', operation_type: 'buy', quantity: 3, price: 8.5 }),
      tx({ date: '2024-04-16', ticker: 'ALZM11', operation_type: 'buy', quantity: 2, price: 9.1 }),
      tx({ date: '2024-07-18', ticker: 'ALZM11', operation_type: 'sell', quantity: 40, price: 0 }),
    ]
    expect(computeTickerQuantity(transactions, 'ALZM11')).toBe(0)
  })

  it('reverse_split reduz cotas canceladas', () => {
    const transactions: PortfolioTransaction[] = [
      tx({ date: '2024-01-01', ticker: 'PETR4', operation_type: 'buy', quantity: 100, price: 30 }),
      tx({ date: '2024-06-01', ticker: 'PETR4', operation_type: 'reverse_split', quantity: 90, price: 0 }),
    ]
    expect(computeTickerQuantity(transactions, 'PETR4')).toBe(10)
  })

  it('buildPortfolioLedger agrupa por ticker', () => {
    const ledger = buildPortfolioLedger([
      tx({ date: '2024-01-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 40 }),
    ])
    expect(ledger.WEGE3?.quantity).toBe(10)
  })
})
