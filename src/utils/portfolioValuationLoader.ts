import { supabase } from '@/lib/supabase'
import { buildCombinedIndexRates } from '@/services/bcbIndexService'
import { getAssetPrices } from '@/services/priceService'
import { calculatePositions } from '@/services/investmentEngine'
import type {
  AssetPrice,
  PortfolioAssetDefinition,
  PortfolioTransaction,
  TargetAllocation,
} from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'

export interface PortfolioValuationBundle {
  positions: ReturnType<typeof calculatePositions>['positions']
  assetsValue: number
  totalValue: number
  cashBalance: number
  prices: Record<string, AssetPrice>
  definitions: PortfolioAssetDefinition[]
  indexRatesByIndexer: Record<string, IndexRateMap>
}

function earliestApplicationDate(
  definitions: PortfolioAssetDefinition[],
  transactions: PortfolioTransaction[]
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

export async function loadPortfolioValuation(
  portfolioId: string,
  transactions: PortfolioTransaction[],
  targets: TargetAllocation[],
  cashBalance: number,
  options?: { forceRefresh?: boolean }
): Promise<PortfolioValuationBundle> {
  const { data: definitionsData } = await supabase
    .from('portfolio_asset_definitions')
    .select(
      'id, portfolio_id, ticker, pricing_mode, is_b3_linked, applied_amount, contract_rate, indexer, indexer_percent, maturity_date, manual_current_value, manual_value_updated_at, tax_exempt, is_treasury, application_date, created_at, updated_at'
    )
    .eq('portfolio_id', portfolioId)

  const definitions = (definitionsData as PortfolioAssetDefinition[]) || []
  const tickers = Array.from(
    new Set([
      ...transactions.map((t) => t.ticker.toUpperCase()),
      ...definitions.map((d) => d.ticker.toUpperCase()),
    ])
  )

  const asOfDate = new Date().toISOString().slice(0, 10)
  const startDate = earliestApplicationDate(definitions, transactions)
  const indexers = definitions.map((d) => d.indexer)
  const indexRatesByIndexer = await buildCombinedIndexRates(indexers, startDate, asOfDate)

  const marketTickers = tickers.filter((ticker) => {
    const def = definitions.find((d) => d.ticker.toUpperCase() === ticker)
    if (!def) return true
    return def.pricing_mode === 'market' || def.is_treasury
  })

  const prices = marketTickers.length > 0 ? await getAssetPrices(marketTickers, { forceRefresh: options?.forceRefresh }) : {}

  const { positions, assetsValue, totalValue } = calculatePositions(
    transactions,
    targets,
    prices,
    cashBalance,
    definitions,
    indexRatesByIndexer
  )

  return {
    positions,
    assetsValue,
    totalValue,
    cashBalance,
    prices,
    definitions,
    indexRatesByIndexer,
  }
}

export function getAssetPricingBadgeLabel(position: {
  pricing_mode: string
  is_b3_linked: boolean
  valuation_source: string
  quotation_status?: string
}): string | null {
  if (position.pricing_mode === 'cash') return 'Saldo em caixa'
  if (position.pricing_mode === 'fixed_income') return 'Renda fixa (taxa)'
  if (position.pricing_mode === 'manual_value') return 'Valor manual'
  if (position.pricing_mode === 'market' && !position.is_b3_linked) return 'Sem vínculo B3'
  if (position.quotation_status === 'unavailable') return 'Sem cotação'
  if (position.quotation_status === 'stale') return 'Cotação desatualizada'
  if (position.valuation_source === 'hybrid') return 'Tesouro (híbrido)'
  return null
}
