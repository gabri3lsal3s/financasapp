import { useState, useEffect, useRef } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const SCROLL_DURATION_MS = 500 // scroll animado mais rápido que o padrão do navegador (~800ms)
const HOLD_DELAY_MS = 800      // tempo de pressão contínua para evitar disparo acidental
const BOTTOM_THRESHOLD = 80    // px do final para considerar "no fim da página"

export default function ScrollToTop({ scrollAreaRef }: { scrollAreaRef?: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoldingRef = useRef(false)
  const isAnimatingRef = useRef(false)

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    isHoldingRef.current = false
  }

  // Scroll suave customizado com duração e aceleração controladas
  const smoothScrollToTop = () => {
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true

    const startPosition = scrollAreaRef?.current
      ? scrollAreaRef.current.scrollTop
      : window.scrollY || document.documentElement.scrollTop

    if (startPosition <= 0) {
      isAnimatingRef.current = false
      return
    }

    const startTime = performance.now()

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1)

      // Easing: cubic ease-out para desaceleração confortável
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentPos = Math.max(0, startPosition * (1 - easeOut))

      if (scrollAreaRef?.current) {
        scrollAreaRef.current.scrollTop = currentPos
      } else {
        window.scrollTo(0, currentPos)
      }

      if (progress < 1) {
        requestAnimationFrame(animateScroll)
      } else {
        isAnimatingRef.current = false
      }
    }

    requestAnimationFrame(animateScroll)
  }

  const triggerScrollToTop = () => {
    setVisible(true)
    smoothScrollToTop()
    // Esconde o aviso após a animação começar
    setTimeout(() => setVisible(false), 350)
    clearHoldTimer()
  }

  // Inicia o timer de pressão — só dispara se usuário continuar pressionando
  const startHoldTimer = () => {
    if (isAnimatingRef.current) return
    if (isHoldingRef.current) return
    isHoldingRef.current = true

    holdTimerRef.current = setTimeout(triggerScrollToTop, HOLD_DELAY_MS)
  }

  useEffect(() => {
    const el = scrollAreaRef?.current || window

    const isAtBottom = (): boolean => {
      let scrollTop: number
      let clientHeight: number
      let scrollHeight: number

      if (scrollAreaRef?.current) {
        const area = scrollAreaRef.current
        scrollTop = area.scrollTop
        clientHeight = area.clientHeight
        scrollHeight = area.scrollHeight
      } else {
        scrollTop = window.scrollY
        clientHeight = window.innerHeight
        scrollHeight = document.documentElement.scrollHeight
      }

      return scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD
    }

    // Se o usuário sair do final da página, cancela tudo
    const onScroll = () => {
      if (isAnimatingRef.current) return
      if (!isAtBottom()) {
        clearHoldTimer()
        setVisible(false)
      }
    }

    // Wheel / trackpad: rolar para baixo no fim da página = "pressionando"
    const onWheel = (e: Event) => {
      if (isAnimatingRef.current) return
      const we = e as WheelEvent
      if (we.deltaY > 0 && isAtBottom()) {
        startHoldTimer()
      } else if (we.deltaY < 0) {
        // Rolar para cima — cancela
        clearHoldTimer()
        setVisible(false)
      }
    }

    // Touch (mobile): detecta pressão mantida no final
    let touchStartY = 0
    let wasAtBottomOnTouch = false

    const onTouchStart = (e: Event) => {
      if (isAnimatingRef.current) return
      const te = e as TouchEvent
      touchStartY = te.touches[0].clientY
      wasAtBottomOnTouch = isAtBottom()
    }

    const onTouchMove = (e: Event) => {
      if (isAnimatingRef.current) return
      const te = e as TouchEvent
      const deltaY = touchStartY - te.touches[0].clientY
      // deltaY > 0 = dedo subindo = tentando rolar para baixo
      if (wasAtBottomOnTouch && deltaY > 0) {
        startHoldTimer()
      } else if (!isAtBottom()) {
        clearHoldTimer()
        setVisible(false)
      }
    }

    const onTouchEnd = () => {
      // Se o usuário soltar o dedo antes do timer, cancela
      if (!isAnimatingRef.current) {
        clearHoldTimer()
        setVisible(false)
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel as EventListener, { passive: true })
    el.addEventListener('touchstart', onTouchStart as EventListener, { passive: true })
    el.addEventListener('touchmove', onTouchMove as EventListener, { passive: true })
    el.addEventListener('touchend', onTouchEnd as EventListener, { passive: true })

    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      clearHoldTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollAreaRef])

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full border border-glass bg-glass/70 text-secondary shadow-lg transition-all duration-300 motion-standard pointer-events-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
      aria-live="polite"
    >
      <ChevronUp size={16} />
      <span className="text-xs font-semibold whitespace-nowrap">Voltar ao topo</span>
    </div>
  )
}
