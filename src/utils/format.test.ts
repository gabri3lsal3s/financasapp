import { describe, expect, it } from 'vitest'
import {
  APP_START_MONTH,
  clampMonthToAppStart,
  formatCurrency,
  formatAxisCurrencyThousands,
  formatChartYAxisCurrency,
  formatPercentBR,
  formatQuantityBR,
  formatSignedPercentBR,
  roundToDecimals,
  getCurrentMonthString,
  parseMoneyInput,
} from '@/utils/format'

describe('format', () => {
  it('clampMonthToAppStart não permite antes do início do app', () => {
    expect(clampMonthToAppStart('2020-01')).toBe(APP_START_MONTH)
    expect(clampMonthToAppStart('2026-06')).toBe('2026-06')
  })

  it('parseMoneyInput interpreta formato brasileiro', () => {
    expect(parseMoneyInput('1.234,56')).toBe(1234.56)
    expect(parseMoneyInput('99,90')).toBe(99.9)
  })

  it('formatCurrency formata em BRL', () => {
    expect(formatCurrency(10)).toContain('10')
    expect(formatCurrency(10)).toMatch(/R\$\s?/)
  })

  it('getCurrentMonthString retorna yyyy-MM', () => {
    expect(getCurrentMonthString()).toMatch(/^\d{4}-\d{2}$/)
  })

  it('formatPercentBR e formatSignedPercentBR formatam percentuais', () => {
    expect(formatPercentBR(12.345, 1)).toContain('%')
    expect(formatSignedPercentBR(5.5)).toMatch(/^\+/)
    expect(formatSignedPercentBR(-2)).toContain('-')
  })

  it('formatQuantityBR omite decimais para inteiros', () => {
    expect(formatQuantityBR(100)).not.toContain(',')
    expect(formatQuantityBR(10.5, 4)).toContain(',')
  })

  it('roundToDecimals e formatAxisCurrencyThousands', () => {
    expect(roundToDecimals(12.3456, 2)).toBe(12.35)
    expect(formatAxisCurrencyThousands(150_000)).toContain('k')
    expect(formatAxisCurrencyThousands(150_000, { spaced: true })).toContain('R$ ')
  })

  it('formatChartYAxisCurrency usa milhares ou valor cheio', () => {
    expect(formatChartYAxisCurrency(500)).toContain('R$')
    expect(formatChartYAxisCurrency(500)).not.toContain('k')
    expect(formatChartYAxisCurrency(2_500)).toContain('k')
  })
})

