import { supabase } from '@/lib/supabase'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'
import { ASSET_DEFINITION_SELECT } from '@/constants/portfolioPricingMode'
import {
  computeCashOffsetPreview,
  excludeCashOffsetSells,
  shouldApplyCashOffset,
  getPreferredCashTicker,
} from '@/utils/cashBalanceApplication'

const TRANSACTION_SELECT =
  'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at, cash_offset_source_id'

let hasCashOffsetColumn = true

export interface ApplyCashOffsetResult {
  cashUsed: number
  netContribution: number
}

export async function fetchPortfolioCashContext(portfolioId: string): Promise<{
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
}> {
  const querySelect = hasCashOffsetColumn
    ? TRANSACTION_SELECT
    : 'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at'

  const [txRes, defRes] = await Promise.all([
    supabase
      .from('portfolio_transactions')
      .select(querySelect)
      .eq('portfolio_id', portfolioId)
      .order('date', { ascending: true }),
    supabase
      .from('portfolio_asset_definitions')
      .select(ASSET_DEFINITION_SELECT)
      .eq('portfolio_id', portfolioId),
  ])

  if (hasCashOffsetColumn && txRes.error && (txRes.error.code === '42703' || String(txRes.error.message).includes('cash_offset_source_id'))) {
    console.warn('[cashOffsetService] Coluna cash_offset_source_id ausente no banco remoto. Re-consultando sem offset.')
    hasCashOffsetColumn = false
    const fallbackTxRes = await supabase
      .from('portfolio_transactions')
      .select('id, portfolio_id, ticker, operation_type, quantity, price, date, created_at')
      .eq('portfolio_id', portfolioId)
      .order('date', { ascending: true })

    return {
      transactions: (fallbackTxRes.data as PortfolioTransaction[]) || [],
      definitions: (defRes.data as PortfolioAssetDefinition[]) || [],
    }
  }

  return {
    transactions: (txRes.data as unknown as PortfolioTransaction[]) || [],
    definitions: (defRes.data as PortfolioAssetDefinition[]) || [],
  }
}

export async function deleteCashOffsetTransactions(portfolioId: string, sourceTransactionId: string): Promise<void> {
  if (!hasCashOffsetColumn) return

  const { error } = await supabase
    .from('portfolio_transactions')
    .delete()
    .eq('portfolio_id', portfolioId)
    .eq('cash_offset_source_id', sourceTransactionId)

  if (error) {
    if (error.code === '42703' || String(error.message).includes('cash_offset_source_id')) {
      hasCashOffsetColumn = false
      return
    }
    throw error
  }
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

  const rows = plan.sellTransactions.map((sell) => {
    const row: any = {
      portfolio_id: portfolioId,
      ticker: sell.ticker,
      operation_type: 'sell' as const,
      quantity: sell.quantity,
      price: sell.price,
      date: buyDate,
    }
    if (hasCashOffsetColumn) {
      row.cash_offset_source_id = sourceTransactionId
    }
    return row
  })

  const { error } = await supabase.from('portfolio_transactions').insert(rows)
  if (error) {
    if (hasCashOffsetColumn && (error.code === '42703' || String(error.message).includes('cash_offset_source_id'))) {
      hasCashOffsetColumn = false
      const fallbackRows = rows.map((r: any) => {
        const { cash_offset_source_id, ...rest } = r
        return rest
      })
      const { error: retryError } = await supabase.from('portfolio_transactions').insert(fallbackRows)
      if (retryError) throw retryError
    } else {
      throw error
    }
  }

  return { cashUsed: plan.cashUsed, netContribution: plan.netContribution }
}

/**
 * Após registrar venda/provento, credita saldo em caixa com compra automática.
 */
export async function applyCashOffsetAfterSellOrDividend(params: {
  portfolioId: string
  sourceTransactionId: string
  amount: number
  date: string
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
}): Promise<void> {
  const { portfolioId, sourceTransactionId, amount, date, transactions, definitions } = params
  if (amount <= 0) return

  const cashTicker = getPreferredCashTicker(transactions, definitions)

  const row: any = {
    portfolio_id: portfolioId,
    ticker: cashTicker,
    operation_type: 'buy' as const, // Depósito de caixa
    quantity: 1,
    price: amount,
    date,
  }
  if (hasCashOffsetColumn) {
    row.cash_offset_source_id = sourceTransactionId
  }

  const { error } = await supabase.from('portfolio_transactions').insert(row)
  if (error) {
    if (hasCashOffsetColumn && (error.code === '42703' || String(error.message).includes('cash_offset_source_id'))) {
      hasCashOffsetColumn = false
      const { cash_offset_source_id, ...fallbackRow } = row
      const { error: retryError } = await supabase.from('portfolio_transactions').insert(fallbackRow)
      if (retryError) throw retryError
    } else {
      throw error
    }
  }
}

/**
 * Ao salvar/editar qualquer transação, reconcilia os offsets de caixa vinculados.
 */
export async function reconcileCashOffsetOnTransactionSave(params: {
  portfolioId: string
  transactionId: string
  amount: number
  date: string
  assetPricingMode: PortfolioAssetDefinition['pricing_mode']
  operationType: PortfolioTransaction['operation_type']
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
}): Promise<ApplyCashOffsetResult> {
  const {
    portfolioId,
    transactionId,
    amount,
    date,
    assetPricingMode,
    operationType,
    transactions,
    definitions,
  } = params

  await deleteCashOffsetTransactions(portfolioId, transactionId)

  if (assetPricingMode === 'cash') {
    return { cashUsed: 0, netContribution: amount }
  }

  if (operationType === 'buy' || operationType === 'subscription') {
    if (!shouldApplyCashOffset(operationType, assetPricingMode)) {
      return { cashUsed: 0, netContribution: amount }
    }
    const cleanedTransactions = excludeCashOffsetSells(transactions, transactionId)
    return applyCashOffsetAfterBuy({
      portfolioId,
      sourceTransactionId: transactionId,
      buyAmount: amount,
      buyDate: date,
      assetPricingMode,
      operationType,
      transactions: cleanedTransactions,
      definitions,
    })
  } else if (operationType === 'sell' || operationType === 'dividend') {
    const cleanedTransactions = excludeCashOffsetSells(transactions, transactionId)
    await applyCashOffsetAfterSellOrDividend({
      portfolioId,
      sourceTransactionId: transactionId,
      amount,
      date,
      transactions: cleanedTransactions,
      definitions,
    })
  }

  return { cashUsed: 0, netContribution: amount }
}

// Para manter compatibilidade de exportações
export const reconcileCashOffsetOnBuyEdit = reconcileCashOffsetOnTransactionSave

