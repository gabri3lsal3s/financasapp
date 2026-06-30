/**
 * Hook que gerencia o estado de posicionamento, drag e resize do painel
 * da calculadora flutuante.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PanelRect } from '@/utils/calculatorGeometry'
import {
  clamp,
  getDefaultPanelRect,
  getPanelMinWidth,
  getPanelMinHeight,
  getPanelResizeMaxHeight,
  getUniformPanelSize,
  PANEL_MARGIN,
  MAX_PANEL_WIDTH,
  PANEL_ASPECT_RATIO,
  RESIZE_TAP_MAX_MS,
  RESIZE_DRAG_START_DISTANCE,
  isMobileViewport,
} from '@/utils/calculatorGeometry'

/**
 * Hook que retorna o estado do painel e handlers para drag/resize.
 */
export function useCalculatorPanel() {
  const [panelRect, setPanelRect] = useState<PanelRect>(() => getDefaultPanelRect())
  const panelRectRef = useRef<PanelRect>(panelRect)
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const [resizePreviewRect, setResizePreviewRect] = useState<PanelRect | null>(null)

  // Mantém a ref sempre atualizada
  useEffect(() => {
    panelRectRef.current = panelRect
  }, [panelRect])

  /**
   * Handler para iniciar o drag do painel (mover posição).
   */
  const startDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const target = event.target as HTMLElement
    if (target.closest('button')) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const startX = event.clientX
    const startY = event.clientY
    const startRect = panelRectRef.current
    const pointerId = event.pointerId

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return

      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      const nextLeft = clamp(startRect.left + deltaX, PANEL_MARGIN, window.innerWidth - startRect.width - PANEL_MARGIN)
      const nextTop = clamp(startRect.top + deltaY, PANEL_MARGIN, window.innerHeight - startRect.height - PANEL_MARGIN)

      setPanelRect((currentRect) => ({
        ...currentRect,
        left: nextLeft,
        top: nextTop,
      }))
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }, [])

  /**
   * Handler para iniciar o resize do painel.
   * Toque duplo (tap) no handle reseta para o tamanho padrão.
   */
  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const startX = event.clientX
    const startY = event.clientY
    const startRect = panelRectRef.current
    const pointerId = event.pointerId
    const startTimestamp = performance.now()
    let hasStartedDragResize = false
    let latestPreviewRect: PanelRect | null = null

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return

      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      if (!hasStartedDragResize && Math.hypot(deltaX, deltaY) < RESIZE_DRAG_START_DISTANCE) return

      if (!hasStartedDragResize) {
        setIsResizingPanel(true)
        setResizePreviewRect(startRect)
        latestPreviewRect = startRect
      }

      hasStartedDragResize = true

      const minWidth = getPanelMinWidth(window.innerWidth)
      const minHeight = getPanelMinHeight(window.innerWidth, window.innerHeight)
      const maxWidthByViewport = Math.max(
        minWidth,
        Math.min(MAX_PANEL_WIDTH, window.innerWidth - startRect.left - PANEL_MARGIN),
      )
      const absoluteMaxHeight = getPanelResizeMaxHeight(window.innerWidth, window.innerHeight)
      const maxHeightByViewport = Math.max(
        minHeight,
        Math.min(absoluteMaxHeight, window.innerHeight - startRect.top - PANEL_MARGIN),
      )

      const projectedHeightDeltaFromX = deltaX / PANEL_ASPECT_RATIO
      const projectedHeightDeltaFromY = deltaY
      const dominantHeightDelta =
        Math.abs(projectedHeightDeltaFromY) >= Math.abs(projectedHeightDeltaFromX)
          ? projectedHeightDeltaFromY
          : projectedHeightDeltaFromX

      const uniformSize = getUniformPanelSize(
        startRect.height + dominantHeightDelta,
        minWidth,
        minHeight,
        maxWidthByViewport,
        maxHeightByViewport,
      )

      const reachedMaxMobileWidth =
        isMobileViewport(window.innerWidth) &&
        (startRect.width >= maxWidthByViewport - 1 || uniformSize.width >= maxWidthByViewport - 1)

      const nextWidth = reachedMaxMobileWidth ? maxWidthByViewport : uniformSize.width
      const nextHeight = reachedMaxMobileWidth
        ? clamp(startRect.height + deltaY, minHeight, maxHeightByViewport)
        : uniformSize.height

      const nextPreviewRect: PanelRect = {
        left: startRect.left,
        top: startRect.top,
        width: nextWidth,
        height: nextHeight,
      }

      latestPreviewRect = nextPreviewRect
      setResizePreviewRect(nextPreviewRect)
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return

      const elapsedMs = performance.now() - startTimestamp

      if (!hasStartedDragResize && elapsedMs <= RESIZE_TAP_MAX_MS) {
        resetPanelRect()
      } else if (hasStartedDragResize && latestPreviewRect) {
        setPanelRect({
          left: latestPreviewRect.left,
          top: latestPreviewRect.top,
          width: latestPreviewRect.width,
          height: latestPreviewRect.height,
        })
      }

      setIsResizingPanel(false)
      setResizePreviewRect(null)

      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }, [])

  /**
   * Reseta o painel para o tamanho e posição padrão.
   */
  const resetPanelRect = useCallback(() => {
    const defaultRect = getDefaultPanelRect()
    setPanelRect({
      left: defaultRect.left,
      top: defaultRect.top,
      width: defaultRect.width,
      height: defaultRect.height,
    })
  }, [])

  return {
    panelRect,
    setPanelRect,
    isResizingPanel,
    setIsResizingPanel,
    resizePreviewRect,
    setResizePreviewRect,
    startDrag,
    startResize,
    resetPanelRect,
  }
}
