/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRebalancingTrades } from '@/hooks/useRebalancingTrades'
import type { AssetPosition } from '@/services/investmentEngine'

const pos = (overrides: Partial<AssetPosition>): AssetPosition => ({
  ticker: 'PETR4',
  quantity: 10,
  average_price: 30,
  current_price: 40,
  total_value: 400,
  cost_basis: 300,
  target_percentage: 50,
  current_percentage: 25,
  gap_financial: 0,
  gap_percentage: 0,
  pricing_mode: 'market',
  is_b3_linked: true,
  valuation_source: 'market',
  gross_yield_pct: 0,
  net_yield_pct: 0,
  accumulated_dividends: 0,
  currency: 'BRL',
  ...overrides,
})

describe('useRebalancingTrades', () => {
  it('usa patrimônio total (inclui caixa) para calcular valor do trade', () => {
    const positions = [
      pos({ current_percentage: 25, target_percentage: 50 }),
      pos({
        ticker: 'CAIXA',
        pricing_mode: 'cash',
        total_value: 600,
        current_percentage: 75,
        target_percentage: 50,
        current_price: 600,
      }),
    ]

    const { result: wrongBase } = renderHook(() =>
      useRebalancingTrades(positions, 400),
    )
    const { result: correctBase } = renderHook(() =>
      useRebalancingTrades(positions, 1000),
    )

    const wrongBuy = wrongBase.current.find((t) => t.ticker === 'PETR4')
    const correctBuy = correctBase.current.find((t) => t.ticker === 'PETR4')

    expect(wrongBuy?.amount).toBe(100)
    expect(correctBuy?.amount).toBe(250)
  })
})
