import { calendarDaysBetween } from '@/utils/businessDays'
import type { PortfolioPricingMode } from '@/types'

export interface InvestmentTaxInput {
  grossGain: number
  applicationDate: string
  asOfDate: string
  taxExempt: boolean
  pricingMode: PortfolioPricingMode
}

/** Tabela regressiva simplificada (dias corridos) para renda fixa. */
export function getRegressiveIrRate(holdingDays: number): number {
  if (holdingDays <= 180) return 0.225
  if (holdingDays <= 360) return 0.2
  if (holdingDays <= 720) return 0.175
  return 0.15
}

/** Ações/FIIs: 15% sobre ganho (estimativa simplificada, sem DARF detalhada). */
export function getMarketAssetIrRate(): number {
  return 0.15
}

export function resolveIrRate(input: InvestmentTaxInput): number {
  if (input.taxExempt) return 0
  if (input.pricingMode !== 'fixed_income') return 0
  if (!input.applicationDate || !input.asOfDate) return 0.225

  const holdingDays = calendarDaysBetween(input.applicationDate, input.asOfDate)
  return getRegressiveIrRate(holdingDays)
}

export function calculateNetGain(input: InvestmentTaxInput): number {
  if (input.grossGain <= 0) return input.grossGain
  const rate = resolveIrRate(input)
  return Math.round(input.grossGain * (1 - rate) * 100) / 100
}

export function calculateYieldPct(costBasis: number, gain: number): number {
  if (costBasis <= 0) return 0
  return Math.round((gain / costBasis) * 10000) / 100
}

export function calculateGrossAndNetYield(
  costBasis: number,
  currentValue: number,
  taxInput: Omit<InvestmentTaxInput, 'grossGain'> & { accumulatedDividends?: number }
): { grossGain: number; netGain: number; grossYieldPct: number; netYieldPct: number; irRate: number } {
  const accDividends = taxInput.accumulatedDividends ?? 0
  
  let grossGain = 0
  if (taxInput.pricingMode === 'market') {
    grossGain = Math.round((currentValue - costBasis + accDividends) * 100) / 100
  } else {
    grossGain = Math.round((currentValue - costBasis) * 100) / 100
  }

  const irRate = resolveIrRate({
    grossGain,
    applicationDate: taxInput.applicationDate,
    asOfDate: taxInput.asOfDate,
    taxExempt: taxInput.taxExempt,
    pricingMode: taxInput.pricingMode,
  })

  const irAmount = grossGain > 0 ? Math.round(grossGain * irRate * 100) / 100 : 0
  const netGain = Math.round((grossGain - irAmount) * 100) / 100

  return {
    grossGain,
    netGain,
    grossYieldPct: calculateYieldPct(costBasis, grossGain),
    netYieldPct: calculateYieldPct(costBasis, netGain),
    irRate,
  }
}

