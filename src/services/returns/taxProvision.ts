import type { PortfolioPricingMode } from '@/types'
import { calculateGrossAndNetYield } from '@/utils/incomeTaxInvestment'
import type { LotValuation } from '@/services/returns/lotValuation'

export interface LotTaxResult {
  grossValue: number
  netValue: number
  grossGain: number
  netGain: number
  irRate: number
}

export function calculateLotTaxProvision(
  valuation: LotValuation,
  asOfDate: string
): LotTaxResult {
  const { lot, grossValue, costBasis, grossGain } = valuation
  const pricingMode: PortfolioPricingMode =
    lot.definition.pricing_mode === 'cash' ? 'cash' : lot.definition.pricing_mode

  const tax = calculateGrossAndNetYield(costBasis, grossValue, {
    applicationDate: lot.purchaseDate,
    asOfDate,
    taxExempt: lot.definition.tax_exempt,
    pricingMode,
  })

  const netValue = Math.round((costBasis + tax.netGain) * 100) / 100

  return {
    grossValue,
    netValue,
    grossGain,
    netGain: tax.netGain,
    irRate: tax.irRate,
  }
}

export function sumNetPortfolioFromLots(lotTaxes: LotTaxResult[]): {
  grossPl: number
  netPl: number
} {
  const grossPl = lotTaxes.reduce((s, l) => s + l.grossValue, 0)
  const netPl = lotTaxes.reduce((s, l) => s + l.netValue, 0)
  return {
    grossPl: Math.round(grossPl * 100) / 100,
    netPl: Math.round(netPl * 100) / 100,
  }
}
