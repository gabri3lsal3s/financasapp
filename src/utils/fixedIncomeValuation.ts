import { countBusinessDaysBetween, eachBusinessDayBetween } from '@/utils/businessDays'
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
  /** VNA na data do aporte (Tesouro IPCA+). */
  vnaAtPurchase?: number | null
  /** VNA na data de valoração. */
  vnaToday?: number | null
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

  // Busca a primeira taxa válida disponível no mapa para usar como taxa inicial de fallback
  const firstAvailableRate = Object.values(indexRates).find(v => v !== undefined && v !== null)
  let lastKnownRate = firstAvailableRate ?? 0

  for (const day of businessDays) {
    let rawRate = indexRates[day]
    if (rawRate === undefined || rawRate === null) {
      rawRate = lastKnownRate
    } else {
      lastKnownRate = rawRate
    }
    const dailyDecimal = rawRate / 100
    value *= 1 + dailyDecimal * factor
  }

  return value
}

/** Pré-fixado: VF = VP × (1 + i)^(n/252) com n = dias úteis. */
function accumulatePreFixed(
  principal: number,
  applicationDate: string,
  asOfDate: string,
  contractRateAnnual: number
): number {
  if (principal <= 0) return 0
  const n = countBusinessDaysBetween(applicationDate, asOfDate)
  if (n <= 0) return principal
  const annualDecimal = contractRateAnnual / 100
  return principal * Math.pow(1 + annualDecimal, n / 252)
}

/** Tesouro IPCA+: VF = VP × (VNA_hoje / VNA_compra) × (1 + i)^(n/252). */
function accumulateIpcaPlusTreasury(
  principal: number,
  applicationDate: string,
  asOfDate: string,
  contractRateAnnual: number,
  vnaAtPurchase: number,
  vnaToday: number
): number {
  if (principal <= 0 || vnaAtPurchase <= 0 || vnaToday <= 0) return principal
  const n = countBusinessDaysBetween(applicationDate, asOfDate)
  const vnaFactor = vnaToday / vnaAtPurchase
  const annualDecimal = contractRateAnnual / 100
  const rateFactor = n > 0 ? Math.pow(1 + annualDecimal, n / 252) : 1
  return principal * vnaFactor * rateFactor
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
    vnaAtPurchase,
    vnaToday,
  } = input

  if (principal <= 0) return 0

  const isIpcaTreasury =
    indexer === 'ipca' &&
    vnaAtPurchase != null &&
    vnaAtPurchase > 0 &&
    vnaToday != null &&
    vnaToday > 0 &&
    contractRateAnnual != null &&
    contractRateAnnual > 0

  if (isIpcaTreasury) {
    return Math.round(
      accumulateIpcaPlusTreasury(
        principal,
        applicationDate,
        asOfDate,
        contractRateAnnual,
        vnaAtPurchase,
        vnaToday
      ) * 100
    ) / 100
  }

  if (indexer !== 'none') {
    const businessDays = eachBusinessDayBetween(applicationDate, asOfDate)
    return Math.round(
      accumulatePostFixed(principal, businessDays, indexer, indexerPercent, indexRates) * 100
    ) / 100
  }

  if (contractRateAnnual !== null && contractRateAnnual > 0) {
    return Math.round(
      accumulatePreFixed(principal, applicationDate, asOfDate, contractRateAnnual) * 100
    ) / 100
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
  vnaToday,
}: {
  transactions: PortfolioTransaction[]
  ticker: string
  definition: PortfolioAssetDefinition
  asOfDate: string
  indexRates: IndexRateMap
  vnaToday?: number | null
}): number {
  const upperTicker = ticker.toUpperCase().trim()

  const buyLots = transactions
    .filter(
      (t) =>
        t.ticker.toUpperCase().trim() === upperTicker &&
        (t.operation_type === 'buy' || t.operation_type === 'subscription') &&
        (t.settlement_status ?? 'settled') === 'settled'
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      quantity: Number(t.quantity),
      price: Number(t.price),
      contract_rate:
        t.contract_rate !== undefined && t.contract_rate !== null ? Number(t.contract_rate) : null,
      vna_at_purchase:
        t.vna_at_purchase !== undefined && t.vna_at_purchase !== null
          ? Number(t.vna_at_purchase)
          : null,
    }))

  const sales = transactions.filter(
    (t) =>
      t.ticker.toUpperCase().trim() === upperTicker &&
      t.operation_type === 'sell' &&
      (t.settlement_status ?? 'settled') === 'settled'
  )
  let totalQuantitySold = sales.reduce((sum, t) => sum + Number(t.quantity), 0)

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
      vnaAtPurchase: lot.vna_at_purchase ?? undefined,
      vnaToday: vnaToday ?? undefined,
    })
    totalTheoreticalValue += lotValue
  }

  return totalTheoreticalValue
}

export { dailyRateFromAnnualPercent }
