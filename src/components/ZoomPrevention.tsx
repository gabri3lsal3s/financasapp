import { useEffect } from 'react'

/**
 * ZoomPrevention — camada JavaScript de proteção contra zoom.
 *
 * O viewport meta tag já tem `user-scalable=no, maximum-scale=1.0`
 * e o body já tem `touch-action: manipulation`, mas no iOS o
 * pinch-to-zoom pode burlar essas configurações em alguns cenários
 * (ex: inputs com < 16px — já corrigido, e Safari em modo navegador).
 *
 * Este componente adiciona listeners que:
 * 1. Previnem o evento `gesturestart` (iOS nativo, 2+ dedos)
 * 2. Previnem `touchmove` com 2+ dedos (pinch)
 *
 * Totalmente passivo — não interfere em scroll com 1 dedo ou
 * em interações de toque normais.
 */
export default function ZoomPrevention() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Handler para gesturestart (iOS específico — 2+ dedos)
    const handleGestureStart = (e: Event) => {
      e.preventDefault()
    }

    // Handler para touchmove com 2+ dedos (pinch-to-zoom)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    // Handler para gesturechange (iOS) — redundância de segurança
    const handleGestureChange = (e: Event) => {
      e.preventDefault()
    }

    // Handler para gestureend (iOS)
    const handleGestureEnd = (e: Event) => {
      e.preventDefault()
    }

    document.addEventListener('gesturestart', handleGestureStart, { passive: false })
    document.addEventListener('gesturechange', handleGestureChange, { passive: false })
    document.addEventListener('gestureend', handleGestureEnd, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', handleGestureStart)
      document.removeEventListener('gesturechange', handleGestureChange)
      document.removeEventListener('gestureend', handleGestureEnd)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return null
}
