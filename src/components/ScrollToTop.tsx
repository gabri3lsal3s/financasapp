import { useState, useEffect, useRef } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ScrollToTop({ scrollAreaRef }: { scrollAreaRef?: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false)
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAtBottomRef = useRef(false)

  const clearTimers = () => {
    if (triggerTimerRef.current) {
      clearTimeout(triggerTimerRef.current)
      triggerTimerRef.current = null
    }
  }

  const scrollToTop = () => {
    if (scrollAreaRef?.current) {
      scrollAreaRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    isAtBottomRef.current = false
    clearTimers()
  }

  useEffect(() => {
    const el = scrollAreaRef?.current || window

    const checkBottom = () => {
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

      const nearBottom = scrollHeight - scrollTop - clientHeight < 80

      if (nearBottom) {
        if (!isAtBottomRef.current) {
          isAtBottomRef.current = true
          // Delay curto para evitar disparo acidental em scroll rápido
          triggerTimerRef.current = setTimeout(() => {
            // Mostra o aviso e já inicia a rolagem ao topo simultaneamente
            setVisible(true)
            scrollToTop()
            // Esconde o aviso após a animação de rolagem começar
            setTimeout(() => setVisible(false), 600)
          }, 250)
        }
      } else {
        isAtBottomRef.current = false
        clearTimers()
        setVisible(false)
      }
    }

    el.addEventListener('scroll', checkBottom, { passive: true })

    return () => {
      el.removeEventListener('scroll', checkBottom)
      clearTimers()
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
