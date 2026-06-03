import { describe, expect, it } from 'vitest'
import {
  buildFlipStartTransform,
  buildIconDragTransform,
  getCalculatorPanelOpenClass,
  getSnapToFabThresholdY,
  getSnapToSideThresholdY,
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

  it('maps panel open class by origin and side', () => {
    expect(getCalculatorPanelOpenClass('bottom-right', 'right')).toBe('animate-calculator-open-fab')
    expect(getCalculatorPanelOpenClass('top-right', 'left')).toBe('animate-calculator-open-side-left')
    expect(getCalculatorPanelOpenClass('top-right', 'top')).toBe('animate-calculator-open-side-top')
    expect(getCalculatorPanelOpenClass('top-right', 'right')).toBe('animate-calculator-open-side-right')
  })

  it('uses shorter drag distance for side repositioning', () => {
    const viewportHeight = 900
    const fabStartY = 740

    expect(
      getSnapToSideThresholdY({
        viewportHeight,
        isMobile: false,
        dragStartY: fabStartY,
        sideAnchorY: 160,
      })
    ).toBe(Math.max(viewportHeight * 0.86, fabStartY - 64))

    expect(
      getSnapToFabThresholdY({
        viewportHeight,
        isMobile: false,
        dragStartY: 300,
        sideAnchorY: 220,
      })
    ).toBe(Math.min(viewportHeight * 0.58, 300))
  })
})
