import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import NotificationsWidget from '@/components/NotificationsWidget'
import { Z_INDEX } from '@/constants/zIndex'
import { useScrollToTop } from '@/hooks/useScrollToTop'

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
  const {
    isAtBottom,
    overscrollOffset,
    pullStage,
    isInteracting,
    isActive,
    handleClick,
    setupScrollListener,
    setupTouchListeners,
    setupWheelListener,
    scrollToTop,
    setupOverscrollSync,
  } = useScrollToTop()

  useEffect(setupScrollListener, [setupScrollListener])
  useEffect(setupTouchListeners, [setupTouchListeners])
  useEffect(setupWheelListener, [setupWheelListener])
  useEffect(setupOverscrollSync, [setupOverscrollSync])

  const shouldBeVisible = isAtBottom || overscrollOffset > 0
  const dragProgress = pullStage !== 'collapsed' ? 1 : Math.min(1, overscrollOffset / 35)

  return (
    <AnimatePresence>
      {shouldBeVisible && (
        <div
          className={[
            `fixed ${Z_INDEX.CONTENT} left-[var(--sidebar-offset,0px)] right-0`,
            'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-8',
            'flex justify-center pointer-events-none',
          ].join(' ')}
        >
          <motion.div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                scrollToTop()
              }
            }}
            layout
            initial={{ opacity: 0, scale: 0.8, y: 0 }}
            animate={{
              opacity: Math.min(1, 0.45 + dragProgress * 0.55),
              scale: isActive ? 1.08 : 1 + dragProgress * 0.04,
              y: 0,
              width: 40 + dragProgress * 150,
              paddingLeft: overscrollOffset >= 15 ? 16 : 10,
              paddingRight: overscrollOffset >= 15 ? 16 : 10,
              paddingTop: 10,
              paddingBottom: 10,
              backgroundColor: isActive
                ? 'hsl(var(--primary))'
                : overscrollOffset > 0
                ? 'var(--glass-surface)'
                : 'rgba(255,255,255,0)',
              borderColor: isActive
                ? 'rgba(0,0,0,0)'
                : overscrollOffset > 0
                ? 'var(--glass-border)'
                : 'rgba(255,255,255,0)',
              color: isActive
                ? 'hsl(var(--primary-foreground))'
                : 'var(--ds-color-text-secondary)',
              boxShadow: isActive
                ? 'var(--glass-shadow-elevated)'
                : overscrollOffset > 0
                ? 'var(--glass-shadow-panel)'
                : 'none',
            }}
            exit={{ opacity: 0, scale: 0.8, y: 0, transition: { duration: 0.2 } }}
            transition={isInteracting
              ? {
                  type: 'spring',
                  stiffness: 300,
                  damping: 28,
                  opacity: { type: 'tween', duration: 0.15 }
                }
              : {
                  type: 'spring',
                  stiffness: 250,
                  damping: 25
                }
            }
            whileHover={{
              color: isActive
                ? 'hsl(var(--primary-foreground))'
                : 'hsl(var(--primary))',
              backgroundColor: isActive
                ? 'hsl(var(--primary))'
                : overscrollOffset > 0
                ? 'var(--glass-layer-interactive)'
                : 'rgba(255, 255, 255, 0.05)',
              borderColor: isActive
                ? 'rgba(0, 0, 0, 0)'
                : overscrollOffset > 0
                ? 'var(--glass-border-strong)'
                : 'rgba(255, 255, 255, 0.1)',
            }}
            className="pointer-events-auto flex items-center justify-center select-none cursor-pointer rounded-full border"
            style={{
              height: '40px',
              originX: 0.5,
            }}
            aria-label="Voltar ao topo"
            title="Voltar ao topo"
          >
            <div className="flex items-center justify-center gap-1.5 w-full h-full">
              <motion.div
                animate={
                  isActive
                    ? { y: [-3, 3, -3] }
                    : overscrollOffset === 0
                    ? { y: [0, -3, 0] }
                    : { y: 0 }
                }
                transition={
                  isActive
                    ? { repeat: Infinity, duration: 0.8, ease: 'easeInOut' }
                    : overscrollOffset === 0
                    ? { repeat: Infinity, duration: 2.0, ease: 'easeInOut' }
                    : { duration: 0.2 }
                }
                className="flex items-center justify-center"
              >
                <ChevronUp size={18} className="shrink-0" />
              </motion.div>

              <motion.span
                animate={{
                  opacity: overscrollOffset >= 15 ? 1 : 0,
                  width: overscrollOffset >= 15 ? 'auto' : 0,
                  scale: overscrollOffset >= 15 ? 1 : 0.95,
                }}
                transition={isInteracting
                  ? {
                      type: 'spring',
                      stiffness: 300,
                      damping: 28,
                      opacity: { type: 'tween', duration: 0.15 }
                    }
                  : {
                      type: 'spring',
                      stiffness: 250,
                      damping: 25
                    }
                }
                className="text-xs font-semibold whitespace-nowrap overflow-hidden"
              >
                {isActive ? 'Solte para subir!' : 'Deslize para subir'}
              </motion.span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
