import type { PortfolioOperationType, PortfolioTransaction } from '@/types'
import { isPortfolioIncomeType } from '@/utils/portfolioOperations'
import { isCashTicker } from '@/utils/assetClassifier'
import { classifyB3Item } from '@/utils/b3ExcelParser'
import type { B3TransactionItem } from '@/utils/b3ExcelParser'

// ── Helpers ──

const dateDiffInDays = (left: string, right: string) => {
  const leftDate = new Date(`${left}T12:00:00`)
  const rightDate = new Date(`${right}T12:00:00`)
  if (isNaN(leftDate.getTime()) || isNaN(rightDate.getTime())) return 99

  const diffMs = Math.abs(leftDate.getTime() - rightDate.getTime())
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

const operationTypesCompatible = (
  official: PortfolioOperationType,
  existing: PortfolioOperationType
): boolean => {
  if (official === existing) return true
  if (isPortfolioIncomeType(official) && isPortfolioIncomeType(existing)) return true
  return false
}

// ── Scoring ──

/**
 * Calcula um score de similaridade (0..1) entre uma transação oficial B3
 * e uma transação existente no livro-razão.
 */
export const scoreInvestmentMatch = (
  official: B3TransactionItem,
  existing: PortfolioTransaction
): number => {
  const isOfficialFixed = classifyB3Item(official.ticker, official.product_name) === 'fixedIncome'
  const isExistingFixed =
    existing.ticker.toUpperCase().includes('CDB') ||
    existing.ticker.toUpperCase().includes('LCI') ||
    existing.ticker.toUpperCase().includes('LCA') ||
    existing.ticker.toUpperCase().includes('CRI') ||
    existing.ticker.toUpperCase().includes('CRA') ||
    existing.ticker.toUpperCase().includes('DEBENTURE')

  let tickerMatch =
    official.ticker.toUpperCase() === existing.ticker.toUpperCase()

  if (!tickerMatch && (isOfficialFixed || isExistingFixed)) {
    const cleanStr = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, ' ')
        .toUpperCase()
    const wordsOfficial = cleanStr(
      official.ticker + ' ' + (official.product_name || '')
    )
      .split(/\s+/)
      .filter((w) => w.length > 2)
    const wordsExisting = cleanStr(existing.ticker)
      .split(/\s+/)
      .filter((w) => w.length > 2)

    const common = wordsOfficial.filter(
      (w, idx) => wordsExisting.includes(w) && wordsOfficial.indexOf(w) === idx
    )
    const minWords = Math.min(wordsOfficial.length, wordsExisting.length)
    if (common.length >= 3 || (minWords > 0 && common.length / minWords >= 0.6)) {
      tickerMatch = true
    }
  }

  if (!tickerMatch) return 0
  if (!operationTypesCompatible(official.operation_type, existing.operation_type)) return 0

  const incomeTypeMismatch =
    official.operation_type !== existing.operation_type &&
    isPortfolioIncomeType(official.operation_type) &&
    isPortfolioIncomeType(existing.operation_type)

  const dateDiff = Math.abs(dateDiffInDays(official.date, existing.date))

  const maxDays = isPortfolioIncomeType(official.operation_type) ? 10 : 15
  if (dateDiff > maxDays) return 0

  const qtyDiff = Math.abs(official.quantity - existing.quantity)
  const priceDiff = Math.abs(official.price - existing.price)
  const totalOfficial = official.total_value || official.quantity * official.price
  const totalExisting = existing.quantity * existing.price
  const totalDiff = Math.abs(totalOfficial - totalExisting)

  const isExactDate = dateDiff === 0
  const isExactQty = qtyDiff < 0.0001
  const isExactPrice = priceDiff < 0.0001
  const isExactTotal = totalDiff < 0.01

  if (isExactDate && isExactQty && isExactPrice) {
    return incomeTypeMismatch ? 0.92 : 1.0
  }

  const dateScore = isExactDate
    ? 1.0
    : dateDiff <= 3
      ? 0.7
      : dateDiff <= 7
        ? 0.4
        : dateDiff <= 15
          ? 0.1
          : 0.0

  let valScore = 0.0
  if (isExactQty && isExactPrice) valScore = 1.0
  else if (isExactQty) valScore = 0.7
  else if (isExactPrice) valScore = 0.5
  else if (official.quantity > 0 && existing.quantity > 0) {
    const qtyPct = qtyDiff / official.quantity
    const pricePct = official.price > 0 ? priceDiff / official.price : 0
    if (qtyPct < 0.05 && pricePct < 0.05) valScore = 0.3
  }

  const totalScore = isExactTotal ? 1.0 : totalDiff < 1.0 ? 0.5 : 0.0

  let score = dateScore * 0.4 + valScore * 0.45 + totalScore * 0.15
  if (incomeTypeMismatch) score *= 0.9
  return score
}

// ── Interfaces ──

export interface InvestmentReconciliationConflict {
  official: B3TransactionItem
  existing: PortfolioTransaction
  score: number
  suggestedUpdate: {
    date: string
    quantity: number
    price: number
    operation_type: PortfolioOperationType
    needsUpdate: boolean
  }
}

export interface InvestmentReconciliationResult {
  matched: Array<{ official: B3TransactionItem; existing: PortfolioTransaction; score: number }>
  conflicts: InvestmentReconciliationConflict[]
  missing: B3TransactionItem[]
  existingOnly: PortfolioTransaction[]
}

// ── Reconciliation Engine ──

/**
 * Reconcilia transações oficiais do extrato B3 contra o livro-razão do sistema.
 * Retorna matched (exatas), conflicts (parciais que precisam de revisão),
 * missing (não encontradas) e existingOnly (presentes no sistema mas não no extrato).
 */
export const reconcileInvestmentTransactions = (
  officialItems: B3TransactionItem[],
  existingTransactions: PortfolioTransaction[]
): InvestmentReconciliationResult => {
  const usedExistingIds = new Set<string>()
  const matched: InvestmentReconciliationResult['matched'] = []
  const conflicts: InvestmentReconciliationResult['conflicts'] = []

  const candidates = existingTransactions.filter(
    (tx) => !isCashTicker(tx.ticker)
  )

  const matchedOfficialIds = new Set<string>()
  const passes = [1.0, 0.85, 0.7, 0.45]

  passes.forEach((minScore) => {
    officialItems.forEach((official) => {
      if (matchedOfficialIds.has(official.id)) return

      const scored = candidates
        .filter((existing) => !usedExistingIds.has(existing.id))
        .map((existing) => {
          const score = scoreInvestmentMatch(official, existing)
          return { existing, score }
        })
        .filter((candidate) => candidate.score >= minScore)
        .sort((a, b) => b.score - a.score)

      const best = scored[0]

      if (best) {
        usedExistingIds.add(best.existing.id)
        matchedOfficialIds.add(official.id)

        const isExact = best.score >= 0.999
        if (isExact) {
          matched.push({ official, existing: best.existing, score: best.score })
        } else {
          const needsUpdate =
            best.existing.date !== official.date ||
            Math.abs(best.existing.quantity - official.quantity) > 0.0001 ||
            Math.abs(best.existing.price - official.price) > 0.0001 ||
            best.existing.operation_type !== official.operation_type

          conflicts.push({
            official,
            existing: best.existing,
            score: best.score,
            suggestedUpdate: {
              date: official.date,
              quantity: official.quantity,
              price: official.price,
              operation_type: official.operation_type,
              needsUpdate,
            },
          })
        }
      }
    })
  })

  const missing = officialItems.filter(
    (official) => !matchedOfficialIds.has(official.id)
  )

  let existingOnly: PortfolioTransaction[] = []
  if (officialItems.length > 0) {
    const dates = officialItems.map((item) => item.date).sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]

    existingOnly = candidates.filter((tx) => {
      if (usedExistingIds.has(tx.id)) return false
      const dayDiffMin = dateDiffInDays(tx.date, minDate)
      const dayDiffMax = dateDiffInDays(tx.date, maxDate)

      const inWindow = tx.date >= minDate && tx.date <= maxDate
      const nearWindow =
        (tx.date < minDate && dayDiffMin <= 3) ||
        (tx.date > maxDate && dayDiffMax <= 3)

      return inWindow || nearWindow
    })
  }

  return {
    matched,
    conflicts,
    missing,
    existingOnly,
  }
}
