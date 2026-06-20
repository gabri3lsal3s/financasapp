import { describe, it, expect } from 'vitest'
import { countBusinessDays, annualToDailyRate, calculateFixedIncomeValue } from './fixedIncomeCurve'

describe('countBusinessDays', () => {
  it('counts weekends correctly', () => {
    // 2026-06-01 é segunda-feira, 2026-06-08 é segunda-feira seguinte
    // São 5 dias úteis (seg, ter, qua, qui, sex)
    expect(countBusinessDays('2026-06-01', '2026-06-08')).toBe(5)
  })

  it('returns 0 for same day or inverted dates', () => {
    expect(countBusinessDays('2026-06-01', '2026-06-01')).toBe(0)
    expect(countBusinessDays('2026-06-08', '2026-06-01')).toBe(0)
  })
})

describe('annualToDailyRate', () => {
  it('converts annual rate to daily correctly', () => {
    const daily = annualToDailyRate(10.75) // 10.75% a.a.
    // (1 + daily)^252 - 1 deve ser igual a 0.1075
    const computedAnnual = Math.pow(1 + daily, 252) - 1
    expect(computedAnnual).toBeCloseTo(0.1075, 5)
  })
})

describe('calculateFixedIncomeValue', () => {
  it('calculates prefix value correctly', () => {
    const val = calculateFixedIncomeValue({
      principal: 1000,
      contractRateAnnual: 10.00, // 10% a.a.
      indexer: 'none',
      indexerPercent: 100,
      applicationDate: '2026-06-01',
      asOfDate: '2026-06-08', // 5 dias úteis
      indexRates: {}
    })

    const dailyRate = Math.pow(1.10, 1/252) - 1
    const expected = 1000 * Math.pow(1 + dailyRate, 5)
    expect(val).toBeCloseTo(expected, 4)
  })

  it('calculates CDI compound value correctly', () => {
    // Taxa diária fixa simulada de 0.04% ao dia (aproximadamente 10.6% a.a.)
    const indexRates = {
      '2026-06-01': 0.0004,
      '2026-06-02': 0.0004,
      '2026-06-03': 0.0004,
      '2026-06-04': 0.0004,
      '2026-06-05': 0.0004,
    }

    const val = calculateFixedIncomeValue({
      principal: 1000,
      contractRateAnnual: 0,
      indexer: 'cdi',
      indexerPercent: 100,
      applicationDate: '2026-06-01',
      asOfDate: '2026-06-08', // 5 dias úteis
      indexRates
    })

    // 1000 * (1.0004)^5
    const expected = 1000 * Math.pow(1.0004, 5)
    expect(val).toBeCloseTo(expected, 4)
  })
})
