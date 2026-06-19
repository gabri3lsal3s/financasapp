import type {
  AssetPrice,
  PortfolioAssetDefinition,
  PortfolioTransaction,
} from '@/types'
import {
  calculateFixedIncomeValue,
  calculateLotBasedFixedIncomeValue,
  type IndexRateMap,
} from '@/utils/fixedIncomeValuation'
import { resolveVnaForDate } from '@/services/vnaService'
import { isPortfolioIncomeType, sortTransactionsStably } from '@/utils/portfolioOperations'
import { isTreasuryTicker } from '@/services/priceService'

export interface PositionLot {
  ticker: string
  purchaseDate: string
  quantity: number
  unitCost: number
  principal: number
  contractRate: number | null
  vnaAtPurchase: number | null
  definition: PortfolioAssetDefinition
}

export interface LotValuation {
  lot: PositionLot
  grossValue: number
  costBasis: number
  grossGain: number
}

export function buildLotsFromTransactions(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[]
): PositionLot[] {
  const defMap = Object.fromEntries(
    definitions.map((d) => [d.ticker.toUpperCase().trim(), d])
  )

  const buysByTicker = new Map<string, PositionLot[]>()

  const isLegacyCash = (ticker: string): boolean => {
    const upper = ticker.toUpperCase().trim()
    return upper === 'CAIXA' || upper === 'SALDO_INV' || upper === 'SALDO EM CAIXA' || upper === 'SALDO_EM_CAIXA'
  }

  const settled = sortTransactionsStably(
    transactions.filter((t) => {
      if ((t.settlement_status ?? 'settled') !== 'settled') return false
      const upper = t.ticker.toUpperCase().trim()
      const def = defMap[upper]
      const pricingMode = def?.pricing_mode ?? (isLegacyCash(upper) ? 'cash' : 'market')
      return pricingMode !== 'cash'
    })
  )

  for (const tx of settled) {
    const upper = tx.ticker.toUpperCase().trim()
    if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
      const isTr = isTreasuryTicker(upper)
      const def =
        defMap[upper] ??
        ({
          id: '',
          portfolio_id: tx.portfolio_id,
          ticker: upper,
          pricing_mode: isTr ? 'fixed_income' : 'market',
          is_b3_linked: isTr ? false : true,
          applied_amount: null,
          contract_rate: null,
          indexer: isTr
            ? upper.includes('SELIC') || upper.startsWith('LFT')
              ? 'selic'
              : upper.includes('IPCA') || upper.startsWith('NTN')
              ? 'ipca'
              : 'none'
            : 'none',
          indexer_percent: 100,
          maturity_date: null,
          manual_current_value: null,
          manual_value_updated_at: null,
          tax_exempt: false,
          is_treasury: isTr,
          application_date: null,
          created_at: '',
          updated_at: '',
          valuation_mode: isTr ? 'curve' : 'market',
        } satisfies PortfolioAssetDefinition)

      const qty = Number(tx.quantity)
      const price = Number(tx.price)
      const lot: PositionLot = {
        ticker: upper,
        purchaseDate: tx.date,
        quantity: qty,
        unitCost: price,
        principal: qty * price,
        contractRate:
          tx.contract_rate != null ? Number(tx.contract_rate) : def.contract_rate,
        vnaAtPurchase: tx.vna_at_purchase != null ? Number(tx.vna_at_purchase) : null,
        definition: def,
      }
      const list = buysByTicker.get(upper) ?? []
      list.push(lot)
      buysByTicker.set(upper, list)
    } else if (tx.operation_type === 'sell') {
      let remaining = Number(tx.quantity)
      const list = buysByTicker.get(upper) ?? []
      for (const lot of list) {
        if (remaining <= 0) break
        if (lot.quantity <= remaining) {
          remaining -= lot.quantity
          lot.quantity = 0
          lot.principal = 0
        } else {
          const ratio = remaining / lot.quantity
          lot.principal = Math.round(lot.principal * (1 - ratio) * 100) / 100
          lot.quantity -= remaining
          remaining = 0
        }
      }
    }
  }

  const lots: PositionLot[] = []
  for (const list of buysByTicker.values()) {
    for (const lot of list) {
      if (lot.quantity > 0) lots.push(lot)
    }
  }
  return lots
}

export function valueLot(
  lot: PositionLot,
  asOfDate: string,
  prices: Record<string, AssetPrice>,
  indexRates: IndexRateMap,
  vnaMap: Record<string, number>,
  fallbackPrice: (ticker: string) => number
): LotValuation {
  const { definition } = lot
  const costBasis = lot.principal
  let grossValue = costBasis

  if (definition.pricing_mode === 'cash') {
    grossValue = costBasis
  } else if (definition.pricing_mode === 'fixed_income' || definition.is_treasury) {
    const useCurve = true

    if (useCurve) {
      const vnaToday =
        definition.indexer === 'ipca'
          ? resolveVnaForDate(vnaMap, asOfDate)
          : undefined
      grossValue = calculateFixedIncomeValue({
        principal: costBasis,
        contractRateAnnual: lot.contractRate,
        indexer: definition.indexer,
        indexerPercent: definition.indexer_percent,
        applicationDate: lot.purchaseDate,
        asOfDate,
        indexRates,
        vnaAtPurchase: lot.vnaAtPurchase ?? undefined,
        vnaToday,
      })
    } else {
      const price = prices[lot.ticker]?.current_price ?? fallbackPrice(lot.ticker)
      grossValue = lot.quantity * price
    }
  } else if (definition.pricing_mode === 'manual_value') {
    grossValue =
      definition.manual_current_value != null
        ? definition.manual_current_value
        : costBasis
  } else {
    const price = prices[lot.ticker]?.current_price ?? fallbackPrice(lot.ticker)
    grossValue = lot.quantity * price
  }

  grossValue = Math.round(grossValue * 100) / 100
  const grossGain = Math.round((grossValue - costBasis) * 100) / 100

  return { lot, grossValue, costBasis, grossGain }
}

export function valueLotsForTicker(
  transactions: PortfolioTransaction[],
  ticker: string,
  definition: PortfolioAssetDefinition,
  asOfDate: string,
  indexRates: IndexRateMap,
  vnaToday?: number | null
): number {
  return calculateLotBasedFixedIncomeValue({
    transactions,
    ticker,
    definition,
    asOfDate,
    indexRates,
    vnaToday,
  })
}

export function sumDividendsForPortfolio(transactions: PortfolioTransaction[]): number {
  return transactions
    .filter((t) => isPortfolioIncomeType(t.operation_type))
    .reduce((sum, t) => sum + Number(t.quantity) * Number(t.price), 0)
}
