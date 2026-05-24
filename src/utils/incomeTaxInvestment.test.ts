import { describe, it, expect } from 'vitest'
import {
  getRegressiveIrRate,
  calculateGrossAndNetYield,
  resolveIrRate,
} from '@/utils/incomeTaxInvestment'

describe('incomeTaxInvestment', () => {
  it('aplica faixas regressivas por dias corridos', () => {
    expect(getRegressiveIrRate(90)).toBe(0.225)
    expect(getRegressiveIrRate(200)).toBe(0.2)
    expect(getRegressiveIrRate(400)).toBe(0.175)
    expect(getRegressiveIrRate(800)).toBe(0.15)
  })

  it('isento quando taxExempt', () => {
    expect(
      resolveIrRate({
        grossGain: 1000,
        applicationDate: '2025-01-01',
        asOfDate: '2025-06-01',
        taxExempt: true,
        pricingMode: 'fixed_income',
      })
    ).toBe(0)
  })

  it('calcula rentabilidade bruta e líquida', () => {
    const result = calculateGrossAndNetYield(10000, 11000, {
      applicationDate: '2024-01-01',
      asOfDate: '2026-01-01',
      taxExempt: false,
      pricingMode: 'fixed_income',
    })

    expect(result.grossGain).toBe(1000)
    expect(result.grossYieldPct).toBe(10)
    expect(result.netGain).toBeLessThan(result.grossGain)
    expect(result.netYieldPct).toBeLessThan(result.grossYieldPct)
  })

  it('usa 15% para ativos de mercado', () => {
    const rate = resolveIrRate({
      grossGain: 500,
      applicationDate: '2024-01-01',
      asOfDate: '2026-01-01',
      taxExempt: false,
      pricingMode: 'market',
    })
    expect(rate).toBe(0.15)
  })

  it('não aplica IR em saldo em caixa', () => {
    expect(
      resolveIrRate({
        grossGain: 100,
        applicationDate: '2024-01-01',
        asOfDate: '2026-01-01',
        taxExempt: false,
        pricingMode: 'cash',
      })
    ).toBe(0)
  })
})
