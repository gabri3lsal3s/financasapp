import { describe, it, expect } from 'vitest'
import {
  clamp,
  isMobileViewport,
  getPanelMinWidth,
  getPanelMinHeight,
  getPanelResizeMaxHeight,
  getPanelInitialMaxHeight,
  getUniformPanelSize,
  PANEL_MARGIN,
  MOBILE_BREAKPOINT,
  MIN_PANEL_WIDTH,
  MOBILE_MIN_PANEL_WIDTH,
  MIN_PANEL_HEIGHT,
  MOBILE_MIN_PANEL_HEIGHT,
  MAX_PANEL_WIDTH,
  MAX_PANEL_HEIGHT,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_PANEL_HEIGHT,
  PANEL_ASPECT_RATIO,
} from './calculatorGeometry'

describe('clamp', () => {
  it('clamps value below minimum', () => {
    expect(clamp(-5, 0, 100)).toBe(0)
  })

  it('clamps value above maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100)
  })

  it('keeps value within range', () => {
    expect(clamp(50, 0, 100)).toBe(50)
  })

  it('handles floating point', () => {
    expect(clamp(3.14, 0, 10)).toBe(3.14)
  })
})

describe('isMobileViewport', () => {
  it('returns true for width <= mobile breakpoint', () => {
    expect(isMobileViewport(MOBILE_BREAKPOINT)).toBe(true)
    expect(isMobileViewport(MOBILE_BREAKPOINT - 1)).toBe(true)
  })

  it('returns false for width > mobile breakpoint', () => {
    expect(isMobileViewport(MOBILE_BREAKPOINT + 1)).toBe(false)
    expect(isMobileViewport(1440)).toBe(false)
  })
})

describe('getPanelMinWidth', () => {
  it('returns mobile min width for mobile viewport', () => {
    expect(getPanelMinWidth(375)).toBe(MOBILE_MIN_PANEL_WIDTH)
  })

  it('returns desktop min width for desktop viewport', () => {
    expect(getPanelMinWidth(1440)).toBe(MIN_PANEL_WIDTH)
  })
})

describe('getPanelMinHeight', () => {
  it('returns desktop min height for desktop viewport', () => {
    const height = getPanelMinHeight(1440, 900)
    expect(height).toBe(MIN_PANEL_HEIGHT)
  })

  it('returns at least mobile min height for mobile viewport', () => {
    const height = getPanelMinHeight(375, 667) // iPhone SE
    expect(height).toBeGreaterThanOrEqual(MOBILE_MIN_PANEL_HEIGHT)
  })

  it('returns larger min height for very tall mobile viewports', () => {
    const height = getPanelMinHeight(375, 1000)
    // MOBILE_RESIZE_MIN_HEIGHT_RATIO = 0.45, so 1000 * 0.45 = 450
    expect(height).toBeGreaterThan(MOBILE_MIN_PANEL_HEIGHT)
  })
})

describe('getUniformPanelSize', () => {
  const minWidth = MIN_PANEL_WIDTH
  const minHeight = MIN_PANEL_HEIGHT
  const maxWidth = MAX_PANEL_WIDTH
  const maxHeight = MAX_PANEL_HEIGHT

  it('returns width and height matching aspect ratio', () => {
    const { width, height } = getUniformPanelSize(470, minWidth, minHeight, maxWidth, maxHeight)
    // Aspect ratio: DEFAULT_PANEL_WIDTH / DEFAULT_PANEL_HEIGHT ≈ 352/470 ≈ 0.749
    const calculatedRatio = width / height
    expect(Math.abs(calculatedRatio - PANEL_ASPECT_RATIO)).toBeLessThan(0.01)
  })

  it('clamps height to effective min', () => {
    const { height } = getUniformPanelSize(1, minWidth, minHeight, maxWidth, maxHeight)
    expect(height).toBeGreaterThanOrEqual(minHeight)
  })

  it('clamps width to min', () => {
    const { width } = getUniformPanelSize(100, minWidth, minHeight, maxWidth, maxHeight)
    expect(width).toBeGreaterThanOrEqual(minWidth)
  })

  it('clamps to max bounds', () => {
    const { width, height } = getUniformPanelSize(10000, minWidth, minHeight, maxWidth, maxHeight)
    expect(width).toBeLessThanOrEqual(maxWidth)
    expect(height).toBeLessThanOrEqual(maxHeight)
  })
})

describe('getPanelResizeMaxHeight', () => {
  it('is at least min height', () => {
    const maxHeight = getPanelResizeMaxHeight(1440, 900)
    expect(maxHeight).toBeGreaterThanOrEqual(MIN_PANEL_HEIGHT)
  })

  it('does not exceed MAX_PANEL_HEIGHT', () => {
    const maxHeight = getPanelResizeMaxHeight(1440, 99999)
    expect(maxHeight).toBeLessThanOrEqual(MAX_PANEL_HEIGHT)
  })
})

describe('getPanelInitialMaxHeight', () => {
  it('is at least min height', () => {
    const maxHeight = getPanelInitialMaxHeight(1440, 900)
    expect(maxHeight).toBeGreaterThanOrEqual(MIN_PANEL_HEIGHT)
  })

  it('on mobile, respects MOBILE_MAX_HEIGHT_RATIO', () => {
    const maxHeight = getPanelInitialMaxHeight(375, 1000)
    // MOBILE_MAX_HEIGHT_RATIO = 0.5, so 1000 * 0.5 = 500
    expect(maxHeight).toBeLessThanOrEqual(500)
  })
})

describe('constants', () => {
  it('PANEL_ASPECT_RATIO matches default dimensions', () => {
    const expectedRatio = DEFAULT_PANEL_WIDTH / DEFAULT_PANEL_HEIGHT
    expect(PANEL_ASPECT_RATIO).toBe(expectedRatio)
  })

  it('MOBILE_BREAKPOINT is 768', () => {
    expect(MOBILE_BREAKPOINT).toBe(768)
  })

  it('default panel fits within min/max bounds', () => {
    expect(DEFAULT_PANEL_WIDTH).toBeGreaterThanOrEqual(MIN_PANEL_WIDTH)
    expect(DEFAULT_PANEL_WIDTH).toBeLessThanOrEqual(MAX_PANEL_WIDTH)
    expect(DEFAULT_PANEL_HEIGHT).toBeGreaterThanOrEqual(MIN_PANEL_HEIGHT)
    expect(DEFAULT_PANEL_HEIGHT).toBeLessThanOrEqual(MAX_PANEL_HEIGHT)
  })

  it('PANEL_MARGIN is positive', () => {
    expect(PANEL_MARGIN).toBeGreaterThan(0)
  })
})
