export interface FlipRect {
  left: number
  top: number
  width: number
  height: number
}

export function captureFlipRect(element: Element | null | undefined): FlipRect | null {
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function buildFlipStartTransform(from: FlipRect, to: FlipRect): string {
  const deltaX = from.left + from.width / 2 - (to.left + to.width / 2)
  const deltaY = from.top + from.height / 2 - (to.top + to.height / 2)
  const scaleX = from.width / Math.max(to.width, 1)
  const scaleY = from.height / Math.max(to.height, 1)

  return `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`
}

export function buildIconDragTransform(offset: { x: number; y: number }, dragging: boolean): string {
  if (dragging) {
    return `translate3d(${offset.x}px, ${offset.y}px, 0) scale(1.02)`
  }

  return `translate3d(${offset.x}px, ${offset.y}px, 0)`
}

export function getCalculatorPanelOpenClass(
  iconOrigin: 'bottom-right' | 'top-right',
  side: 'left' | 'right' | 'top'
): string {
  if (iconOrigin === 'bottom-right') {
    return 'animate-calculator-open-fab'
  }

  if (side === 'left') {
    return 'animate-calculator-open-side-left'
  }

  if (side === 'top') {
    return 'animate-calculator-open-side-top'
  }

  return 'animate-calculator-open-side-right'
}

/** Distância mínima de arraste vertical para trocar de modo (px). */
export const CALCULATOR_SNAP_DRAG_UP_PX = 64
export const CALCULATOR_SNAP_DRAG_DOWN_PX = 80

interface SnapThresholdInput {
  viewportHeight: number
  isMobile: boolean
  dragStartY: number
  sideAnchorY: number
}

/** FAB → lateral: ativa ao subir o suficiente ou ao cruzar a zona superior da tela. */
export function getSnapToSideThresholdY({
  viewportHeight,
  isMobile,
  dragStartY,
}: SnapThresholdInput): number {
  const viewportLine = viewportHeight * (isMobile ? 0.82 : 0.86)
  const dragLine = dragStartY - CALCULATOR_SNAP_DRAG_UP_PX

  return Math.max(viewportLine, dragLine)
}

/** Lateral → FAB: ativa ao descer o suficiente ou ao entrar na metade inferior da tela. */
export function getSnapToFabThresholdY({
  viewportHeight,
  isMobile,
  sideAnchorY,
}: SnapThresholdInput): number {
  const viewportLine = viewportHeight * (isMobile ? 0.54 : 0.58)
  const dragLine = sideAnchorY + CALCULATOR_SNAP_DRAG_DOWN_PX

  return Math.min(viewportLine, dragLine)
}
