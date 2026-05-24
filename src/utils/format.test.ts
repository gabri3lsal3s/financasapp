import { describe, expect, it } from 'vitest'
import {
  APP_START_MONTH,
  clampMonthToAppStart,
  formatCurrency,
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
})
