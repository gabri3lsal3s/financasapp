import { supabase } from '@/lib/supabase'
import { calculatePositions } from '@/services/investmentEngine'
import type {
  AssetPrice,
  PortfolioAssetDefinition,
  PortfolioTransaction,
  TargetAllocation,
} from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'
import {
  normalizePortfolioDefinitions,
  prepareBatchValuationContext,
  valuatePortfolioSync,
} from '@/utils/portfolioValuationBatch'

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
  vnaMap?: Record<string, number>
}

export async function loadPortfolioValuation(
  portfolioId: string,
  transactions: PortfolioTransaction[],
  targets: TargetAllocation[],
  cashBalance: number,
  options?: { forceRefresh?: boolean },
): Promise<PortfolioValuationBundle> {
  const { data: definitionsData } = await supabase
    .from('portfolio_asset_definitions')
    .select(
      'id, portfolio_id, ticker, pricing_mode, is_b3_linked, applied_amount, contract_rate, indexer, indexer_percent, maturity_date, manual_current_value, manual_value_updated_at, tax_exempt, is_treasury, application_date, created_at, updated_at, currency, valuation_mode',
    )
    .eq('portfolio_id', portfolioId)

  const definitions = normalizePortfolioDefinitions(
    (definitionsData as PortfolioAssetDefinition[]) || [],
  )

  const batch = await prepareBatchValuationContext(definitions, transactions, options)

  const { positions, investedValue, cashValue, assetsValue, totalValue } = valuatePortfolioSync({
    transactions,
    targets,
    definitions: batch.normalizedDefinitions,
    cashBalance,
    prices: batch.prices,
    indexRatesByIndexer: batch.indexRatesByIndexer,
    vnaMap: batch.vnaMap,
  })

  return {
    positions,
    investedValue,
    cashValue,
    assetsValue,
    totalValue,
    cashBalance,
    prices: batch.prices,
    definitions: batch.normalizedDefinitions,
    indexRatesByIndexer: batch.indexRatesByIndexer,
    vnaMap: batch.vnaMap,
  }
}

export { prepareBatchValuationContext, valuatePortfolioSync, normalizePortfolioDefinitions }

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
