import { describe, it, expect } from 'vitest'
import {
  nonCashPortfolioPerformance,
  positionValueInBrl,
  totalValueFromPositions,
} from '@/utils/portfolioDisplayMetrics'
import type { AssetPosition } from '@/services/investmentEngine'

const basePosition = (overrides: Partial<AssetPosition>): AssetPosition => ({
  ticker: 'PETR4',
  quantity: 10,
  average_price: 30,
  current_price: 40,
  total_value: 400,
  cost_basis: 300,
  target_percentage: 50,
  current_percentage: 40,
  gap_financial: 0,
  gap_percentage: 0,
  pricing_mode: 'market',
  is_b3_linked: true,
  valuation_source: 'market',
  gross_yield_pct: 33.33,
  net_yield_pct: 28,
  accumulated_dividends: 0,
  currency: 'BRL',
  ...overrides,
})

describe('portfolioDisplayMetrics', () => {
  it('totalValueFromPositions soma caixa e ativos em BRL', () => {
    const total = totalValueFromPositions([
      basePosition({ total_value: 400, pricing_mode: 'market' }),
      basePosition({ ticker: 'CAIXA', total_value: 1000, pricing_mode: 'cash', cost_basis: 1000 }),
    ])
    expect(total).toBe(1400)
  })

  it('positionValueInBrl converte USD', () => {
    const brl = positionValueInBrl(
      basePosition({ currency: 'USD', total_value: 100, usd_rate: 5 }),
    )
    expect(brl).toBe(500)
  })

  it('nonCashPortfolioPerformance ignora caixa', () => {
    const perf = nonCashPortfolioPerformance([
      basePosition({ cost_basis: 300, total_value: 400 }),
      basePosition({ ticker: 'CAIXA', pricing_mode: 'cash', total_value: 5000, cost_basis: 5000 }),
    ])
    expect(perf.totalCostBrl).toBe(300)
    expect(perf.totalCurrentBrl).toBe(400)
    expect(perf.yieldPct).toBeCloseTo(33.33, 1)
  })
})
