import { describe, expect, it } from 'vitest'
import {
  buildFlipStartTransform,
  buildIconDragTransform,
  getCalculatorPanelOpenClass,
  getCalculatorButtonWrapperClass,
  getSafeYRange,
  calculateYFromPercent,
  calculatePercentFromY,
} from '@/components/calculatorOriginFlip'

describe('calculatorOriginFlip', () => {
  it('builds inverse transform between two rects', () => {
    const transform = buildFlipStartTransform(
      { left: 300, top: 700, width: 40, height: 40 },
      { left: 360, top: 180, width: 48, height: 40 }
    )

    expect(transform).toContain('translate3d')
    expect(transform).toContain('scale')
  })

  it('builds drag transform with scale while dragging', () => {
    expect(buildIconDragTransform({ x: 4, y: -2 }, true)).toBe('translate3d(4px, -2px, 0) scale(1.02)')
    expect(buildIconDragTransform({ x: 0, y: 0 }, false)).toBe('translate3d(0px, 0px, 0)')
  })

  it('maps panel open class by side', () => {
    expect(getCalculatorPanelOpenClass('left')).toBe('animate-calculator-open-side-left')
    expect(getCalculatorPanelOpenClass('right')).toBe('animate-calculator-open-side-right')
  })

  it('generates the button wrapper classes based on state', () => {
    const classLeft = getCalculatorButtonWrapperClass('left', false, false)
    expect(classLeft).toContain('calculator-icon-wrapper-transition')

    const classRight = getCalculatorButtonWrapperClass('right', false, false)
    expect(classRight).toContain('calculator-icon-wrapper-transition')

    const classDragging = getCalculatorButtonWrapperClass('right', true, false)
    expect(classDragging).toContain('calculator-icon-wrapper-transition--no-transition')
  })

  it('calculates safe Y ranges and converts percent-pixel consistently', () => {
    const viewportHeight = 800
    const buttonHeight = 40
    
    const [minY, maxY] = getSafeYRange(viewportHeight, buttonHeight)
    expect(minY).toBeGreaterThan(0)
    expect(maxY).toBeLessThan(viewportHeight)
    expect(minY).toBeLessThan(maxY)

    // Verify conversions are symmetrical
    const percent = 50
    const yPx = calculateYFromPercent(percent, viewportHeight, buttonHeight)
    const convertedBack = calculatePercentFromY(yPx, viewportHeight, buttonHeight)
    expect(convertedBack).toBe(percent)
  })
})
