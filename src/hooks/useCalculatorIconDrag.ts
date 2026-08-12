import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { RETURN_ANIMATION_MS, type Point } from '@/utils/calculatorGeometry'
import { calculatePercentFromY, getSafeYRange } from '@/components/calculatorOriginFlip'

interface UseCalculatorIconDragOptions {
  slotTop: number | null
  floatingCalculatorAbsorbed: boolean
  updateSetting: (key: 'floatingCalculatorAbsorbed', value: boolean) => void
  commitPosition: (side: 'left' | 'right', yPercent: number) => void
}

/**
 * Estado e lógica de arrasto do ícone flutuante da calculadora:
 * drag com pointer capture, snap para o hub de ações, absorção/desanexação e retorno animado.
 */
export function useCalculatorIconDrag({
  slotTop,
  floatingCalculatorAbsorbed,
  updateSetting,
  commitPosition,
}: UseCalculatorIconDragOptions) {
  const [isNearHub, setIsNearHub] = useState(false)
  const [isDraggingFromHub, setIsDraggingFromHub] = useState(false)
  const [isIconAbsorbing, setIsIconAbsorbing] = useState(false)
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDraggingIcon, setIsDraggingIcon] = useState(false)
  const [isIconReturning, setIsIconReturning] = useState(false)
  const [dragPreviewY, setDragPreviewY] = useState<number | null>(null)
  const [dragPreviewX, setDragPreviewX] = useState<number | null>(null)
  const iconDragMovedRef = useRef(false)
  const iconReturnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (iconReturnTimeoutRef.current) {
        window.clearTimeout(iconReturnTimeoutRef.current)
      }
    }
  }, [])

  const initiateIconDrag = useCallback((
    clientX: number,
    clientY: number,
    pointerId: number,
    targetForCapture?: Element,
  ) => {
    if (iconReturnTimeoutRef.current) {
      clearTimeout(iconReturnTimeoutRef.current)
    }

    setIsIconReturning(false)
    setIsDraggingIcon(true)
    iconDragMovedRef.current = false

    const startX = clientX
    const startY = clientY

    const buttonHeight = 40
    const viewportHeight = window.innerHeight
    const [safeMinY, safeMaxY] = getSafeYRange(viewportHeight, buttonHeight)

    const minTop = slotTop !== null ? Math.max(slotTop + 8, safeMinY) : safeMinY

    const hubFab = document.querySelector('.page-action-hub-fab')
    const initialY = startY - 20
    const initialX = startX - 20

    setDragPreviewY(initialY)
    setDragPreviewX(initialX)

    let latestYPx = initialY
    let latestXPx = initialX
    let latestDist = 9999
    let lastNearSent = false

    if (targetForCapture && 'setPointerCapture' in targetForCapture) {
      try {
        targetForCapture.setPointerCapture(pointerId)
      } catch {
        // ignore capture errors
      }
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return

      const rawDeltaY = moveEvent.clientY - startY
      const rawDeltaX = moveEvent.clientX - startX

      if (!iconDragMovedRef.current && (Math.abs(rawDeltaY) > 4 || Math.abs(rawDeltaX) > 4)) {
        iconDragMovedRef.current = true
      }

      // Calcula a nova posição Y em pixels, clamped dentro das zonas seguras respeitando o minTop
      let newYPx = Math.max(minTop, Math.min(safeMaxY, initialY + rawDeltaY))
      let newXPx = Math.max(0, Math.min(window.innerWidth - 40, initialX + rawDeltaX))
      let dist = 9999

      if (hubFab) {
        const hubRect = hubFab.getBoundingClientRect()
        const hubCenterX = hubRect.left + hubRect.width / 2
        const hubCenterY = hubRect.top + hubRect.height / 2
        dist = Math.hypot(moveEvent.clientX - hubCenterX, moveEvent.clientY - hubCenterY)

        if (dist < 80) {
          // Snap ratio: 1 when dist is 0, 0 when dist is 80
          const snapRatio = Math.max(0, Math.min(1, (80 - dist) / 50))

          // Interpolate Y
          const targetYPx = hubCenterY - 20 // buttonHeight / 2 = 20
          newYPx = newYPx * (1 - snapRatio) + targetYPx * snapRatio

          // Interpolate X
          const targetXPx = hubCenterX - 20
          newXPx = newXPx * (1 - snapRatio) + targetXPx * snapRatio

          // Notify near status
          const isNear = snapRatio > 0.5
          setIsNearHub(isNear)
          if (isNear !== lastNearSent) {
            lastNearSent = isNear
            window.dispatchEvent(new CustomEvent('calculator-near-hub', { detail: { near: isNear } }))
          }
        } else {
          setIsNearHub(false)
          if (lastNearSent) {
            lastNearSent = false
            window.dispatchEvent(new CustomEvent('calculator-near-hub', { detail: { near: false } }))
          }
        }
      }

      latestYPx = newYPx
      latestXPx = newXPx
      latestDist = dist
      setDragPreviewY(newYPx)
      setDragPreviewX(newXPx)
      setDragOffset({ x: 0, y: 0 })
    }

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)

      setIsDraggingIcon(false)
      setIsNearHub(false)
      setIsDraggingFromHub(false)

      if (lastNearSent) {
        window.dispatchEvent(new CustomEvent('calculator-near-hub', { detail: { near: false } }))
      }

      if (floatingCalculatorAbsorbed) {
        if (latestDist >= 80 && hubFab) {
          // Detach/pull-out successful!
          updateSetting('floatingCalculatorAbsorbed', false)
          toast.success('Calculadora desanexada do botão de ações!')
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([15, 30, 15])
            }
          } catch {
            // ignore
          }

          // Salva a nova posição de soltura!
          const finalSide = latestXPx < window.innerWidth / 2 ? 'left' : 'right'
          const finalPercent = calculatePercentFromY(latestYPx, viewportHeight, buttonHeight)
          commitPosition(finalSide, finalPercent)
          setDragOffset({ x: 0, y: 0 })
          setDragPreviewY(null)
          setDragPreviewX(null)
          return
        } else {
          // Snap back to hub: just clean drag offsets and keep absorbed setting
          setIsIconReturning(true)
          if (hubFab) {
            const hubRect = hubFab.getBoundingClientRect()
            const targetYPx = hubRect.top + hubRect.height / 2 - 20
            const targetXPx = hubRect.left + hubRect.width / 2 - 20
            setDragPreviewY(targetYPx)
            setDragPreviewX(targetXPx)
          }
          iconReturnTimeoutRef.current = setTimeout(() => {
            setIsIconReturning(false)
            setDragOffset({ x: 0, y: 0 })
            setDragPreviewY(null)
            setDragPreviewX(null)
          }, RETURN_ANIMATION_MS)
          return
        }
      }

      if (latestDist < 80 && hubFab) {
        // Absorbed!
        setIsIconAbsorbing(true)
        updateSetting('floatingCalculatorAbsorbed', true)
        toast.success('Calculadora integrada ao botão de ações!')
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([15, 30, 15])
          }
        } catch {
          // ignore vibration fails
        }
        const hubRect = hubFab.getBoundingClientRect()
        const targetYPx = hubRect.top + hubRect.height / 2 - 20
        const targetXPx = hubRect.left + hubRect.width / 2 - 20
        setDragPreviewY(targetYPx)
        setDragPreviewX(targetXPx)
        setTimeout(() => {
          setIsIconAbsorbing(false)
          setDragOffset({ x: 0, y: 0 })
          setDragPreviewY(null)
          setDragPreviewX(null)
        }, 320)
        return
      }

      if (iconDragMovedRef.current) {
        // Calcula a posição final em percentual usando o valor síncrono mais recente
        const finalSide = latestXPx < window.innerWidth / 2 ? 'left' : 'right'
        const finalPercent = calculatePercentFromY(latestYPx, viewportHeight, buttonHeight)
        commitPosition(finalSide, finalPercent)

        // Anima o retorno suave (somente de escala, já que Y é atualizado sem offset)
        setIsIconReturning(true)
        setDragOffset({ x: 0, y: 0 })
        setDragPreviewY(null)
        setDragPreviewX(null)

        iconReturnTimeoutRef.current = setTimeout(() => {
          setIsIconReturning(false)
        }, 520)
      } else {
        // Se não moveu, é um clique — mantém posição
        setDragOffset({ x: 0, y: 0 })
        setDragPreviewY(null)
        setDragPreviewX(null)
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }, [slotTop, floatingCalculatorAbsorbed, updateSetting, commitPosition])

  // Listen to start-drag-from-hub events from PageActionButtonHub.tsx
  useEffect(() => {
    const handleStartDragFromHub = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      setIsDraggingFromHub(true)
      initiateIconDrag(detail.clientX, detail.clientY, detail.pointerId, detail.target)
    }
    window.addEventListener('start-drag-from-hub', handleStartDragFromHub)
    return () => {
      window.removeEventListener('start-drag-from-hub', handleStartDragFromHub)
    }
  }, [initiateIconDrag])

  return {
    isNearHub,
    isDraggingFromHub,
    isIconAbsorbing,
    isDraggingIcon,
    isIconReturning,
    dragPreviewY,
    dragPreviewX,
    dragOffset,
    iconDragMovedRef,
    initiateIconDrag,
  }
}
