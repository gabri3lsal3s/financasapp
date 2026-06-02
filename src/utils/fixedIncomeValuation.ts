import { eachBusinessDayBetween, calendarDaysBetween } from '@/utils/businessDays'
import type { PortfolioAssetIndexer, PortfolioTransaction, PortfolioAssetDefinition } from '@/types'

export interface IndexRateMap {
  [date: string]: number
}

export interface FixedIncomeValuationInput {
  principal: number
  contractRateAnnual: number | null
  indexer: PortfolioAssetIndexer
  indexerPercent: number
  applicationDate: string
  asOfDate: string
  indexRates: IndexRateMap
}

function dailyRateFromAnnualPercent(annualPercent: number, businessDaysInYear = 252): number {
  const annualDecimal = annualPercent / 100
  return Math.pow(1 + annualDecimal, 1 / businessDaysInYear) - 1
}

function accumulatePostFixed(
  principal: number,
  businessDays: string[],
  _indexer: PortfolioAssetIndexer,
  indexerPercent: number,
  indexRates: IndexRateMap
): number {
  if (principal <= 0 || businessDays.length === 0) return principal

  let value = principal
  const factor = indexerPercent / 100

  for (const day of businessDays) {
    const rawRate = indexRates[day]
    if (rawRate === undefined || rawRate === null) continue
    const dailyDecimal = rawRate / 100
    value *= 1 + dailyDecimal * factor
  }

  return value
}

function accumulatePreFixed(
  principal: number,
  applicationDate: string,
  asOfDate: string,
  contractRateAnnual: number
): number {
  if (principal <= 0) return 0
  const days = calendarDaysBetween(applicationDate, asOfDate)
  const annualDecimal = contractRateAnnual / 100
  return principal * Math.pow(1 + annualDecimal, days / 365)
}

/**
 * Valor teórico de renda fixa (pré ou pós-fixada por dias úteis).
 */
export function calculateFixedIncomeValue(input: FixedIncomeValuationInput): number {
  const {
    principal,
    contractRateAnnual,
    indexer,
    indexerPercent,
    applicationDate,
    asOfDate,
    indexRates,
  } = input

  if (principal <= 0) return 0

  if (indexer !== 'none') {
    const businessDays = eachBusinessDayBetween(applicationDate, asOfDate)
    return Math.round(accumulatePostFixed(principal, businessDays, indexer, indexerPercent, indexRates) * 100) / 100
  }

  if (contractRateAnnual !== null && contractRateAnnual > 0) {
    return Math.round(accumulatePreFixed(principal, applicationDate, asOfDate, contractRateAnnual) * 100) / 100
  }

  return principal
}

/**
 * Calcula o valor teórico total de renda fixa (pré ou pós-fixada) lote por lote (FIFO),
 * considerando as diferentes taxas e datas acordadas em cada aporte individual.
 */
export function calculateLotBasedFixedIncomeValue({
  transactions,
  ticker,
  definition,
  asOfDate,
  indexRates,
}: {
  transactions: PortfolioTransaction[]
  ticker: string
  definition: PortfolioAssetDefinition
  asOfDate: string
  indexRates: IndexRateMap
}): number {
  const upperTicker = ticker.toUpperCase().trim()

  // 1. Filtra as operações de compra/subscrição para este ticker
  const buyLots = transactions
    .filter(
      (t) =>
        t.ticker.toUpperCase().trim() === upperTicker &&
        (t.operation_type === 'buy' || t.operation_type === 'subscription')
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      quantity: Number(t.quantity),
      price: Number(t.price),
      contract_rate: t.contract_rate !== undefined && t.contract_rate !== null ? Number(t.contract_rate) : null,
    }))

  // 2. Filtra as operações de venda
  const sales = transactions.filter(
    (t) => t.ticker.toUpperCase().trim() === upperTicker && t.operation_type === 'sell'
  )
  let totalQuantitySold = sales.reduce((sum, t) => sum + Number(t.quantity), 0)

  // 3. Aplica FIFO para reduzir as quantidades dos lotes de compra
  for (const lot of buyLots) {
    if (totalQuantitySold <= 0) break
    if (lot.quantity <= totalQuantitySold) {
      totalQuantitySold -= lot.quantity
      lot.quantity = 0
    } else {
      lot.quantity -= totalQuantitySold
      totalQuantitySold = 0
    }
  }

  // 4. Calcula o valor acumulado de cada lote ativo remanescente
  let totalTheoreticalValue = 0
  for (const lot of buyLots) {
    if (lot.quantity <= 0) continue
    const lotPrincipal = lot.quantity * lot.price
    const lotRate = lot.contract_rate !== null ? lot.contract_rate : definition.contract_rate
    const lotValue = calculateFixedIncomeValue({
      principal: lotPrincipal,
      contractRateAnnual: lotRate,
      indexer: definition.indexer,
      indexerPercent: definition.indexer_percent,
      applicationDate: lot.date,
      asOfDate,
      indexRates,
    })
    totalTheoreticalValue += lotValue
  }

  return totalTheoreticalValue
}

export { dailyRateFromAnnualPercent }
