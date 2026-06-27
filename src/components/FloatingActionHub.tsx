import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp } from 'lucide-react'
import NotificationsWidget from '@/components/NotificationsWidget'

const SCROLL_DURATION_MS = 450
const SHOW_THRESHOLD = 350
const HINT_THRESHOLD = 150

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
  const [visible, setVisible] = useState(false)
  const [hint, setHint] = useState(false)
  const isAnimatingRef = useRef(false)

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

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const fromBottom =
        document.documentElement.scrollHeight -
        scrollTop -
        window.innerHeight

      setVisible(scrollTop > SHOW_THRESHOLD)
      setHint(fromBottom < HINT_THRESHOLD && scrollTop > SHOW_THRESHOLD)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      onClick={scrollToTop}
      className={[
        'fixed z-50',
        'bottom-24 sm:bottom-6 right-4 sm:right-6',
        'flex items-center gap-2 pl-3 pr-4 sm:pl-4 sm:pr-5 py-2.5',
        'rounded-full border',
        'bg-glass/80 backdrop-blur-lg',
        'shadow-lg shadow-black/5',
        'transition-all duration-300 motion-standard',
        'select-none cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        'hover:bg-glass hover:shadow-xl hover:scale-105',
        'active:scale-95',
        visible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-90 pointer-events-none',
        hint && visible ? 'border-primary/20 scroll-hint-pulse' : 'border-glass',
      ].join(' ')}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
    >
      <ChevronUp size={16} className="shrink-0 text-primary" />
      <span className="text-xs font-semibold whitespace-nowrap hidden sm:inline text-primary">
        Voltar ao topo
      </span>
    </button>
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
