import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp } from 'lucide-react'
import NotificationsWidget from '@/components/NotificationsWidget'

const SCROLL_DURATION_MS = 450

/**
 * FloatingActionHub — hub unificado de elementos flutuantes.
 *
 * Centraliza em um único componente:
 * - ScrollToTop: botão de voltar ao topo (antes importado em cada página)
 * - NotificationsWidget: sino de notificações desktop
 *
 * A calculadora flutuante (FloatingCalculator) e o MobileAlertsPill
 * permanecem independentes por questões de complexidade e UX mobile.
 */
function ScrollToTopButton() {
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [overscrollOffset, setOverscrollOffset] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)

  const isAnimatingRef = useRef(false)
  const touchStartRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wasActiveRef = useRef(false)

  const scrollToTop = () => {
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true

    const startPos = window.scrollY || document.documentElement.scrollTop
    if (startPos <= 0) {
      isAnimatingRef.current = false
      return
    }

    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1)
      const easeOutCubic = 1 - Math.pow(1 - progress, 3)

      window.scrollTo(0, Math.max(0, startPos * (1 - easeOutCubic)))

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        isAnimatingRef.current = false
      }
    }

    requestAnimationFrame(animate)
  }

  // Verifica se o usuário chegou no final da página
  useEffect(() => {
    const checkScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      // Usuário está no final da página (tolerância de 15px)
      const atBottom = scrollTop + windowHeight >= documentHeight - 15
      // Somente mostra se a página for rolável (pelo menos 150px extras)
      const isScrollable = documentHeight > windowHeight + 150

      setIsAtBottom(atBottom && isScrollable)
    }

    window.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll, { passive: true })
    checkScroll()

    return () => {
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [])

  // Efeito de feedback tátil (vibração de 10ms)
  useEffect(() => {
    if (isActive !== wasActiveRef.current) {
      if (isActive) {
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate(10)
          }
        } catch (e) {
          // Ignora se não suportado
        }
      }
      wasActiveRef.current = isActive
    }
  }, [isActive])

  // Gerencia eventos de touch (mobile)
  useEffect(() => {
    if (!isAtBottom) {
      setOverscrollOffset(0)
      setIsActive(false)
      isDraggingRef.current = false
      touchStartRef.current = null
      setIsInteracting(false)
      return
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartRef.current = e.touches[0].clientY
        isDraggingRef.current = true
        setIsInteracting(true)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || touchStartRef.current === null) return

      const currentY = e.touches[0].clientY
      const deltaY = touchStartRef.current - currentY // positivo ao arrastar para cima

      if (deltaY > 0) {
        // Resistência elástica
        const calculatedOffset = Math.min(80, deltaY * 0.35)
        setOverscrollOffset(calculatedOffset)
        setIsActive(calculatedOffset >= 50)

        // Evita comportamento padrão do iOS Safari no overscroll
        if (e.cancelable) {
          e.preventDefault()
        }
      } else {
        setOverscrollOffset(0)
        setIsActive(false)
      }
    }

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsInteracting(false)

      if (overscrollOffset >= 50) {
        scrollToTop()
      }

      setOverscrollOffset(0)
      setIsActive(false)
      touchStartRef.current = null
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: false })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isAtBottom, overscrollOffset])

  // Gerencia eventos de wheel (desktop)
  useEffect(() => {
    if (!isAtBottom) {
      setOverscrollOffset(0)
      setIsActive(false)
      setIsInteracting(false)
      return
    }

    const handleWheel = (e: WheelEvent) => {
      const deltaY = e.deltaY

      if (deltaY > 0) {
        setIsInteracting(true)
        setOverscrollOffset((prev) => {
          const next = Math.min(80, prev + deltaY * 0.12)
          setIsActive(next >= 50)
          return next
        })

        if (wheelTimeoutRef.current) {
          clearTimeout(wheelTimeoutRef.current)
        }

        wheelTimeoutRef.current = setTimeout(() => {
          setOverscrollOffset((current) => {
            if (current >= 50) {
              scrollToTop()
            }
            return 0
          })
          setIsActive(false)
          setIsInteracting(false)
        }, 150)
      } else if (deltaY < 0) {
        setOverscrollOffset((prev) => {
          const next = Math.max(0, prev + deltaY * 0.12)
          setIsActive(next >= 50)
          return next
        })
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current)
      }
    }
  }, [isAtBottom])

  const shouldBeVisible = isAtBottom || overscrollOffset > 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={scrollToTop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          scrollToTop()
        }
      }}
      style={{
        transform: `translate(-50%, ${-overscrollOffset}px)`,
      }}
      className={[
        'fixed z-50 left-1/2 -translate-x-1/2',
        'bottom-24 lg:bottom-8',
        'flex items-center gap-2 pl-3.5 pr-4 py-2.5',
        'rounded-full border shadow-lg shadow-black/5',
        'select-none cursor-pointer',
        isInteracting ? 'transition-none' : 'transition-all duration-300 ease-out',
        shouldBeVisible
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-90 pointer-events-none translate-y-4',
        isActive
          ? 'bg-primary text-primary-foreground border-primary scale-105 shadow-xl'
          : 'bg-glass/80 backdrop-blur-lg border-glass text-primary hover:bg-glass',
      ].join(' ')}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
    >
      <ChevronUp
        size={16}
        className={[
          'shrink-0 transition-transform duration-300',
          isActive ? 'scale-110' : 'animate-bounce',
        ].join(' ')}
      />
      <span className="text-xs font-semibold whitespace-nowrap">
        {isActive ? 'Solte para subir!' : 'Deslize para subir'}
      </span>
    </div>
  )
}

export default function FloatingActionHub() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <>
      <ScrollToTopButton />
      <NotificationsWidget />
    </>,
    document.body
  )
}
