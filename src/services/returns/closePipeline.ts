import { supabase } from '@/lib/supabase'
import { calculateShareHistory, FALLBACK_PRICE } from '@/services/investmentEngine'
import { calculatePortfolioValuation } from '@/services/valuationEngine'
import { buildLotsFromTransactions, valueLot } from '@/services/returns/lotValuation'
import { calculateLotTaxProvision, sumNetPortfolioFromLots } from '@/services/returns/taxProvision'
import { loadVnaMap } from '@/services/vnaService'
import { loadHistoricalPrices } from '@/services/priceService'
import type {
  PortfolioAssetDefinition,
  PortfolioTransaction,
  TargetAllocation,
  AssetPrice,
} from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'

export interface DailyCloseInput {
  portfolioId: string
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
  targets: TargetAllocation[]
  prices: Record<string, AssetPrice>
  cashBalance: number
  indexRatesByIndexer: Record<string, IndexRateMap>
  asOfDate?: string
  fallbackPrice?: (ticker: string) => number
  vnaMap?: Record<string, number>
  historicalPrices?: Record<string, Record<string, number>>
}

export interface DailyCloseResult {
  portfolioId: string
  asOfDate: string
  grossPl: number
  netPl: number
  shareValue: number
  totalShares: number
  lotCount: number
}

/**
 * Fechamento diário da carteira (PL bruto/líquido + cota).
 * Contrato estável para migração futura a backend próprio — ver docs/ARCHITECTURE.md.
 */
export function computeDailyClose(
  input: DailyCloseInput & { asOfDate: string },
  vnaMap: Record<string, number>
): DailyCloseResult {
  const fallback = input.fallbackPrice ?? FALLBACK_PRICE

  const valuation = calculatePortfolioValuation({
    transactions: input.transactions,
    definitions: input.definitions,
    targets: input.targets,
    prices: input.prices,
    cashBalance: input.cashBalance,
    indexRatesByIndexer: input.indexRatesByIndexer,
    vnaMap,
    asOfDate: input.asOfDate,
    fallbackPrice: fallback,
  })

  const lots = buildLotsFromTransactions(input.transactions, input.definitions)
  const lotTaxes = lots.map((lot) => {
    const indexRates = input.indexRatesByIndexer[lot.definition.indexer] ?? {}
    const valued = valueLot(
      lot,
      input.asOfDate,
      input.prices,
      indexRates,
      vnaMap,
      fallback
    )
    return calculateLotTaxProvision(valued, input.asOfDate)
  })

  const { grossPl: lotsGross, netPl: lotsNet } = sumNetPortfolioFromLots(lotTaxes)
  const grossPl =
    lots.length > 0 ? lotsGross + valuation.cashValue : valuation.totalValue
  const netPl =
    lots.length > 0 ? lotsNet + valuation.cashValue : valuation.totalValue

  const shareResult = calculateShareHistory(
    input.transactions,
    input.prices,
    input.definitions,
    input.indexRatesByIndexer,
    input.historicalPrices ?? {},
    vnaMap
  )

  return {
    portfolioId: input.portfolioId,
    asOfDate: input.asOfDate,
    grossPl: Math.round(grossPl * 100) / 100,
    netPl: Math.round(netPl * 100) / 100,
    shareValue: shareResult.currentShareValue,
    totalShares: shareResult.totalShares,
    lotCount: lots.length,
  }
}

export async function runDailyClose(input: DailyCloseInput): Promise<DailyCloseResult> {
  const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10)
  const startDate =
    input.transactions
      .map((t) => t.date)
      .filter(Boolean)
      .sort()[0] ?? asOfDate
  const vnaMap = input.vnaMap ?? (await loadVnaMap(startDate, asOfDate))
  
  const tickers = Array.from(new Set(input.transactions.map((t) => t.ticker.toUpperCase())))
  const historicalPrices = input.historicalPrices ?? (await loadHistoricalPrices(tickers, startDate, asOfDate))
  
  return computeDailyClose({ ...input, asOfDate, historicalPrices }, vnaMap)
}

export async function persistDailyClose(result: DailyCloseResult): Promise<void> {
  await supabase.from('portfolio_share_daily').upsert(
    {
      portfolio_id: result.portfolioId,
      rate_date: result.asOfDate,
      share_value: result.shareValue,
      gross_pl: result.grossPl,
      net_pl: result.netPl,
      total_shares: result.totalShares,
    },
    { onConflict: 'portfolio_id,rate_date' }
  )

  await supabase
    .from('portfolios')
    .update({
      total_shares: result.totalShares,
      last_share_value: result.shareValue,
      last_close_date: result.asOfDate,
      last_gross_pl: result.grossPl,
      last_net_pl: result.netPl,
    })
    .eq('id', result.portfolioId)
}

export async function executeAndPersistDailyClose(
  input: DailyCloseInput
): Promise<DailyCloseResult> {
  const result = await runDailyClose(input)
  await persistDailyClose(result)
  return result
}
