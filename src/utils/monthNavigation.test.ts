import { describe, expect, it } from 'vitest'
import {
  getMonthShiftDirection,
  monthLabelAnimationClass,
  monthShiftAnimationClass,
} from '@/utils/monthNavigation'

describe('monthNavigation', () => {
  it('detecta avanço e retrocesso entre competências YYYY-MM', () => {
    expect(getMonthShiftDirection('2026-01', '2026-02')).toBe('forward')
    expect(getMonthShiftDirection('2026-03', '2026-02')).toBe('backward')
    expect(getMonthShiftDirection('2026-02', '2026-02')).toBe('none')
  })

  it('ignora valores especiais ou inválidos', () => {
    expect(getMonthShiftDirection('live', '2026-02')).toBe('none')
    expect(getMonthShiftDirection('2026-02', 'live')).toBe('none')
    expect(getMonthShiftDirection('2026-2', '2026-02')).toBe('none')
  })

  it('mapeia classes de animação por direção', () => {
    expect(monthShiftAnimationClass('forward')).toBe('animate-month-shift-forward')
    expect(monthShiftAnimationClass('backward')).toBe('animate-month-shift-backward')
    expect(monthLabelAnimationClass('forward')).toBe('animate-month-label-forward')
    expect(monthLabelAnimationClass('none')).toBe('')
  })
})
