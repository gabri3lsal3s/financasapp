import { buildCombinedIndexRates } from '@/services/bcbIndexService'
import { loadVnaMap } from '@/services/vnaService'
import { getAssetPrices, detectDefaultCurrency } from '@/services/priceService'
import { calculatePositions } from '@/services/investmentEngine'
import type {
  AssetPrice,
  PortfolioAssetDefinition,
  PortfolioTransaction,
  TargetAllocation,
} from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'

export function normalizePortfolioDefinitions(
  definitions: PortfolioAssetDefinition[],
): PortfolioAssetDefinition[] {
  return definitions.map((d) => {
    const detectedCurrency = detectDefaultCurrency(d.ticker)
    const currency: 'BRL' | 'USD' = d.currency === 'USD' ? 'USD' : detectedCurrency
    return { ...d, currency }
  })
}

export function earliestApplicationDate(
  definitions: PortfolioAssetDefinition[],
  transactions: PortfolioTransaction[],
): string {
  const dates: string[] = []
  for (const def of definitions) {
    if (def.application_date) dates.push(def.application_date)
  }
  for (const tx of transactions) {
    if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
      dates.push(tx.date)
    }
  }
  if (dates.length === 0) return new Date().toISOString().slice(0, 10)
  return dates.sort()[0]
}

export function collectValuationTickers(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[],
  targets: TargetAllocation[] = [],
): string[] {
  return Array.from(
    new Set([
      ...transactions.map((t) => t.ticker.toUpperCase()),
      ...definitions.map((d) => d.ticker.toUpperCase()),
      ...targets.map((t) => t.ticker.toUpperCase()),
    ]),
  )
}

export function filterMarketTickers(
  tickers: string[],
  definitions: PortfolioAssetDefinition[],
): string[] {
  const marketTickers = tickers.filter((ticker) => {
    const def = definitions.find((d) => d.ticker.toUpperCase() === ticker)
    if (!def) return true
    return def.pricing_mode === 'market'
  })

  const hasUsdAssets =
    definitions.some((d) => d.currency === 'USD') ||
    tickers.some((t) => detectDefaultCurrency(t) === 'USD')

  if (hasUsdAssets && !marketTickers.includes('USDBRL=X')) {
    marketTickers.push('USDBRL=X')
  }

  return marketTickers
}

export interface BatchValuationContext {
  indexRatesByIndexer: Record<string, IndexRateMap>
  vnaMap: Record<string, number>
  prices: Record<string, AssetPrice>
  normalizedDefinitions: PortfolioAssetDefinition[]
}

export async function prepareBatchValuationContext(
  allDefinitions: PortfolioAssetDefinition[],
  allTransactions: PortfolioTransaction[],
  options?: { forceRefresh?: boolean; extraTickers?: string[] },
): Promise<BatchValuationContext> {
  const normalizedDefinitions = normalizePortfolioDefinitions(allDefinitions)
  const asOfDate = new Date().toISOString().slice(0, 10)
  const startDate = earliestApplicationDate(normalizedDefinitions, allTransactions)
  const indexers = normalizedDefinitions.map((d) => d.indexer)
  const indexRatesByIndexer = await buildCombinedIndexRates(indexers, startDate, asOfDate)
  const vnaMap = await loadVnaMap(startDate, asOfDate)

  const tickers = collectValuationTickers(
    allTransactions,
    normalizedDefinitions,
    [],
  )
  if (options?.extraTickers) {
    for (const t of options.extraTickers) {
      if (!tickers.includes(t.toUpperCase())) tickers.push(t.toUpperCase())
    }
  }

  const marketTickers = filterMarketTickers(tickers, normalizedDefinitions)
  const prices =
    marketTickers.length > 0
      ? await getAssetPrices(marketTickers, { forceRefresh: options?.forceRefresh })
      : {}

  return { indexRatesByIndexer, vnaMap, prices, normalizedDefinitions }
}

export function valuatePortfolioSync(input: {
  transactions: PortfolioTransaction[]
  targets: TargetAllocation[]
  definitions: PortfolioAssetDefinition[]
  cashBalance: number
  prices: Record<string, AssetPrice>
  indexRatesByIndexer: Record<string, IndexRateMap>
  vnaMap: Record<string, number>
}): ReturnType<typeof calculatePositions> {
  return calculatePositions(
    input.transactions,
    input.targets,
    input.prices,
    input.cashBalance,
    input.definitions,
    input.indexRatesByIndexer,
    input.vnaMap,
  )
}
