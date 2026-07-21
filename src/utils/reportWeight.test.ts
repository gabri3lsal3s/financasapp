import { describe, expect, it } from 'vitest'
import {
  applyReportWeightToBillRow,
  computeReportWeightFromAmounts,
  getWeightedReportAmount,
} from '@/utils/reportWeight'

describe('reportWeight', () => {
  it('aplica peso padrão 1 quando report_weight ausente', () => {
    expect(getWeightedReportAmount(100)).toBe(100)
    expect(getWeightedReportAmount(100, null)).toBe(100)
  })

  it('multiplica amount pelo report_weight', () => {
    expect(getWeightedReportAmount(200, 0.5)).toBe(100)
    expect(getWeightedReportAmount(200, 0)).toBe(0)
  })

  it('calcula ratio reportAmount/baseAmount', () => {
    expect(computeReportWeightFromAmounts(50, 200)).toBe(0.25)
    expect(computeReportWeightFromAmounts(0, 200)).toBe(0)
  })

  it('applyReportWeightToBillRow preserva base_amount', () => {
    const row = applyReportWeightToBillRow(
      { amount: 100, report_weight: 0.8 },
      true,
    )
    expect(row.amount).toBe(80)
    expect(row.base_amount).toBe(100)

    const rowZero = applyReportWeightToBillRow(
      { amount: 100, report_weight: 0 },
      true,
    )
    expect(rowZero.amount).toBe(0)
    expect(rowZero.base_amount).toBe(100)
  })

  it('applyReportWeightToBillRow desligado mantém valor bruto', () => {
    const row = applyReportWeightToBillRow(
      { amount: 100, report_weight: 0.5 },
      false,
    )
    expect(row.amount).toBe(100)
    expect(row.base_amount).toBe(100)
  })
})
