import type { ValuedPosition } from './portfolioCalculations'
import type { PortfolioGroupTarget } from '@/types'

export interface RebalanceSuggestion {
  ticker: string
  quantity: number
  price: number
  totalBrl: number
  currency: 'BRL' | 'USD'
  currentPercentage: number
  newPercentage: number
  targetPercentage: number
  assetClass: string
}

export interface RebalanceResult {
  suggestions: RebalanceSuggestion[]
  fallbackAmount: number
}

/**
 * Simula a distribuição ideal de um aporte financeiro para rebalancear a carteira
 * com base nas metas de alocação de ativos ou classes macro.
 */
export function simulateRebalanceAporte(
  positions: ValuedPosition[],
  groupTargets: PortfolioGroupTarget[],
  totalValue: number,
  aporteAmount: number
): RebalanceResult {
  const suggestions: RebalanceSuggestion[] = []
  if (aporteAmount <= 0) {
    return { suggestions, fallbackAmount: 0 }
  }

  let remainingAporte = aporteAmount
  const newTotalPortfolioValue = totalValue + aporteAmount

  // Filtrar posições ativas que não sejam caixa puro
  const nonCashPositions = positions.filter((p) => p.pricing_mode !== 'cash')

  if (nonCashPositions.length === 0) {
    return { suggestions, fallbackAmount: remainingAporte }
  }

  // Mapear alvos de classe macro
  const classTargetsMap: Record<string, number> = {}
  for (const gt of groupTargets) {
    if (gt.group_type === 'class' && gt.target_percentage > 0) {
      classTargetsMap[gt.group_name.toLowerCase()] = Number(gt.target_percentage)
    }
  }

  // 1. Calcular para cada ativo a meta financeira ideal e a defasagem (GAP em R$)
  const assetGaps: Array<{
    position: ValuedPosition
    currentValBrl: number
    targetValBrl: number
    targetPct: number
    gapBrl: number
  }> = []

  for (const pos of nonCashPositions) {
    const currentValBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value

    // Meta percentual do próprio ativo (se definida) ou da sua classe macro
    let targetPct = pos.target_percentage || 0

    if (targetPct <= 0) {
      const clsNameLower = (pos.asset_class || '').toLowerCase()
      const classTargetPct = classTargetsMap[clsNameLower] || 0
      
      if (classTargetPct > 0) {
        // Quantos ativos da mesma classe existem sem target individual?
        const sameClassPositions = nonCashPositions.filter(
          (p) => (p.asset_class || '').toLowerCase() === clsNameLower && (p.target_percentage || 0) <= 0
        )
        const count = sameClassPositions.length || 1
        targetPct = classTargetPct / count
      }
    }

    const targetValBrl = (targetPct / 100) * newTotalPortfolioValue
    const gapBrl = Math.max(0, targetValBrl - currentValBrl)

    assetGaps.push({
      position: pos,
      currentValBrl,
      targetValBrl,
      targetPct,
      gapBrl
    })
  }

  // 2. Ordenar ativos com maior defasagem financeira primeiro
  const eligibleAssets = assetGaps
    .filter((item) => item.gapBrl > 0.01)
    .sort((a, b) => b.gapBrl - a.gapBrl)

  if (eligibleAssets.length === 0) {
    return { suggestions, fallbackAmount: remainingAporte }
  }

  // 3. Alocar orçamento para os ativos defasados
  for (const item of eligibleAssets) {
    if (remainingAporte <= 0.01) break

    const pos = item.position
    const priceBrl = pos.currency === 'USD' ? pos.current_price * pos.usd_rate : pos.current_price

    if (priceBrl <= 0) continue

    // Tentar cobrir o gap do ativo ou até onde o aporte permitir
    const budgetBrl = Math.min(remainingAporte, item.gapBrl)
    const quantity = Math.floor(budgetBrl / priceBrl)

    if (quantity > 0) {
      const costBrl = quantity * priceBrl
      remainingAporte -= costBrl

      const newCurrentValBrl = item.currentValBrl + costBrl
      const newPercentage = (newCurrentValBrl / newTotalPortfolioValue) * 100

      suggestions.push({
        ticker: pos.ticker,
        quantity,
        price: pos.current_price,
        totalBrl: Number(costBrl.toFixed(2)),
        currency: pos.currency,
        currentPercentage: pos.current_percentage,
        newPercentage: Number(newPercentage.toFixed(2)),
        targetPercentage: Number(item.targetPct.toFixed(2)),
        assetClass: pos.asset_class
      })
    }
  }

  return {
    suggestions,
    fallbackAmount: Number(remainingAporte.toFixed(2))
  }
}
