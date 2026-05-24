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
  if (input.pricingMode === 'cash' || input.taxExempt || input.grossGain <= 0) return 0

  if (input.pricingMode === 'fixed_income') {
    const days = calendarDaysBetween(input.applicationDate, input.asOfDate)
    return getRegressiveIrRate(days)
  }

  return getMarketAssetIrRate()
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
  taxInput: Omit<InvestmentTaxInput, 'grossGain'>
): { grossGain: number; netGain: number; grossYieldPct: number; netYieldPct: number; irRate: number } {
  const grossGain = Math.round((currentValue - costBasis) * 100) / 100
  const irRate = resolveIrRate({ ...taxInput, grossGain })
  const netGain = calculateNetGain({ ...taxInput, grossGain })

  return {
    grossGain,
    netGain,
    grossYieldPct: calculateYieldPct(costBasis, grossGain),
    netYieldPct: calculateYieldPct(costBasis, netGain),
    irRate,
  }
}
