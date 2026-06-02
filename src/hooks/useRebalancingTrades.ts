import { useMemo } from 'react'
import type { AssetPosition } from '@/services/investmentEngine'

export interface RebalancingTrade {
  ticker: string
  action: 'buy' | 'sell' | 'hold'
  amount: number
  shares: number
  currentPct: number
  targetPct: number
}

const DEFAULT_THRESHOLD_PCT = 1

/**
 * @param totalPortfolioValue Patrimônio total (ativos + caixa), mesmo denominador de `current_percentage` nas posições.
 */
export function useRebalancingTrades(
  positions: AssetPosition[],
  totalPortfolioValue: number,
  thresholdPct = DEFAULT_THRESHOLD_PCT,
): RebalancingTrade[] {
  return useMemo(() => {
    if (positions.length === 0 || totalPortfolioValue === 0) return []

    const trades: RebalancingTrade[] = []

    positions.forEach((pos) => {
      const diffPct = pos.target_percentage - pos.current_percentage
      const diffAmount = (diffPct / 100) * totalPortfolioValue
      const action = diffPct > thresholdPct ? 'buy' : diffPct < -thresholdPct ? 'sell' : 'hold'
      const price = pos.current_price > 0 ? pos.current_price : 50
      const shares = price > 0 ? Math.round(diffAmount / price) : 0

      if (action !== 'hold' && Math.abs(shares) > 0) {
        trades.push({
          ticker: pos.ticker,
          action,
          amount: Math.abs(diffAmount),
          shares: Math.abs(shares),
          currentPct: pos.current_percentage,
          targetPct: pos.target_percentage,
        })
      }
    })

    return trades.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [positions, totalPortfolioValue, thresholdPct])
}
