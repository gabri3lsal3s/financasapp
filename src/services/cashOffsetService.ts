import { supabase } from '@/lib/supabase'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'
import { isPortfolioIncomeType } from '@/utils/portfolioOperations'
import { ASSET_DEFINITION_SELECT } from '@/constants/portfolioPricingMode'
import {
  calculateLedgerCashBalance,
  computeCashOffsetPreview,
  excludeCashOffsetSells,
  shouldApplyCashOffset,
  getPreferredCashTicker,
} from '@/utils/cashBalanceApplication'

const TRANSACTION_SELECT =
  'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at, cash_offset_source_id'

let hasCashOffsetColumn = true

type PortfolioTransactionInsertRow = {
  portfolio_id: string
  ticker: string
  operation_type: 'sell' | 'buy'
  quantity: number
  price: number
  date: string
  cash_offset_source_id?: string
}

export interface ApplyCashOffsetResult {
  cashUsed: number
  netContribution: number
}

/**
 * Busca todas as transações de um portfolio de forma paginada para contornar
 * o limite server-side (max-rows) do PostgREST/Supabase que truncaria a resposta em 1000.
 */
export async function fetchAllPortfolioTransactions(
  portfolioId: string,
  options?: {
    select?: string
    orderField?: string
    ascending?: boolean
  }
): Promise<PortfolioTransaction[]> {
  const selectQuery = options?.select ?? '*'
  const orderField = options?.orderField ?? 'date'
  const ascending = options?.ascending ?? true

  let allTransactions: PortfolioTransaction[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('portfolio_transactions')
      .select(selectQuery)
      .eq('portfolio_id', portfolioId)
      .order(orderField, { ascending })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allTransactions = [...allTransactions, ...(data as unknown as PortfolioTransaction[])]
      if (data.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  return allTransactions
}

export async function fetchPortfolioCashContext(portfolioId: string): Promise<{
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
}> {
  const querySelect = hasCashOffsetColumn
    ? TRANSACTION_SELECT
    : 'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at'

  try {
    const [transactions, defRes] = await Promise.all([
      fetchAllPortfolioTransactions(portfolioId, { select: querySelect, orderField: 'date', ascending: true }),
      supabase
        .from('portfolio_asset_definitions')
        .select(ASSET_DEFINITION_SELECT)
        .eq('portfolio_id', portfolioId),
    ])

    return {
      transactions,
      definitions: (defRes.data as PortfolioAssetDefinition[]) || [],
    }
  } catch (err: unknown) {
    const pgError = err as { code?: string; message?: string }
    if (hasCashOffsetColumn && (pgError.code === '42703' || String(pgError.message).includes('cash_offset_source_id'))) {
      console.warn('[cashOffsetService] Coluna cash_offset_source_id ausente no banco remoto. Re-consultando sem offset.')
      hasCashOffsetColumn = false
      const [transactions, defRes] = await Promise.all([
        fetchAllPortfolioTransactions(portfolioId, {
          select: 'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at',
          orderField: 'date',
          ascending: true
        }),
        supabase
          .from('portfolio_asset_definitions')
          .select(ASSET_DEFINITION_SELECT)
          .eq('portfolio_id', portfolioId),
      ])

      return {
        transactions,
        definitions: (defRes.data as PortfolioAssetDefinition[]) || [],
      }
    }
    throw err
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

export async function deleteCashOffsetTransactionsMultiple(portfolioId: string, sourceTransactionIds: string[]): Promise<void> {
  if (!hasCashOffsetColumn || sourceTransactionIds.length === 0) return

  const CHUNK_SIZE = 100
  const chunks: string[][] = []
  for (let i = 0; i < sourceTransactionIds.length; i += CHUNK_SIZE) {
    chunks.push(sourceTransactionIds.slice(i, i + CHUNK_SIZE))
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      if (!hasCashOffsetColumn) return
      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('portfolio_id', portfolioId)
        .in('cash_offset_source_id', chunk)

      if (error) {
        if (error.code === '42703' || String(error.message).includes('cash_offset_source_id')) {
          hasCashOffsetColumn = false
          return
        }
        throw error
      }
    })
  )
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
    transactions.filter((t) => t.date <= buyDate),
    definitions
  )

  if (plan.sellTransactions.length === 0) {
    return { cashUsed: 0, netContribution: buyAmount }
  }

  const rows = plan.sellTransactions.map((sell) => {
    const row: PortfolioTransactionInsertRow = {
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
      const fallbackRows = rows.map((r: Record<string, unknown>) => {
        const { cash_offset_source_id: _cashOffsetSourceId, ...rest } = r
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

  const row: PortfolioTransactionInsertRow = {
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
      const { cash_offset_source_id: _cashOffsetSourceId, ...fallbackRow } = row
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
  } else if (operationType === 'sell' || isPortfolioIncomeType(operationType)) {
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

// ── Funções compartilhadas para fluxos de reconciliação em lote ──

/**
 * Recalcula o saldo de caixa do portfólio após um batch de operações.
 *
 * Se localTransactions/localDefinitions forem fornecidos, usa-os diretamente
 * (evitando uma reconsulta ao banco). Caso contrário, busca o contexto atual.
 */
export async function syncPortfolioCashAfterBatch(
  portfolioId: string,
  localTransactions?: PortfolioTransaction[],
  localDefinitions?: PortfolioAssetDefinition[],
): Promise<void> {
  let transactions: PortfolioTransaction[]
  let definitions: PortfolioAssetDefinition[]

  if (localTransactions && localDefinitions) {
    transactions = localTransactions
    definitions = localDefinitions
  } else {
    const context = await fetchPortfolioCashContext(portfolioId)
    transactions = context.transactions
    definitions = context.definitions
  }

  const finalLedgerCash = calculateLedgerCashBalance(transactions, definitions)

  const { error } = await supabase
    .from('portfolios')
    .update({ cash_balance: finalLedgerCash })
    .eq('id', portfolioId)

  if (error) throw error
}

/**
 * Insere transações de offset de caixa em lote, se houver.
 */
export async function insertOffsetsBatch(
  offsetsToInsert: any[],
): Promise<void> {
  if (offsetsToInsert.length === 0) return

  const { error } = await supabase.from('portfolio_transactions').insert(offsetsToInsert)
  if (error) throw error
}

// Para manter compatibilidade de exportações
export const reconcileCashOffsetOnBuyEdit = reconcileCashOffsetOnTransactionSave

