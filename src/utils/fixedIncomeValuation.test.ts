import { describe, it, expect } from 'vitest'
import { calculateFixedIncomeValue } from '@/utils/fixedIncomeValuation'

describe('fixedIncomeValuation', () => {
  it('calcula pré-fixado com base 365 dias corridos', () => {
    const value = calculateFixedIncomeValue({
      principal: 10000,
      contractRateAnnual: 12,
      indexer: 'none',
      indexerPercent: 100,
      applicationDate: '2025-01-01',
      asOfDate: '2026-01-01',
      indexRates: {},
    })

    expect(value).toBeGreaterThan(10000)
    expect(value).toBeLessThan(12000)
  })

  it('acumula pós-fixado com taxas diárias em dias úteis', () => {
    const indexRates: Record<string, number> = {
      '2025-01-02': 0.05,
      '2025-01-03': 0.05,
    }

    const value = calculateFixedIncomeValue({
      principal: 1000,
      contractRateAnnual: null,
      indexer: 'cdi',
      indexerPercent: 100,
      applicationDate: '2025-01-01',
      asOfDate: '2025-01-05',
      indexRates,
    })

    expect(value).toBeGreaterThan(1000)
  })
})
