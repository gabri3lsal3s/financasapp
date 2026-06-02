import { describe, it, expect } from 'vitest'
import { calculateFixedIncomeValue } from '@/utils/fixedIncomeValuation'

describe('Tesouro IPCA+ com VNA', () => {
  it('aplica fator VNA_hoje / VNA_compra e taxa real em dias úteis', () => {
    const value = calculateFixedIncomeValue({
      principal: 10000,
      contractRateAnnual: 6,
      indexer: 'ipca',
      indexerPercent: 100,
      applicationDate: '2025-01-02',
      asOfDate: '2025-06-02',
      indexRates: {},
      vnaAtPurchase: 4000,
      vnaToday: 4100,
    })

    expect(value).toBeGreaterThan(10000)
    expect(value).toBeLessThan(12000)
  })
})
