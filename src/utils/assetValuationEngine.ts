import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'
import { calculateLotBasedFixedIncomeValue } from './fixedIncomeCurve'
import { sortTransactionsStably } from './portfolioOperations'

function interpolatePriceCurve(
  asOfDate: string,
  points: Array<{ date: string; price: number }>
): number {
  if (points.length === 0) return 0
  if (points.length === 1 || asOfDate <= points[0].date) return points[0].price
  if (asOfDate >= points[points.length - 1].date) return points[points.length - 1].price

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    if (asOfDate >= p1.date && asOfDate <= p2.date) {
      const t1 = new Date(p1.date).getTime()
      const t2 = new Date(p2.date).getTime()
      const tc = new Date(asOfDate).getTime()
      if (t2 <= t1) return p2.price
      const fraction = (tc - t1) / (t2 - t1)
      return p1.price + fraction * (p2.price - p1.price)
    }
  }

  return points[points.length - 1].price
}

export interface AssetValuationResult {

  ticker: string
  quantity: number
  costBasis: number
  totalValue: number
  currentPrice: number
  pricingMode: string
}

export interface EvaluateAssetParams {
  ticker: string
  transactions: PortfolioTransaction[]
  definition?: PortfolioAssetDefinition
  asOfDate: string
  priceMap?: Record<string, Record<string, number>>
  pricesToday?: Record<string, number>
  indexRates?: Record<string, Record<string, number>>
  vnaMap?: Record<string, number>
  isCash?: boolean
}

/**
 * Avalia o valor e quantidade de uma posição de ativo em uma data específica asOfDate.
 */
export function evaluateAssetPositionAtDate(params: EvaluateAssetParams): AssetValuationResult {
  const {
    ticker,
    transactions,
    definition,
    asOfDate,
    priceMap = {},
    pricesToday = {},
    indexRates = {},
    vnaMap = {},
    isCash = false
  } = params

  const filteredTxs = transactions.filter(t => t.date <= asOfDate)
  const sortedTxs = sortTransactionsStably(filteredTxs)

  let quantity = 0
  let totalCost = 0

  for (const tx of sortedTxs) {
    const q = Number(tx.quantity)
    const p = Number(tx.price)
    const type = tx.operation_type

    if (type === 'buy' || type === 'subscription') {
      if (isCash) {
        totalCost += q * p
        quantity = totalCost
      } else {
        quantity += q
        totalCost += q * p
      }
    } else if (type === 'sell') {
      if (isCash) {
        totalCost = Math.max(0, totalCost - q * p)
        quantity = totalCost
      } else if (quantity > 0) {
        const pm = totalCost / quantity
        quantity = Math.max(0, quantity - q)
        totalCost = quantity * pm
      }
    } else if (type === 'split') {
      quantity += q
    } else if (type === 'reverse_split') {
      quantity = Math.max(0, quantity - q)
    }

  }

  if (quantity <= 0 && totalCost <= 0) {
    return {
      ticker,
      quantity: 0,
      costBasis: 0,
      totalValue: 0,
      currentPrice: 0,
      pricingMode: isCash ? 'cash' : (definition?.pricing_mode ?? 'market')
    }
  }

  const pricingMode = isCash ? 'cash' : (definition?.pricing_mode ?? 'market')
  let totalValue = 0
  let currentPrice = 0

  if (pricingMode === 'cash') {
    totalValue = totalCost
    currentPrice = 1.0
    quantity = totalCost
  } else if (pricingMode === 'manual_value') {
    // Curva de Rentabilidade para Ativos Manuais:
    // 1. Ponto Inicial: data do primeiro aporte com preço unitário de custo (costBasis / quantity).
    // 2. Pontos Intermediários: registros históricos de saldo/cotação presentes em priceMap (asset_price_daily).
    // 3. Ponto Final: data de atualização manual com preço unitário atual (manual_current_value / quantity).
    const startTxDate = sortedTxs[0]?.date ?? asOfDate
    const startPrice = quantity > 0 ? totalCost / quantity : 0

    const updatedAtStr = definition?.manual_value_updated_at
      ? definition.manual_value_updated_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    const hasManualVal = definition?.manual_current_value !== undefined &&
      definition?.manual_current_value !== null &&
      Number(definition.manual_current_value) > 0

    const endVal = hasManualVal ? Number(definition!.manual_current_value) : totalCost
    const endPrice = quantity > 0 ? endVal / quantity : startPrice

    const pointsMap = new Map<string, number>()

    // Ponto Inicial (Aporte / Custo)
    pointsMap.set(startTxDate, startPrice)

    // Pontos Intermediários (Registros Históricos)
    const tickerPrices = priceMap[ticker]
    if (tickerPrices) {
      for (const [d, p] of Object.entries(tickerPrices)) {
        if (p > 0 && d >= startTxDate && d <= updatedAtStr) {
          pointsMap.set(d, p)
        }
      }
    }

    // Ponto Final (Saldo Atualizado)
    pointsMap.set(updatedAtStr, endPrice)

    const sortedPoints = Array.from(pointsMap.entries())
      .map(([date, price]) => ({ date, price }))
      .sort((a, b) => a.date.localeCompare(b.date))

    currentPrice = interpolatePriceCurve(asOfDate, sortedPoints)
    totalValue = quantity * currentPrice
  } else if (pricingMode === 'fixed_income') {
    if (definition) {
      const idx = (definition.indexer ?? 'none').toLowerCase()
      const activeRates = indexRates[idx] ?? {}
      totalValue = calculateLotBasedFixedIncomeValue({
        transactions: sortedTxs,
        ticker,
        definition,
        asOfDate,
        indexRates: activeRates,
        vnaToday: vnaMap[asOfDate],
        vnaMap
      })
    } else {
      totalValue = totalCost
    }
    currentPrice = quantity > 0 ? totalValue / quantity : 0
  } else {
    // Posições de Mercado (Ações, FIIs, ETFs, BDRs ou Tesouro Curva se valuation_mode === 'curve')
    if (definition?.is_treasury && definition?.valuation_mode === 'curve') {
      const idx = (definition.indexer ?? 'none').toLowerCase()
      const activeRates = indexRates[idx] ?? {}
      totalValue = calculateLotBasedFixedIncomeValue({
        transactions: sortedTxs,
        ticker,
        definition,
        asOfDate,
        indexRates: activeRates,
        vnaToday: vnaMap[asOfDate],
        vnaMap
      })
      currentPrice = quantity > 0 ? totalValue / quantity : 0
    } else {
      const tickerPrices = priceMap[ticker]
      let dayPrice = 0

      if (tickerPrices && tickerPrices[asOfDate] !== undefined) {
        dayPrice = tickerPrices[asOfDate]
      } else if (tickerPrices) {
        const priceDates = Object.keys(tickerPrices).sort()
        let lastPrice = 0
        for (const pd of priceDates) {
          if (pd > asOfDate) break
          lastPrice = tickerPrices[pd]
        }
        dayPrice = lastPrice
      } else {
        dayPrice = pricesToday[ticker] ?? 0
      }

      currentPrice = dayPrice > 0 ? dayPrice : (quantity > 0 ? totalCost / quantity : 0)
      totalValue = quantity * currentPrice
    }
  }

  return {
    ticker,
    quantity,
    costBasis: totalCost,
    totalValue,
    currentPrice,
    pricingMode
  }
}
