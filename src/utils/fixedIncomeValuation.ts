import { eachBusinessDayBetween, calendarDaysBetween } from '@/utils/businessDays'
import type { PortfolioAssetIndexer } from '@/types'

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

export { dailyRateFromAnnualPercent }
