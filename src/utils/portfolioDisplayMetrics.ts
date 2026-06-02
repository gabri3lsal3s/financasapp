import type { AssetPosition } from '@/services/investmentEngine'

export interface PortfolioTotals {
  investedValue: number
  cashValue: number
  totalValue: number
}

export function totalsFromValuation(valuation: {
  investedValue: number
  cashValue: number
  totalValue: number
}): PortfolioTotals {
  return {
    investedValue: valuation.investedValue,
    cashValue: valuation.cashValue,
    totalValue: valuation.totalValue,
  }
}

export function positionValueInBrl(position: AssetPosition): number {
  const rate = position.usd_rate ?? 5.25
  return position.currency === 'USD' ? position.total_value * rate : position.total_value
}

export function positionCostInBrl(position: AssetPosition): number {
  const rate = position.usd_rate ?? 5.25
  return position.currency === 'USD' ? position.cost_basis * rate : position.cost_basis
}

/** Rentabilidade sobre ativos não-caixa (alinha com KPI da página Investimentos). */
export function nonCashPortfolioPerformance(
  positions: AssetPosition[],
  basis: 'gross' | 'net' = 'gross',
): {
  totalCostBrl: number
  totalCurrentBrl: number
  gainBrl: number
  yieldPct: number
} {
  const nonCash = positions.filter((p) => p.pricing_mode !== 'cash')
  let totalCostBrl = 0
  let totalCurrentBrl = 0

  for (const pos of nonCash) {
    totalCostBrl += positionCostInBrl(pos)
    totalCurrentBrl += positionValueInBrl(pos)
  }

  if (basis === 'net') {
    let netCurrent = 0
    for (const pos of nonCash) {
      const cost = positionCostInBrl(pos)
      const current = positionValueInBrl(pos)
      const netYield = pos.net_yield_pct / 100
      netCurrent += cost > 0 ? cost * (1 + netYield) : current
    }
    totalCurrentBrl = netCurrent
  }

  const gainBrl = totalCurrentBrl - totalCostBrl
  const yieldPct = totalCostBrl > 0 ? (gainBrl / totalCostBrl) * 100 : 0

  return {
    totalCostBrl,
    totalCurrentBrl,
    gainBrl,
    yieldPct,
  }
}

/** Patrimônio total em BRL a partir das posições (fallback quando não há bundle de valuation). */
export function totalValueFromPositions(positions: AssetPosition[]): number {
  return positions.reduce((sum, pos) => sum + positionValueInBrl(pos), 0)
}
