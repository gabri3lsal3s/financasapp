/**
 * Utilitários de geometria para o painel da calculadora flutuante.
 * Funções puras — sem dependência de React ou DOM.
 */

export const PANEL_MARGIN = 8
export const MIN_PANEL_WIDTH = 320
export const MAX_PANEL_WIDTH = 620
export const MIN_PANEL_HEIGHT = 430
export const MOBILE_MIN_PANEL_HEIGHT = 120
export const MOBILE_MIN_PANEL_WIDTH = 200
export const MAX_PANEL_HEIGHT = 640
export const DEFAULT_PANEL_WIDTH = 352
export const DEFAULT_PANEL_HEIGHT = 470
export const MOBILE_BREAKPOINT = 768
export const MOBILE_MAX_HEIGHT_RATIO = 0.5
export const MOBILE_RESIZE_MIN_HEIGHT_RATIO = 0.45
export const RESIZE_MAX_VIEWPORT_HEIGHT_RATIO = 1
export const PANEL_ASPECT_RATIO = DEFAULT_PANEL_WIDTH / DEFAULT_PANEL_HEIGHT
export const RESIZE_TAP_MAX_MS = 220
export const RESIZE_DRAG_START_DISTANCE = 6
export const RETURN_ANIMATION_MS = 600

export interface PanelRect {
  left: number
  top: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/**
 * Clampa um valor entre mínimo e máximo.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Verifica se a viewport é mobile (<= breakpoint).
 */
export function isMobileViewport(viewportWidth: number): boolean {
  return viewportWidth <= MOBILE_BREAKPOINT
}

/**
 * Largura mínima do painel baseada na viewport.
 */
export function getPanelMinWidth(viewportWidth: number): number {
  return isMobileViewport(viewportWidth) ? MOBILE_MIN_PANEL_WIDTH : MIN_PANEL_WIDTH
}

/**
 * Altura mínima do painel baseada na viewport.
 */
export function getPanelMinHeight(viewportWidth: number, viewportHeight: number): number {
  if (!isMobileViewport(viewportWidth)) return MIN_PANEL_HEIGHT

  const mobileRatioMinHeight = Math.floor(viewportHeight * MOBILE_RESIZE_MIN_HEIGHT_RATIO)
  return Math.max(MOBILE_MIN_PANEL_HEIGHT, mobileRatioMinHeight)
}

/**
 * Altura máxima para resize do painel.
 */
export function getPanelResizeMaxHeight(viewportWidth: number, viewportHeight: number): number {
  const minHeight = getPanelMinHeight(viewportWidth, viewportHeight)
  const viewportBoundMaxHeight = Math.min(
    MAX_PANEL_HEIGHT,
    Math.floor((viewportHeight - PANEL_MARGIN * 2) * RESIZE_MAX_VIEWPORT_HEIGHT_RATIO),
  )
  return Math.max(minHeight, viewportBoundMaxHeight)
}

/**
 * Altura máxima inicial do painel (menor que a de resize em mobile).
 */
export function getPanelInitialMaxHeight(viewportWidth: number, viewportHeight: number): number {
  const minHeight = getPanelMinHeight(viewportWidth, viewportHeight)
  const resizeMaxHeight = getPanelResizeMaxHeight(viewportWidth, viewportHeight)

  if (!isMobileViewport(viewportWidth)) return resizeMaxHeight

  const mobileMaxHeight = Math.floor(viewportHeight * MOBILE_MAX_HEIGHT_RATIO)
  return Math.max(minHeight, Math.min(resizeMaxHeight, mobileMaxHeight))
}

/**
 * Calcula largura e altura uniformes respeitando aspect ratio e limites.
 */
export function getUniformPanelSize(
  requestedHeight: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): Pick<PanelRect, 'width' | 'height'> {
  const minHeightByRatio = minWidth / PANEL_ASPECT_RATIO
  const maxHeightByRatio = maxWidth / PANEL_ASPECT_RATIO
  const effectiveMinHeight = Math.max(minHeight, minHeightByRatio)
  const effectiveMaxHeight = Math.max(effectiveMinHeight, Math.min(maxHeight, maxHeightByRatio))
  const height = clamp(requestedHeight, effectiveMinHeight, effectiveMaxHeight)
  const width = clamp(Math.round(height * PANEL_ASPECT_RATIO), minWidth, maxWidth)

  return { width, height }
}

/**
 * Retorna o rect padrão para o painel, centralizado no canto inferior direito.
 */
export function getDefaultPanelRect(): PanelRect {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const minWidth = getPanelMinWidth(viewportWidth)
  const minHeight = getPanelMinHeight(viewportWidth, viewportHeight)

  const maxWidth = Math.max(minWidth, Math.min(MAX_PANEL_WIDTH, viewportWidth - PANEL_MARGIN * 2))
  const maxHeight = getPanelInitialMaxHeight(viewportWidth, viewportHeight)
  const { width, height } = getUniformPanelSize(DEFAULT_PANEL_HEIGHT, minWidth, minHeight, maxWidth, maxHeight)

  const left = clamp(viewportWidth - width - 20, PANEL_MARGIN, viewportWidth - width - PANEL_MARGIN)
  const bottomOffset = viewportWidth < 1024 ? (64 + 16) : PANEL_MARGIN
  const top = clamp(viewportHeight - height - bottomOffset, PANEL_MARGIN, viewportHeight - height - PANEL_MARGIN)

  return { left, top, width, height }
}
