import { describe, expect, it } from 'vitest'
import {
  findMatchingLegacyTransaction,
  isLegacyAssetInvestment,
  legacyInvestmentDate,
} from './legacyInvestmentMigration'
import type { PortfolioTransaction } from '@/types'

describe('legacyInvestmentMigration', () => {
  it('derives legacy date from month', () => {
    expect(
      legacyInvestmentDate({
        id: '1',
        month: '2026-05',
        amount: 1000,
        created_at: '2026-05-10T00:00:00.000Z',
      })
    ).toBe('2026-05-01')
  })

  it('detects asset legacy investment', () => {
    expect(
      isLegacyAssetInvestment({
        id: '1',
        month: '2026-05',
        amount: 1000,
        ticker: 'PETR4',
        quantity: 10,
        price: 35.5,
        created_at: '2026-05-10T00:00:00.000Z',
      })
    ).toBe(true)

    expect(
      isLegacyAssetInvestment({
        id: '1',
        month: '2026-05',
        amount: 1000,
        created_at: '2026-05-10T00:00:00.000Z',
      })
    ).toBe(false)
  })

  it('finds matching SALDO_INV transaction for cash legacy investment', () => {
    const existing: PortfolioTransaction[] = [
      {
        id: 'tx-1',
        portfolio_id: 'p1',
        ticker: 'SALDO_INV',
        operation_type: 'buy',
        quantity: 1,
        price: 1000,
        date: '2026-05-01',
      },
    ]

    const match = findMatchingLegacyTransaction(
      {
        id: 'inv-1',
        month: '2026-05',
        amount: 1000,
        created_at: '2026-05-10T00:00:00.000Z',
      },
      existing
    )

    expect(match?.id).toBe('tx-1')
  })
})
