import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'
import { buildPortfolioLedger } from '@/utils/portfolioLedger'
import type { B3TransactionItem } from '@/utils/b3ExcelParser'

// ── Types ──

export type PositionValidationStatus =
  | 'ok'
  | 'movements_official'
  | 'system_official'
  | 'movements_system'
  | 'all_differ'
  | 'ghost_system'
  | 'missing_everywhere'

export interface PositionValidationRow {
  ticker: string
  official: number
  fromMovements: number
  system: number
  status: PositionValidationStatus
  manualAction: string | null
}

export interface PositionValidationResult {
  rows: PositionValidationRow[]
  allOk: boolean
  mismatchCount: number
  nonEquityNote: string | null
}

export interface PositionAdjustmentSuggestion {
  ticker: string
  targetQty: number
  currentSystemQty: number
  quantity: number
  operation_type: 'buy' | 'sell'
  date: string
  price: number
  label: string
  requiresManualPrice?: boolean
}

export interface PositionAdjustmentOptions {
  asOfDate?: string
  definitions?: PortfolioAssetDefinition[]
  marketPrices?: Record<string, { current_price?: number }>
}

// ── Internal helpers ──

const qtyEqual = (a: number, b: number) => Math.abs(a - b) <= 0.0001

const buildManualAction = (
  row: Omit<PositionValidationRow, 'manualAction'>
): string | null => {
  switch (row.status) {
    case 'ok':
      return null
    case 'movements_official':
      return `O extrato de movimentação não reproduz a posição oficial de ${row.ticker}. Inclua um extrato mais antigo/completo ou cadastre manualmente os eventos faltantes (compras, vendas, desdobros, grupamentos).`
    case 'system_official':
      return `O livro-razão difere da posição B3 em ${row.ticker}. Revolva lançamentos faltantes, divergentes ou exclusivos do sistema nas etapas anteriores.`
    case 'movements_system':
      return `Movimentações e livro-razão divergem em ${row.ticker}, mas a posição oficial já confere com uma das fontes. Ajuste o lado inconsistente antes de concluir.`
    case 'all_differ':
      return `Três fontes diferentes para ${row.ticker}. Corrija o livro-razão, reimporte movimentações e confira desdobros/grupamentos registrados como cotas creditadas (não como multiplicador).`
    case 'ghost_system':
      return `${row.ticker} consta no livro-razão com saldo, mas não aparece na posição B3. Pode ser venda não registrada, ticker errado ou ativo já zerado na custódia — exclua ou corrija no livro-razão.`
    case 'missing_everywhere':
      return null
    default:
      return null
  }
}

const resolveAdjustmentDate = (
  transactions: PortfolioTransaction[],
  movementItems: B3TransactionItem[],
  ticker: string,
  fallback: string
): string => {
  const upper = ticker.toUpperCase()
  let maxDate = ''

  for (const tx of transactions) {
    if (tx.ticker.toUpperCase() !== upper || tx.cash_offset_source_id) continue
    if (tx.date > maxDate) maxDate = tx.date
  }
  for (const item of movementItems) {
    if (item.ticker.toUpperCase() !== upper) continue
    if (item.date > maxDate) maxDate = item.date
  }

  return maxDate || fallback
}

const resolveAdjustmentPrice = (
  transactions: PortfolioTransaction[],
  ticker: string,
  definitions?: PortfolioAssetDefinition[],
  marketPrices?: Record<string, { current_price?: number }>
): number => {
  const upper = ticker.toUpperCase()
  const relevant = transactions
    .filter(
      (tx) =>
        tx.ticker.toUpperCase() === upper &&
        !tx.cash_offset_source_id &&
        tx.price > 0 &&
        (tx.operation_type === 'buy' || tx.operation_type === 'sell')
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  if (relevant.length > 0) return relevant[0].price

  const anyPriced = transactions
    .filter((tx) => tx.ticker.toUpperCase() === upper && tx.price > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (anyPriced[0]?.price) return anyPriced[0].price

  const def = definitions?.find((d) => d.ticker.toUpperCase() === upper)
  if (def?.manual_current_value && def.manual_current_value > 0) {
    return def.manual_current_value
  }

  const market = marketPrices?.[upper]?.current_price
  if (market && market > 0) return market

  return 0
}

// ── Public API ──

/**
 * Cruza posição oficial, posição derivada das movimentações e livro-razão.
 */
export function buildPositionValidation(
  officialEquity: Record<string, number>,
  fromMovements: Record<string, number>,
  system: Record<string, number>
): PositionValidationResult {
  const tickers = new Set([
    ...Object.keys(officialEquity),
    ...Object.keys(fromMovements),
    ...Object.keys(system),
  ])

  const rows: PositionValidationRow[] = []

  for (const ticker of Array.from(tickers).sort()) {
    const official = officialEquity[ticker] ?? 0
    const movementQty = fromMovements[ticker] ?? 0
    const systemQty = system[ticker] ?? 0

    const hasOfficial = official > 0.000_001
    const hasMovements = movementQty > 0.000_001
    const hasSystem = systemQty > 0.000_001

    if (!hasOfficial && !hasMovements && !hasSystem) continue

    let status: PositionValidationStatus = 'ok'

    const officialMovements = qtyEqual(official, movementQty)
    const officialSystem = qtyEqual(official, systemQty)
    const movementsSystem = qtyEqual(movementQty, systemQty)

    if (officialMovements && officialSystem) {
      status = 'ok'
    } else if (!hasOfficial && hasSystem && !hasMovements) {
      status = 'ghost_system'
    } else if (!officialMovements && !officialSystem && !movementsSystem) {
      status = 'all_differ'
    } else if (!officialMovements && officialSystem) {
      status = 'movements_official'
    } else if (officialMovements && !officialSystem) {
      status = 'system_official'
    } else if (!movementsSystem) {
      status = 'movements_system'
    } else {
      status = 'all_differ'
    }

    const base = {
      ticker,
      official: hasOfficial ? official : 0,
      fromMovements: hasMovements ? movementQty : 0,
      system: hasSystem ? systemQty : 0,
      status,
    }
    rows.push({
      ...base,
      manualAction: buildManualAction(base),
    })
  }

  const mismatchCount = rows.filter((r) => r.status !== 'ok').length
  return {
    rows: rows.filter(
      (r) => r.official > 0 || r.fromMovements > 0 || r.system > 0
    ),
    allOk: mismatchCount === 0,
    mismatchCount,
    nonEquityNote: null,
  }
}

/** Ajustes de compra/venda para alinhar o livro-razão à posição oficial B3. */
export function suggestPositionAdjustments(
  validation: PositionValidationResult,
  transactions: PortfolioTransaction[],
  movementItems: B3TransactionItem[],
  options?: PositionAdjustmentOptions | string
): PositionAdjustmentSuggestion[] {
  const opts: PositionAdjustmentOptions =
    typeof options === 'string' ? { asOfDate: options } : options ?? {}
  const fallbackDate = opts.asOfDate ?? new Date().toISOString().slice(0, 10)

  return validation.rows
    .filter((row) => !qtyEqual(row.official, row.system))
    .map((row) => {
      const delta = row.official - row.system
      const operation_type = delta > 0 ? ('buy' as const) : ('sell' as const)
      const quantity =
        Math.round(Math.abs(delta) * 1_000_000) / 1_000_000
      const price = resolveAdjustmentPrice(
        transactions,
        row.ticker,
        opts.definitions,
        opts.marketPrices
      )
      const requiresManualPrice = price <= 0
      const date = resolveAdjustmentDate(
        transactions,
        movementItems,
        row.ticker,
        fallbackDate
      )
      const label =
        row.official <= 0.000_001
          ? `Zerar posição (vender ${row.system} cotas)`
          : delta > 0
            ? `Comprar ${quantity} cotas (sistema ${row.system} → B3 ${row.official})`
            : `Vender ${quantity} cotas (sistema ${row.system} → B3 ${row.official})`

      return {
        ticker: row.ticker,
        targetQty: row.official,
        currentSystemQty: row.system,
        quantity,
        operation_type,
        date,
        price,
        label,
        requiresManualPrice,
      }
    })
    .filter((s) => s.quantity > 0.000_001)
}

/** Posição por ticker após aplicar itens parseados (pré-visualização na conciliação). */
export function computePositionsFromB3Items(
  items: B3TransactionItem[]
): Record<string, number> {
  const transactions: PortfolioTransaction[] = items.map((item) => ({
    id: item.id,
    portfolio_id: '',
    ticker: item.ticker,
    operation_type: item.operation_type,
    quantity: item.quantity,
    price: item.price,
    date: item.date,
    created_at: '',
  }))
  const ledger = buildPortfolioLedger(transactions)
  const positions: Record<string, number> = {}
  for (const [ticker, entry] of Object.entries(ledger)) {
    if (entry.quantity > 0.000_001) {
      positions[ticker] =
        Math.round(entry.quantity * 1_000_000) / 1_000_000
    }
  }
  return positions
}
