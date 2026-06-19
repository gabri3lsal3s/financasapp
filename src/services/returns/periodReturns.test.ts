import { describe, it, expect } from 'vitest'
import {
  monthReturnFromShares,
} from '@/services/returns/periodReturns'

describe('periodReturns', () => {
  it('monthReturnFromShares calcula variação percentual', () => {
    expect(monthReturnFromShares(1.05, 1)).toBeCloseTo(0.05, 4)
    expect(monthReturnFromShares(1, 0)).toBe(0)
  })
})
