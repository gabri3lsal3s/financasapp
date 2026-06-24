import type { PortfolioTransaction, PortfolioAssetDefinition, AssetPrice } from '@/types'
import { calculateLotBasedFixedIncomeValue } from './fixedIncomeCurve'
import { sortTransactionsStably } from './portfolioOperations'
import { isCashTicker, getAssetMetadata, detectDefaultCurrency } from './assetClassifier'

export interface ValuedPosition {
  ticker: string
  quantity: number
  average_price: number
  current_price: number
  total_value: number
  cost_basis: number
  target_percentage: number
  current_percentage: number
  gap_financial: number
  gap_percentage: number
  asset_class: string
  sector: string
  pricing_mode: string
  is_b3_linked: boolean
  gross_yield_pct: number
  net_yield_pct: number
  accumulated_dividends: number
  currency: 'BRL' | 'USD'
  usd_rate: number
}

// detectDefaultCurrency e getAssetMetadata agora vêm de assetClassifier.ts
// (fonte única de verdade para classificação de ativos)

/**
 * Provisão simplificada de IR sobre ganhos de investimentos.
 *
 * ATENÇÃO: Esta é uma aproximação para exibição informativa. Não substitui
 * o cálculo oficial do Imposto de Renda, que depende de:
 * - Compensação de prejuízos anteriores
 * - Alíquota mensal consolidada (não por ativo)
 * - Isenção de R$ 20k em vendas de ações no mês (não por posição)
 * - Regras específicas de day-trade
 * - IRRF retido na fonte (renda fixa já tem IR retido)
 *
 * @see https://www.gov.br/receitafederal para apuração oficial
 */
export function provisionIncomeTax(
  grossProfit: number,
  pricingMode: string,
  assetClass: string,
  asOfDate: string,
  applicationDate?: string
): number {
  if (grossProfit <= 0) return grossProfit

  if (pricingMode === 'fixed_income') {
    // Tabela regressiva de IR para renda fixa (quanto maior o prazo, menor o IR)
    const appDate = applicationDate || asOfDate
    const days = (new Date(asOfDate).getTime() - new Date(appDate).getTime()) / (1000 * 60 * 60 * 24)
    let irRate = 0.15
    if (days <= 180) irRate = 0.225
    else if (days <= 360) irRate = 0.20
    else if (days <= 720) irRate = 0.175
    return grossProfit * (1 - irRate)
  }

  if (pricingMode === 'market') {
    if (assetClass === 'Ações Nacionais') {
      // Nota: isenção real é de R$ 20k/mês em vendas totais, não por ativo.
      // Esta provisão aplica 15% apenas quando o ganho individual excede R$ 20k,
      // o que é uma simplificação.
      if (grossProfit > 20000) {
        return grossProfit * 0.85
      }
      return grossProfit // isento (provisionado)
    }
    if (assetClass === 'Fundos Imobiliários') {
      // FIIs: 20% sobre o ganho de capital
      return grossProfit * 0.80
    }
  }

  // Demais classes (ETF, internacional, cripto): sem provisão destacada
  return grossProfit
}

export function computePositions(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[],
  prices: Record<string, AssetPrice>,
  cashBalance: number,
  indexRates: Record<string, Record<string, number>> = {},
  vnaMap: Record<string, number> = {},
  asOfDate: string = new Date().toISOString().slice(0, 10)
): {
  positions: ValuedPosition[]
  investedValue: number
  cashValue: number
  totalValue: number
  investedCostBasis: number
} {
  const usdPriceObj = prices['USDBRL=X']
  const usdRate = usdPriceObj?.current_price && usdPriceObj.current_price > 0
    ? Number(usdPriceObj.current_price)
    : 5.25

  const sortedTransactions = sortTransactionsStably(transactions)

  // Agrupar transações por ticker
  const txByTicker: Record<string, PortfolioTransaction[]> = {}
  for (const tx of sortedTransactions) {
    const ticker = tx.ticker.trim().toUpperCase()
    if (!txByTicker[ticker]) {
      txByTicker[ticker] = []
    }
    txByTicker[ticker].push(tx)
  }

  // Mapear definições
  const defByTicker = Object.fromEntries(
    definitions.map((d) => [d.ticker.trim().toUpperCase(), d])
  )

  const tickers = new Set([
    ...Object.keys(txByTicker),
    ...Object.keys(defByTicker)
  ])

  const positions: Omit<ValuedPosition, 'current_percentage' | 'gap_financial' | 'gap_percentage'>[] = []
  let investedValue = 0
  let investedCostBasis = 0

  for (const ticker of tickers) {
    if (isCashTicker(ticker)) {
      continue
    }

    const txs = sortTransactionsStably(txByTicker[ticker] ?? [])
    const definition = defByTicker[ticker]

    let quantity = 0
    let totalCost = 0
    let accumulatedDividends = 0

    // Processar transações
    for (const tx of txs) {
      if (tx.date > asOfDate) continue

      const type = tx.operation_type
      const q = Number(tx.quantity)
      const p = Number(tx.price)

      if (type === 'buy' || type === 'subscription') {
        quantity += q
        totalCost += q * p
      } else if (type === 'sell') {
        if (quantity > 0) {
          const pm = totalCost / quantity
          quantity = Math.max(0, quantity - q)
          totalCost = quantity * pm
        }
      } else if (type === 'split') {
        quantity += q // split B3 é cotas adicionais
      } else if (type === 'reverse_split') {
        quantity = Math.max(0, quantity - q) // grupamento cancela cotas
      } else if (['dividend', 'jcp', 'fii_yield'].includes(type)) {
        accumulatedDividends += q * p
      }
    }

    if (quantity <= 0 && totalCost <= 0 && accumulatedDividends <= 0) {
      continue
    }

    // Identificar classificação
    const meta = getAssetMetadata(ticker)
    const assetClass = definition?.pricing_mode === 'cash' ? 'Saldo em Caixa'
      : (definition?.pricing_mode === 'fixed_income' || definition?.is_treasury) ? 'Renda Fixa'
      : prices[ticker]?.asset_class || meta.asset_class

    const sector = definition?.pricing_mode === 'cash' ? 'Caixa'
      : (definition?.pricing_mode === 'fixed_income' || definition?.is_treasury) ? 'Títulos Públicos/Privados'
      : prices[ticker]?.sector || meta.sector

    const currency = definition?.currency || detectDefaultCurrency(ticker)

    // Determinar preço atual e valoração
    let currentPrice = 0
    let totalValue = 0

    const pricingMode = definition?.pricing_mode ?? 'market'

    if (pricingMode === 'fixed_income') {
      const idx = definition?.indexer ?? 'none'
      const activeRates = indexRates[idx] ?? {}
      totalValue = calculateLotBasedFixedIncomeValue({
        transactions: txs,
        ticker,
        definition,
        asOfDate,
        indexRates: activeRates,
        vnaToday: idx === 'ipca' ? vnaMap[asOfDate] : undefined
      })
      currentPrice = quantity > 0 ? totalValue / quantity : 0
    } else if (pricingMode === 'manual_value') {
      totalValue = quantity > 0 ? (definition?.manual_current_value ?? totalCost) : 0
      currentPrice = quantity > 0 ? totalValue / quantity : 0
    } else if (pricingMode === 'cash') {
      totalValue = totalCost
      currentPrice = 1.0
      quantity = totalCost
    } else {
      currentPrice = prices[ticker]?.current_price ? Number(prices[ticker].current_price) : 0
      totalValue = quantity * currentPrice
    }

    const costBasis = totalCost
    const grossYield = totalValue - costBasis + accumulatedDividends
    const grossYieldPct = costBasis > 0 ? (grossYield / costBasis) * 100 : 0

    // Provisionar IR básico usando função extraída
    const appDateStr = definition?.application_date ?? (txs[0]?.date || asOfDate)
    const netYield = provisionIncomeTax(
      grossYield,
      pricingMode,
      assetClass,
      asOfDate,
      appDateStr
    )
    const netYieldPct = costBasis > 0 ? (netYield / costBasis) * 100 : 0

    const valueBrl = currency === 'USD' ? totalValue * usdRate : totalValue
    const costBasisBrl = currency === 'USD' ? costBasis * usdRate : costBasis

    if (pricingMode !== 'cash') {
      investedValue += valueBrl
      investedCostBasis += costBasisBrl
    }

    positions.push({
      ticker,
      quantity,
      average_price: quantity > 0 ? totalCost / quantity : 0,
      current_price: currentPrice,
      total_value: totalValue,
      cost_basis: costBasis,
      target_percentage: 0, // calculado depois
      asset_class: assetClass,
      sector,
      pricing_mode: pricingMode,
      is_b3_linked: definition?.is_b3_linked ?? false,
      gross_yield_pct: grossYieldPct,
      net_yield_pct: netYieldPct,
      accumulated_dividends: accumulatedDividends,
      currency,
      usd_rate: usdRate
    })
  }

  const finalCash = cashBalance
  const totalValue = investedValue + finalCash

  return {
    positions: positions.map(pos => {
      const valBrl = pos.currency === 'USD' ? pos.total_value * usdRate : pos.total_value
      const currentPct = totalValue > 0 ? (valBrl / totalValue) * 100 : 0
      return {
        ...pos,
        current_percentage: currentPct,
        target_percentage: 0,
        gap_financial: 0,
        gap_percentage: 0
      } as ValuedPosition
    }),
    investedValue,
    cashValue: finalCash,
    totalValue,
    investedCostBasis
  }
}
