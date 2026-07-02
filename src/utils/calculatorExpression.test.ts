import { describe, it, expect } from 'vitest'
import {
  normalizeInputValue,
  toCanonicalNumericString,
  formatCanonicalNumberToPtBr,
  formatExpressionForDisplay,
  evaluateExpression,
} from './calculatorExpression'

describe('normalizeInputValue', () => {
  it('trims whitespace', () => {
    expect(normalizeInputValue('  123  ')).toBe('123')
  })

  it('replaces commas with dots', () => {
    expect(normalizeInputValue('1,5')).toBe('1.5')
    expect(normalizeInputValue('1.234,56')).toBe('1.234.56')
  })

  it('handles empty string', () => {
    expect(normalizeInputValue('')).toBe('')
  })
})

describe('toCanonicalNumericString', () => {
  it('removes spaces', () => {
    expect(toCanonicalNumericString('1 234')).toBe('1234')
  })

  it('replaces commas with dots', () => {
    expect(toCanonicalNumericString('1,5')).toBe('1.5')
  })

  it('returns empty string for empty input', () => {
    expect(toCanonicalNumericString('')).toBe('')
  })
})

describe('formatCanonicalNumberToPtBr', () => {
  it('formats integer number with pt-BR locale', () => {
    const result = formatCanonicalNumberToPtBr('1234.5')
    expect(result).toContain(',')
    expect(result).toContain('.')
  })

  it('returns input as-is for non-finite numbers', () => {
    expect(formatCanonicalNumberToPtBr('abc')).toBe('abc')
  })

  it('formats zero correctly', () => {
    const result = formatCanonicalNumberToPtBr('0')
    expect(result).toBe('0')
  })
})

describe('formatExpressionForDisplay', () => {
  it('formats simple expression with decimal', () => {
    const result = formatExpressionForDisplay('10.5+20.3')
    // Should convert dots to commas for display
    expect(result).toContain('10,5')
    expect(result).toContain('20,3')
    expect(result).toContain('+')
  })

  it('formats integer parts with grouping', () => {
    const result = formatExpressionForDisplay('1500+2000')
    expect(result).toContain('1.500')
    expect(result).toContain('2.000')
  })

  it('formats trailing decimal point', () => {
    const result = formatExpressionForDisplay('10.')
    // Should show trailing comma
    expect(result).toBe('10,')
  })

  it('handles empty expression', () => {
    expect(formatExpressionForDisplay('')).toBe('')
  })

  it('handles operators between numbers', () => {
    const result = formatExpressionForDisplay('100*2')
    expect(result).toContain('100')
    expect(result).toContain('2')
    expect(result).toContain('*')
  })
})

describe('evaluateExpression', () => {
  it('evaluates simple addition', () => {
    expect(evaluateExpression('10+20')).toBe('30')
  })

  it('evaluates subtraction', () => {
    expect(evaluateExpression('100-25')).toBe('75')
  })

  it('evaluates multiplication', () => {
    expect(evaluateExpression('6*7')).toBe('42')
  })

  it('evaluates division', () => {
    expect(evaluateExpression('100/4')).toBe('25')
  })

  it('evaluates power operator (^)', () => {
    expect(evaluateExpression('2^10')).toBe('1024')
  })

  it('handles parentheses', () => {
    expect(evaluateExpression('(10+5)*2')).toBe('30')
  })

  it('handles decimal numbers with commas', () => {
    expect(evaluateExpression('1,5+2,5')).toBe('4')
  })

  it('returns null for invalid expression', () => {
    expect(evaluateExpression('abc')).toBeNull()
  })

  it('returns null for empty expression', () => {
    expect(evaluateExpression('')).toBeNull()
  })

  it('returns null for division by zero-like edge cases', () => {
    const result = evaluateExpression('1/0')
    expect(result).toBeNull() // Infinity is not finite
  })

  it('handles chained operations', () => {
    expect(evaluateExpression('10+20+30')).toBe('60')
  })

  it('handles modulo', () => {
    expect(evaluateExpression('10%3')).toBe('1')
  })

  it('rejects expression with letters', () => {
    expect(evaluateExpression('10+abc')).toBeNull()
  })
})
