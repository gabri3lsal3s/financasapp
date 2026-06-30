import { useState, useEffect, useRef, useCallback } from 'react'
import { triggerHaptic } from '@/utils/haptics'

const SCROLL_DURATION_MS = 450
const ARRIVED_AT_BOTTOM_DEBOUNCE_MS = 350
const BOTTOM_TOLERANCE_PX = 15
const MIN_SCROLLABLE_EXTRA_PX = 150

type PullStage = 'collapsed' | 'first-stage' | 'second-stage'

interface UseScrollToTopReturn {
  isAtBottom: boolean
  overscrollOffset: number
  pullStage: PullStage
  isInteracting: boolean
  isActive: boolean
  hasDragged: boolean
  handleClick: (e: React.MouseEvent) => void
  setupScrollListener: () => () => void
  setupTouchListeners: () => () => void
  setupWheelListener: () => () => void
  setupOverscrollSync: () => () => void
  scrollToTop: () => void
}

/**
 * Hook que gerencia o estado do botão "Voltar ao Topo" com suporte a pull gesture.
 *
 * Máquina de estados do pull:
 * - collapsed: offset < 35
 * - first-stage: offset >= 35 (mostra "Deslize para subir")
 * - second-stage: offset >= 90 (mostra "Solte para subir!")
 */
export function useScrollToTop(): UseScrollToTopReturn {
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [overscrollOffset, setOverscrollOffset] = useState(0)
  const [pullStage, setPullStage] = useState<PullStage>('collapsed')
  const [isInteracting, setIsInteracting] = useState(false)
  const [hasDragged, setHasDragged] = useState(false)

  const isAnimatingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const isInteractingRef = useRef(false)
  const isAtBottomRef = useRef(false)
  const touchStartRef = useRef<number | null>(null)
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overscrollOffsetRef = useRef(0)
  const baseOffsetRef = useRef(0)
  const hasDraggedRef = useRef(false)
  const pullStageRef = useRef<PullStage>('collapsed')
  const arrivedAtBottomTimeRef = useRef(0)
  const interactionStartStageRef = useRef<PullStage>('collapsed')
  const gestureTypeRef = useRef<'none' | 'overscroll' | 'scroll'>('none')
  const wasStageRef = useRef<PullStage>('collapsed')

  const isActive = pullStage === 'second-stage'

  // Sincroniza a ref com o estado
  useEffect(() => {
    pullStageRef.current = pullStage
  }, [pullStage])

  const checkScroll = useCallback(() => {
    if (isDraggingRef.current) return

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    const atBottom = scrollTop + windowHeight >= documentHeight - BOTTOM_TOLERANCE_PX
    const isScrollable = documentHeight > windowHeight + MIN_SCROLLABLE_EXTRA_PX

    if (isInteractingRef.current) return

    const finalAtBottom = atBottom && isScrollable
    if (finalAtBottom && !isAtBottomRef.current) {
      arrivedAtBottomTimeRef.current = performance.now()
    }
    isAtBottomRef.current = finalAtBottom
    setIsAtBottom(finalAtBottom)
  }, [])

  const scrollToTopFn = useCallback(() => {
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true
    triggerHaptic('trigger')

    const startPos = window.scrollY || document.documentElement.scrollTop
    if (startPos <= 0) {
      isAnimatingRef.current = false
      return
    }

    const startTime = performance.now()
    const cancelEvents = ['touchstart', 'mousedown', 'wheel', 'keydown'] as const

    const handleInterrupt = () => {
      isAnimatingRef.current = false
      cleanup()
    }

    const cleanup = () => {
      cancelEvents.forEach((event) => {
        window.removeEventListener(event, handleInterrupt)
      })
    }

    cancelEvents.forEach((event) => {
      window.addEventListener(event, handleInterrupt, { passive: true })
    })

    const animate = (now: number) => {
      if (!isAnimatingRef.current) {
        cleanup()
        return
      }

      const elapsed = now - startTime
      const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1)
      const easeOutCubic = 1 - Math.pow(1 - progress, 3)
      window.scrollTo(0, Math.max(0, startPos * (1 - easeOutCubic)))

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        isAnimatingRef.current = false
        cleanup()
      }
    }

    requestAnimationFrame(animate)
  }, [])

  // Monitora as transições do pullStage para disparar haptics multiestágio
  useEffect(() => {
    const prev = wasStageRef.current
    const curr = pullStage

    if (prev !== curr) {
      if (prev === 'collapsed' && curr === 'first-stage') {
        triggerHaptic('start')
      } else if (prev === 'first-stage' && curr === 'second-stage') {
        triggerHaptic('active')
      } else if (prev === 'second-stage' && curr === 'first-stage') {
        triggerHaptic('cancel')
      } else if (prev === 'first-stage' && curr === 'collapsed') {
        triggerHaptic('cancel')
      }
      wasStageRef.current = curr
    }
  }, [pullStage])

  // Reseta estados quando o usuário sai do rodapé
  useEffect(() => {
    if (!isAtBottom) {
      setOverscrollOffset(0)
      setPullStage('collapsed')
      isDraggingRef.current = false
      isInteractingRef.current = false
      setIsInteracting(false)
      overscrollOffsetRef.current = 0
      touchStartRef.current = null
    }
  }, [isAtBottom])

  const handleClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    scrollToTopFn()
  }

  // Scroll listener
  const setupScrollListener = useCallback(() => {
    window.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll, { passive: true })
    checkScroll()

    return () => {
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  // Touch listeners (mobile pull gesture)
  const setupTouchListeners = useCallback(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && isAtBottomRef.current) {
        if (performance.now() - arrivedAtBottomTimeRef.current < ARRIVED_AT_BOTTOM_DEBOUNCE_MS) return
        touchStartRef.current = e.touches[0].clientY
        isDraggingRef.current = true
        isInteractingRef.current = true
        setIsInteracting(true)
        hasDraggedRef.current = false
        setHasDragged(false)
        gestureTypeRef.current = 'none'
        baseOffsetRef.current = overscrollOffsetRef.current
        interactionStartStageRef.current = pullStageRef.current
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || touchStartRef.current === null) return

      const currentY = e.touches[0].clientY
      const deltaY = (touchStartRef.current - currentY) * 0.35

      if (deltaY > 5) {
        hasDraggedRef.current = true
        setHasDragged(true)
      }

      if (gestureTypeRef.current === 'none') {
        gestureTypeRef.current = Math.abs(deltaY) > 2
          ? (deltaY > 0 ? 'overscroll' : 'scroll')
          : 'none'
      }

      if (gestureTypeRef.current === 'overscroll') {
        if (e.cancelable) e.preventDefault()

        const newOffset = Math.max(0, Math.min(125, baseOffsetRef.current + deltaY))
        overscrollOffsetRef.current = newOffset
        setOverscrollOffset(newOffset)

        const currentStage = pullStageRef.current
        if (currentStage === 'collapsed' && newOffset >= 35) {
          setPullStage('first-stage')
        } else if (currentStage === 'first-stage') {
          if (interactionStartStageRef.current === 'first-stage' && newOffset >= 90) {
            setPullStage('second-stage')
          } else if (newOffset <= 10) {
            setPullStage('collapsed')
          }
        } else if (currentStage === 'second-stage' && newOffset < 50) {
          setPullStage('first-stage')
        }
      } else if (gestureTypeRef.current === 'scroll') {
        overscrollOffsetRef.current = 0
        setOverscrollOffset(0)
        setPullStage('collapsed')
      }
    }

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      isInteractingRef.current = false
      setIsInteracting(false)

      const finalStage = pullStageRef.current
      if (finalStage === 'second-stage') {
        scrollToTopFn()
        setTimeout(() => {
          overscrollOffsetRef.current = 0
          setOverscrollOffset(0)
          setPullStage('collapsed')
        }, 300)
      } else if (finalStage === 'first-stage') {
        overscrollOffsetRef.current = 30
        setOverscrollOffset(30)
      } else {
        overscrollOffsetRef.current = 0
        setOverscrollOffset(0)
      }

      touchStartRef.current = null
      gestureTypeRef.current = 'none'
      setTimeout(checkScroll, 50)
    }

    const handleTouchCancel = () => {
      isDraggingRef.current = false
      isInteractingRef.current = false
      setIsInteracting(false)
      overscrollOffsetRef.current = 0
      setOverscrollOffset(0)
      setPullStage('collapsed')
      touchStartRef.current = null
      gestureTypeRef.current = 'none'
      setTimeout(checkScroll, 50)
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: false })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchCancel)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [scrollToTopFn, checkScroll])

  // Wheel listener (desktop)
  const setupWheelListener = useCallback(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!isAtBottom || isDraggingRef.current) return

      if (performance.now() - arrivedAtBottomTimeRef.current < ARRIVED_AT_BOTTOM_DEBOUNCE_MS) return

      const deltaY = e.deltaY

      if (deltaY > 0) {
        if (!isInteractingRef.current) {
          isInteractingRef.current = true
          setIsInteracting(true)
          interactionStartStageRef.current = pullStageRef.current
        }

        const newOffset = Math.min(125, overscrollOffsetRef.current + deltaY * 0.12)
        overscrollOffsetRef.current = newOffset
        setOverscrollOffset(newOffset)

        const currentStage = pullStageRef.current
        if (currentStage === 'collapsed' && newOffset >= 35) {
          setPullStage('first-stage')
        } else if (currentStage === 'first-stage' && interactionStartStageRef.current === 'first-stage' && newOffset >= 90) {
          setPullStage('second-stage')
        }

        if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
        wheelTimeoutRef.current = setTimeout(() => {
          isInteractingRef.current = false
          setIsInteracting(false)

          const finalStage = pullStageRef.current
          if (finalStage === 'second-stage') {
            scrollToTopFn()
            setTimeout(() => {
              setOverscrollOffset(0)
              setPullStage('collapsed')
            }, 300)
          } else if (finalStage === 'first-stage') {
            setOverscrollOffset(30)
          } else {
            setOverscrollOffset(0)
          }
          setTimeout(checkScroll, 50)
        }, 150)
      } else if (deltaY < 0) {
        const newOffset = Math.max(0, overscrollOffsetRef.current + deltaY * 0.12)
        overscrollOffsetRef.current = newOffset
        setOverscrollOffset(newOffset)

        const currentStage = pullStageRef.current
        if (currentStage === 'second-stage' && newOffset < 50) {
          setPullStage('first-stage')
        } else if (currentStage === 'first-stage' && newOffset <= 10) {
          setPullStage('collapsed')
        }

        if (newOffset === 0) {
          isInteractingRef.current = false
          setIsInteracting(false)
          setTimeout(checkScroll, 50)
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
    }
  }, [isAtBottom, scrollToTopFn, checkScroll])

  // Overscroll CSS sync + interaction class
  const setupOverscrollSync = useCallback(() => {
    document.documentElement.style.setProperty('--overscroll-offset', `${overscrollOffset}px`)
    const root = document.querySelector('.app-layout-root')
    if (root) {
      if (isInteracting) {
        root.classList.add('is-interacting')
      } else {
        root.classList.remove('is-interacting')
      }
    }

    return () => {
      document.documentElement.style.removeProperty('--overscroll-offset')
      const root = document.querySelector('.app-layout-root')
      if (root) {
        root.classList.remove('is-interacting')
      }
    }
  }, [overscrollOffset, isInteracting])

  return {
    isAtBottom,
    overscrollOffset,
    pullStage,
    isInteracting,
    isActive,
    hasDragged,
    handleClick,
    setupScrollListener,
    setupTouchListeners,
    setupWheelListener,
    setupOverscrollSync,
    scrollToTop: scrollToTopFn,
  }
}
