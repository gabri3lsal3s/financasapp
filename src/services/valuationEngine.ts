import type {
  AssetPrice,
  PortfolioAssetDefinition,
  PortfolioTransaction,
  TargetAllocation,
} from '@/types'
import { calculateFixedIncomeValue, type IndexRateMap } from '@/utils/fixedIncomeValuation'
import { calculateGrossAndNetYield } from '@/utils/incomeTaxInvestment'
import { isB3TickerPattern } from '@/services/priceService'

export type ValuationSource = 'market' | 'fixed_income' | 'manual' | 'hybrid' | 'cash' | 'unavailable'

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
  asset_class?: string
  sector?: string
  pricing_mode: PortfolioAssetDefinition['pricing_mode']
  is_b3_linked: boolean
  valuation_source: ValuationSource
  quotation_status?: AssetPrice['quotation_status']
  gross_yield_pct: number
  net_yield_pct: number
  accumulated_dividends: number
}

interface PositionLedger {
  quantity: number
  totalCost: number
  accumulatedDividends: number
}

function defaultDefinition(ticker: string): PortfolioAssetDefinition {
  const upper = ticker.toUpperCase()
  const isLegacyCash = upper === 'SALDO_INV' || upper === 'CAIXA'
  const isB3 = isB3TickerPattern(upper)
  return {
    id: '',
    portfolio_id: '',
    ticker: upper,
    pricing_mode: isLegacyCash ? 'cash' : 'market',
    is_b3_linked: isB3,
    applied_amount: null,
    contract_rate: null,
    indexer: 'none',
    indexer_percent: 100,
    maturity_date: null,
    manual_current_value: null,
    manual_value_updated_at: null,
    tax_exempt: false,
    is_treasury: false,
    application_date: null,
    created_at: '',
    updated_at: '',
  }
}

function buildPositionLedger(transactions: PortfolioTransaction[]): Record<string, PositionLedger> {
  const map: Record<string, PositionLedger> = {}
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sorted) {
    const ticker = tx.ticker.toUpperCase()
    if (!map[ticker]) {
      map[ticker] = { quantity: 0, totalCost: 0, accumulatedDividends: 0 }
    }
    const pos = map[ticker]
    const qty = Number(tx.quantity)
    const price = Number(tx.price)

    if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
      pos.quantity += qty
      pos.totalCost += qty * price
    } else if (tx.operation_type === 'sell') {
      if (pos.quantity > 0) {
        const avg = pos.totalCost / pos.quantity
        pos.quantity = Math.max(0, pos.quantity - qty)
        pos.totalCost = pos.quantity * avg
      }
    } else if (tx.operation_type === 'dividend') {
      pos.accumulatedDividends += qty * price
      pos.totalCost = Math.max(0, pos.totalCost - qty * price)
    } else if (tx.operation_type === 'split') {
      pos.quantity *= qty
    }
  }

  return map
}

function netInvestedFromLedger(ledger: PositionLedger): number {
  return Math.max(0, ledger.totalCost)
}

function resolveApplicationDate(
  definition: PortfolioAssetDefinition,
  transactions: PortfolioTransaction[],
  ticker: string
): string {
  if (definition.application_date) return definition.application_date
  const buys = transactions
    .filter((t) => t.ticker.toUpperCase() === ticker && (t.operation_type === 'buy' || t.operation_type === 'subscription'))
    .sort((a, b) => a.date.localeCompare(b.date))
  return buys[0]?.date ?? new Date().toISOString().slice(0, 10)
}

function resolveCostBasis(
  definition: PortfolioAssetDefinition,
  ledger: PositionLedger
): number {
  if (definition.pricing_mode === 'cash') {
    return netInvestedFromLedger(ledger)
  }
  if (ledger.quantity <= 0) {
    return 0
  }
  if (definition.applied_amount !== null && definition.applied_amount > 0) {
    return definition.applied_amount
  }
  return netInvestedFromLedger(ledger)
}

function isMarketQuoteFresh(price?: AssetPrice): boolean {
  if (!price) return false
  if (price.quotation_status === 'live' || price.quotation_status === 'stale') {
    return price.current_price > 0
  }
  return price.current_price > 0 && price.quotation_status !== 'unavailable'
}

function valueMarketPosition(
  ledger: PositionLedger,
  price?: AssetPrice,
  fallbackPrice = 0
): { currentValue: number; unitPrice: number; source: ValuationSource; quotationStatus?: AssetPrice['quotation_status'] } {
  const unitPrice = price?.current_price ?? fallbackPrice
  if (ledger.quantity <= 0) {
    return { currentValue: 0, unitPrice, source: 'unavailable', quotationStatus: price?.quotation_status }
  }
  if (unitPrice <= 0) {
    return { currentValue: 0, unitPrice: 0, source: 'unavailable', quotationStatus: 'unavailable' }
  }
  return {
    currentValue: ledger.quantity * unitPrice,
    unitPrice,
    source: 'market',
    quotationStatus: price?.quotation_status ?? 'live',
  }
}

function valueTreasuryHybrid(
  definition: PortfolioAssetDefinition,
  ledger: PositionLedger,
  price: AssetPrice | undefined,
  fallbackPrice: number,
  indexRates: IndexRateMap,
  asOfDate: string,
  applicationDate: string,
  costBasis: number
): { currentValue: number; unitPrice: number; source: ValuationSource; quotationStatus?: AssetPrice['quotation_status'] } {
  const market = valueMarketPosition(ledger, price, fallbackPrice)
  const theoretical = calculateFixedIncomeValue({
    principal: costBasis,
    contractRateAnnual: definition.contract_rate,
    indexer: definition.indexer,
    indexerPercent: definition.indexer_percent,
    applicationDate,
    asOfDate,
    indexRates,
  })

  if (definition.is_b3_linked && isMarketQuoteFresh(price) && market.currentValue > 0) {
    return market
  }

  if (theoretical > 0) {
    const unitPrice = ledger.quantity > 0 ? theoretical / ledger.quantity : theoretical
    return {
      currentValue: theoretical,
      unitPrice,
      source: 'hybrid',
      quotationStatus: price?.quotation_status ?? 'manual',
    }
  }

  return market
}

export interface PortfolioValuationInput {
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
  targets: TargetAllocation[]
  prices: Record<string, AssetPrice>
  cashBalance: number
  indexRatesByIndexer: Record<string, IndexRateMap>
  asOfDate?: string
  fallbackPrice?: (ticker: string) => number
}

export interface PortfolioValuationResult {
  positions: ValuedPosition[]
  assetsValue: number
  totalValue: number
  cashBalance: number
}

export function calculatePortfolioValuation(input: PortfolioValuationInput): PortfolioValuationResult {
  const {
    transactions,
    definitions,
    targets,
    prices,
    cashBalance,
    indexRatesByIndexer,
    asOfDate = new Date().toISOString().slice(0, 10),
    fallbackPrice = () => 0,
  } = input

  const ledgerMap = buildPositionLedger(transactions)
  const definitionMap = Object.fromEntries(
    definitions.map((d) => [d.ticker.toUpperCase(), d])
  )

  const tickers = new Set<string>([
    ...Object.keys(ledgerMap),
    ...definitions.map((d) => d.ticker.toUpperCase()),
  ])

  const tempPositions: Omit<
    ValuedPosition,
    'current_percentage' | 'gap_financial' | 'gap_percentage'
  >[] = []

  let assetsValue = 0

  for (const ticker of tickers) {
    const ledger = ledgerMap[ticker] ?? { quantity: 0, totalCost: 0, accumulatedDividends: 0 }
    const definition = definitionMap[ticker] ?? defaultDefinition(ticker)
    const priceObj = prices[ticker]
    const target = targets.find((t) => t.ticker.toUpperCase() === ticker)
    const targetPct = target ? Number(target.target_percentage) : 0
    const applicationDate = resolveApplicationDate(definition, transactions, ticker)
    const costBasis = resolveCostBasis(definition, ledger)
    const indexRates = indexRatesByIndexer[definition.indexer] ?? {}

    let currentValue = 0
    let unitPrice = 0
    let valuationSource: ValuationSource = 'unavailable'
    let quotationStatus = priceObj?.quotation_status

    if (definition.pricing_mode === 'fixed_income') {
      currentValue = ledger.quantity > 0 ? calculateFixedIncomeValue({
        principal: costBasis,
        contractRateAnnual: definition.contract_rate,
        indexer: definition.indexer,
        indexerPercent: definition.indexer_percent,
        applicationDate,
        asOfDate,
        indexRates,
      }) : 0
      unitPrice = ledger.quantity > 0 ? currentValue / ledger.quantity : 0
      valuationSource = 'fixed_income'
      quotationStatus = 'manual'
    } else if (definition.pricing_mode === 'manual_value') {
      currentValue = ledger.quantity > 0 ? (definition.manual_current_value ?? costBasis) : 0
      unitPrice = ledger.quantity > 0 ? currentValue / ledger.quantity : 0
      valuationSource = 'manual'
      quotationStatus = 'manual'
    } else if (definition.pricing_mode === 'cash') {
      currentValue = costBasis
      unitPrice = currentValue
      valuationSource = 'cash'
      quotationStatus = 'manual'
    } else if (definition.is_treasury) {
      const treasuryVal = valueTreasuryHybrid(
        definition,
        ledger,
        priceObj,
        fallbackPrice(ticker),
        indexRates,
        asOfDate,
        applicationDate,
        costBasis
      )
      currentValue = treasuryVal.currentValue
      unitPrice = treasuryVal.unitPrice
      valuationSource = treasuryVal.source
      quotationStatus = treasuryVal.quotationStatus
    } else {
      const marketVal = valueMarketPosition(ledger, priceObj, fallbackPrice(ticker))
      currentValue = marketVal.currentValue
      unitPrice = marketVal.unitPrice
      valuationSource = marketVal.source
      quotationStatus = marketVal.quotationStatus
    }

    if (currentValue <= 0 && costBasis <= 0 && ledger.quantity <= 0) continue

    const taxResult =
      definition.pricing_mode === 'cash'
        ? { grossGain: 0, netGain: 0, grossYieldPct: 0, netYieldPct: 0, irRate: 0 }
        : calculateGrossAndNetYield(costBasisOrFallback(costBasis, ledger), currentValue, {
            applicationDate,
            asOfDate,
            taxExempt: definition.tax_exempt,
            pricingMode: definition.pricing_mode,
          })

    assetsValue += currentValue

    const isCash = definition.pricing_mode === 'cash'

    tempPositions.push({
      ticker,
      quantity: isCash ? 1 : ledger.quantity,
      average_price: isCash
        ? Math.round(currentValue * 100) / 100
        : ledger.quantity > 0
          ? Math.round((costBasis / ledger.quantity) * 100) / 100
          : costBasis,
      current_price: Math.round(unitPrice * 100) / 100,
      total_value: Math.round(currentValue * 100) / 100,
      cost_basis: Math.round(costBasis * 100) / 100,
      target_percentage: targetPct,
      asset_class: definition.pricing_mode === 'cash' ? 'Saldo em caixa' : priceObj?.asset_class,
      sector: definition.pricing_mode === 'cash' ? 'Caixa' : priceObj?.sector,
      pricing_mode: definition.pricing_mode,
      is_b3_linked: definition.is_b3_linked,
      valuation_source: valuationSource,
      quotation_status: quotationStatus,
      gross_yield_pct: taxResult.grossYieldPct,
      net_yield_pct: taxResult.netYieldPct,
      accumulated_dividends: Math.round(ledger.accumulatedDividends * 100) / 100,
    })
  }

  const totalValue = assetsValue + cashBalance

  const positions: ValuedPosition[] = tempPositions.map((pos) => {
    const currentPercentage = totalValue > 0 ? (pos.total_value / totalValue) * 100 : 0
    const targetValue = (pos.target_percentage / 100) * totalValue
    const gapFinancial = targetValue - pos.total_value

    return {
      ...pos,
      current_percentage: Math.round(currentPercentage * 100) / 100,
      gap_financial: Math.round(gapFinancial * 100) / 100,
      gap_percentage: Math.round((pos.target_percentage - currentPercentage) * 100) / 100,
    }
  })

  return {
    positions,
    assetsValue: Math.round(assetsValue * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
    cashBalance,
  }
}

function costBasisOrFallback(costBasis: number, ledger: PositionLedger): number {
  if (costBasis > 0) return costBasis
  return netInvestedFromLedger(ledger)
}