import { supabase } from '@/lib/supabase'
import { buildCombinedIndexRates } from '@/services/bcbIndexService'
import { getAssetPrices, detectDefaultCurrency } from '@/services/priceService'
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
  investedValue: number
  cashValue: number
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
      'id, portfolio_id, ticker, pricing_mode, is_b3_linked, applied_amount, contract_rate, indexer, indexer_percent, maturity_date, manual_current_value, manual_value_updated_at, tax_exempt, is_treasury, application_date, created_at, updated_at, currency'
    )
    .eq('portfolio_id', portfolioId)

  // Normaliza currency: o detectDefaultCurrency é a fonte de verdade para ativos
  // cujo ticker tem padrão USD claro (ex: VOO, AAPL). Ativos criados antes da migration
  // podem ter currency='BRL' no banco mesmo sendo USD — corrigimos no loader.
  const definitions: PortfolioAssetDefinition[] = ((definitionsData as PortfolioAssetDefinition[]) || []).map((d) => {
    const detectedCurrency = detectDefaultCurrency(d.ticker)
    // Se o banco tem 'BRL' mas o ticker claramente é USD, usa o detectado.
    // Se o banco tem 'USD' explícito, respeita (usuário configurou manualmente).
    const currency: 'BRL' | 'USD' = d.currency === 'USD' ? 'USD' : detectedCurrency
    return { ...d, currency }
  })
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
    return def.pricing_mode === 'market'
  })

  const hasUsdAssets = definitions.some(d => d.currency === 'USD') || tickers.some(t => detectDefaultCurrency(t) === 'USD')
  if (hasUsdAssets && !marketTickers.includes('USDBRL=X')) {
    marketTickers.push('USDBRL=X')
  }

  const prices = marketTickers.length > 0 ? await getAssetPrices(marketTickers, { forceRefresh: options?.forceRefresh }) : {}

  const { positions, investedValue, cashValue, assetsValue, totalValue } = calculatePositions(
    transactions,
    targets,
    prices,
    cashBalance,
    definitions,
    indexRatesByIndexer
  )

  return {
    positions,
    investedValue,
    cashValue,
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
