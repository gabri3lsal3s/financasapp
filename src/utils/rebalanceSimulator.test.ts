import { describe, it, expect } from 'vitest'
import { simulateRebalanceAporte } from './rebalanceSimulator'
import type { ValuedPosition } from './portfolioCalculations'
import type { PortfolioGroupTarget } from '@/types'

describe('Rebalance Simulator - Simplificado por GAP', () => {
  const mockPositions: ValuedPosition[] = [
    {
      ticker: 'PETR4',
      quantity: 100,
      average_price: 30,
      current_price: 35,
      total_value: 3500,
      cost_basis: 3000,
      target_percentage: 20,
      current_percentage: 35,
      gap_financial: 0,
      gap_percentage: 0,
      asset_class: 'Ações Nacionais',
      sector: 'Petróleo',
      pricing_mode: 'market',
      is_b3_linked: false,
      gross_yield_pct: 16.67,
      net_yield_pct: 16.67,
      accumulated_dividends: 0,
      currency: 'BRL',
      usd_rate: 5.25
    },
    {
      ticker: 'VALE3',
      quantity: 50,
      average_price: 60,
      current_price: 60,
      total_value: 3000,
      cost_basis: 3000,
      target_percentage: 50,
      current_percentage: 30,
      gap_financial: 2000,
      gap_percentage: 20,
      asset_class: 'Ações Nacionais',
      sector: 'Mineração',
      pricing_mode: 'market',
      is_b3_linked: false,
      gross_yield_pct: 0,
      net_yield_pct: 0,
      accumulated_dividends: 0,
      currency: 'BRL',
      usd_rate: 5.25
    }
  ]

  const mockGroupTargets: PortfolioGroupTarget[] = [
    { portfolio_id: '1', group_type: 'class', group_name: 'Ações Nacionais', target_percentage: 70 }
  ]

  it('deve sugerir a compra do ativo que está abaixo da meta (GAP > 0)', () => {
    // Patrimônio atual: R$ 6500 (3500 PETR4 + 3000 VALE3 + 3500 caixa = total 10.000).
    // Aporte: R$ 1000. Total pós-aporte: R$ 11.000.
    // Meta VALE3: 50% de R$ 11.000 = R$ 5.500. Atualmente tem R$ 3.000. GAP = R$ 2.500.
    // VALE3 custa R$ 60 a ação. R$ 1000 / 60 = 16 cotas (R$ 960). Sobra R$ 40 em caixa.
    const res = simulateRebalanceAporte(mockPositions, mockGroupTargets, 10000, 1000)

    expect(res.suggestions.length).toBe(1)
    expect(res.suggestions[0].ticker).toBe('VALE3')
    expect(res.suggestions[0].quantity).toBe(16)
    expect(res.suggestions[0].totalBrl).toBe(960)
    expect(res.fallbackAmount).toBe(40)
  })

  it('retorna aporte integral em caixa se nenhuma posição possuir meta definida', () => {
    const noTargetPositions = mockPositions.map((p) => ({
      ...p,
      target_percentage: 0,
      gap_financial: 0
    }))
    const res = simulateRebalanceAporte(noTargetPositions, [], 10000, 1000)
    expect(res.suggestions.length).toBe(0)
    expect(res.fallbackAmount).toBe(1000)
  })
})
