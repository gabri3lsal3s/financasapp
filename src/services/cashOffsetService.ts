import { supabase } from '@/lib/supabase'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'
import { ASSET_DEFINITION_SELECT } from '@/constants/portfolioPricingMode'
import {
  computeCashOffsetPreview,
  excludeCashOffsetSells,
  shouldApplyCashOffset,
} from '@/utils/cashBalanceApplication'

const TRANSACTION_SELECT =
  'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at, cash_offset_source_id'

export interface ApplyCashOffsetResult {
  cashUsed: number
  netContribution: number
}

export async function fetchPortfolioCashContext(portfolioId: string): Promise<{
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
}> {
  const [txRes, defRes] = await Promise.all([
    supabase
      .from('portfolio_transactions')
      .select(TRANSACTION_SELECT)
      .eq('portfolio_id', portfolioId)
      .order('date', { ascending: true }),
    supabase
      .from('portfolio_asset_definitions')
      .select(ASSET_DEFINITION_SELECT)
      .eq('portfolio_id', portfolioId),
  ])

  return {
    transactions: (txRes.data as PortfolioTransaction[]) || [],
    definitions: (defRes.data as PortfolioAssetDefinition[]) || [],
  }
}

async function deleteCashOffsetSells(portfolioId: string, sourceTransactionId: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio_transactions')
    .delete()
    .eq('portfolio_id', portfolioId)
    .eq('cash_offset_source_id', sourceTransactionId)

  if (error) throw error
}

/**
 * Após registrar compra/subscrição, debita saldo em caixa com vendas automáticas.
 */
export async function applyCashOffsetAfterBuy(params: {
  portfolioId: string
  sourceTransactionId: string
  buyAmount: number
  buyDate: string
  assetPricingMode: PortfolioAssetDefinition['pricing_mode']
  operationType: PortfolioTransaction['operation_type']
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
}): Promise<ApplyCashOffsetResult> {
  const {
    portfolioId,
    sourceTransactionId,
    buyAmount,
    buyDate,
    assetPricingMode,
    operationType,
    transactions,
    definitions,
  } = params

  if (!shouldApplyCashOffset(operationType, assetPricingMode)) {
    return { cashUsed: 0, netContribution: buyAmount }
  }

  const plan = computeCashOffsetPreview(
    buyAmount,
    operationType,
    assetPricingMode,
    transactions,
    definitions
  )

  if (plan.sellTransactions.length === 0) {
    return { cashUsed: 0, netContribution: buyAmount }
  }

  const rows = plan.sellTransactions.map((sell) => ({
    portfolio_id: portfolioId,
    ticker: sell.ticker,
    operation_type: 'sell' as const,
    quantity: sell.quantity,
    price: sell.price,
    date: buyDate,
    cash_offset_source_id: sourceTransactionId,
  }))

  const { error } = await supabase.from('portfolio_transactions').insert(rows)
  if (error) throw error

  return { cashUsed: plan.cashUsed, netContribution: plan.netContribution }
}

/**
 * Ao editar compra/subscrição, remove vendas de caixa antigas e recalcula o offset.
 */
export async function reconcileCashOffsetOnBuyEdit(params: {
  portfolioId: string
  buyTransactionId: string
  buyAmount: number
  buyDate: string
  assetPricingMode: PortfolioAssetDefinition['pricing_mode']
  operationType: PortfolioTransaction['operation_type']
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
}): Promise<ApplyCashOffsetResult> {
  const {
    portfolioId,
    buyTransactionId,
    buyAmount,
    buyDate,
    assetPricingMode,
    operationType,
    transactions,
    definitions,
  } = params

  await deleteCashOffsetSells(portfolioId, buyTransactionId)

  if (!shouldApplyCashOffset(operationType, assetPricingMode)) {
    return { cashUsed: 0, netContribution: buyAmount }
  }

  const cleanedTransactions = excludeCashOffsetSells(transactions, buyTransactionId)

  return applyCashOffsetAfterBuy({
    portfolioId,
    sourceTransactionId: buyTransactionId,
    buyAmount,
    buyDate,
    assetPricingMode,
    operationType,
    transactions: cleanedTransactions,
    definitions,
  })
}
