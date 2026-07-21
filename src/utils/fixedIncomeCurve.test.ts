import { describe, it, expect } from 'vitest'
import { countBusinessDays, annualToDailyRate, calculateFixedIncomeValue, calculateLotBasedFixedIncomeValue } from './fixedIncomeCurve'

describe('countBusinessDays', () => {
  it('counts weekends correctly', () => {
    // 2026-06-08 é segunda-feira, 2026-06-15 é segunda-feira seguinte
    // São 5 dias úteis (seg, ter, qua, qui, sex)
    expect(countBusinessDays('2026-06-08', '2026-06-15')).toBe(5)
  })

  it('returns 0 for same day or inverted dates', () => {
    expect(countBusinessDays('2026-06-08', '2026-06-08')).toBe(0)
    expect(countBusinessDays('2026-06-15', '2026-06-08')).toBe(0)
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
      applicationDate: '2026-06-08',
      asOfDate: '2026-06-15', // 5 dias úteis
      indexRates: {}
    })

    const dailyRate = Math.pow(1.10, 1/252) - 1
    const expected = 1000 * Math.pow(1 + dailyRate, 5)
    expect(val).toBeCloseTo(expected, 4)
  })

  it('calculates CDI compound value correctly', () => {
    // Taxa diária fixa simulada de 0.04% ao dia (aproximadamente 10.6% a.a.)
    const indexRates = {
      '2026-06-08': 0.0004,
      '2026-06-09': 0.0004,
      '2026-06-10': 0.0004,
      '2026-06-11': 0.0004,
      '2026-06-12': 0.0004,
    }

    const val = calculateFixedIncomeValue({
      principal: 1000,
      contractRateAnnual: 0,
      indexer: 'cdi',
      indexerPercent: 100,
      applicationDate: '2026-06-08',
      asOfDate: '2026-06-15', // 5 dias úteis
      indexRates
    })

    // 1000 * (1.0004)^5
    const expected = 1000 * Math.pow(1.0004, 5)
    expect(val).toBeCloseTo(expected, 4)
  })
})

describe('calculateLotBasedFixedIncomeValue', () => {
  it('calculates gross and net values with regressive IR per lot', () => {
    const transactions = [
      {
        id: 'tx-1',
        portfolio_id: 'port-1',
        ticker: 'CDB-TESTE',
        operation_type: 'buy' as const,
        quantity: 1,
        price: 1000,
        date: '2026-01-01',
      },
      {
        id: 'tx-2',
        portfolio_id: 'port-1',
        ticker: 'CDB-TESTE',
        operation_type: 'buy' as const,
        quantity: 1,
        price: 1000,
        date: '2026-06-01',
      }
    ]

    const definition = {
      id: 'def-1',
      portfolio_id: 'port-1',
      ticker: 'CDB-TESTE',
      asset_class: 'Renda Fixa',
      pricing_mode: 'fixed_income',
      indexer: 'none',
      contract_rate: 10,
      indexer_percent: 100,
    }

    const grossVal = calculateLotBasedFixedIncomeValue({
      transactions,
      ticker: 'CDB-TESTE',
      definition,
      asOfDate: '2027-01-15',
      indexRates: {}
    })

    const netVal = calculateLotBasedFixedIncomeValue({
      transactions,
      ticker: 'CDB-TESTE',
      definition,
      asOfDate: '2027-01-15',
      indexRates: {},
      returnNet: true
    })

    expect(grossVal).toBeGreaterThan(2000)
    expect(netVal).toBeLessThan(grossVal)
    expect(netVal).toBeGreaterThan(2000)
  })
})

describe('calculateFixedIncomeValue case-insensitivity', () => {
  it('calculates value case-insensitively for indexers like CDI or SELIC', () => {
    const indexRates = {
      '2026-06-08': 0.0004,
      '2026-06-09': 0.0004,
      '2026-06-10': 0.0004,
      '2026-06-11': 0.0004,
      '2026-06-12': 0.0004,
    }

    const valUpper = calculateFixedIncomeValue({
      principal: 1000,
      contractRateAnnual: 0,
      indexer: 'CDI',
      indexerPercent: 100,
      applicationDate: '2026-06-08',
      asOfDate: '2026-06-15',
      indexRates
    })

    const valLower = calculateFixedIncomeValue({
      principal: 1000,
      contractRateAnnual: 0,
      indexer: 'cdi',
      indexerPercent: 100,
      applicationDate: '2026-06-08',
      asOfDate: '2026-06-15',
      indexRates
    })

    expect(valUpper).toBe(valLower)
    expect(valUpper).toBeCloseTo(1000 * Math.pow(1.0004, 5), 4)
  })
})


