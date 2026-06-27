import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import NotificationsWidget from '@/components/NotificationsWidget'
import { Z_INDEX } from '@/constants/zIndex'

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
  const [pullStage, setPullStage] = useState<'collapsed' | 'first-stage' | 'second-stage'>('collapsed')
  const [isInteracting, setIsInteracting] = useState(false)

  const isActive = pullStage === 'second-stage'

  const isAnimatingRef = useRef(false)
  const touchStartRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wasStageRef = useRef<'collapsed' | 'first-stage' | 'second-stage'>('collapsed')
  const interactionStartStageRef = useRef<'collapsed' | 'first-stage' | 'second-stage'>('collapsed')

  const isInteractingRef = useRef(false)
  const isAtBottomRef = useRef(false)
  const arrivedAtBottomTimeRef = useRef(0)
  const overscrollOffsetRef = useRef(0)
  const baseOffsetRef = useRef(0)
  const hasDraggedRef = useRef(false)
  const gestureTypeRef = useRef<'none' | 'overscroll' | 'scroll'>('none')
  const pullStageRef = useRef<'collapsed' | 'first-stage' | 'second-stage'>('collapsed')

  // Sincroniza a ref com o estágio atual
  useEffect(() => {
    pullStageRef.current = pullStage
  }, [pullStage])

  const handleClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    scrollToTop()
  }

  const checkScroll = () => {
    if (isDraggingRef.current) return

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight

    // Usuário está no final da página (tolerância de 15px)
    const atBottom = scrollTop + windowHeight >= documentHeight - 15
    // Somente mostra se a página for rolável (pelo menos 150px extras)
    const isScrollable = documentHeight > windowHeight + 150

    if (isInteractingRef.current) return

    const finalAtBottom = atBottom && isScrollable
    if (finalAtBottom && !isAtBottomRef.current) {
      arrivedAtBottomTimeRef.current = performance.now()
    }
    isAtBottomRef.current = finalAtBottom
    setIsAtBottom(finalAtBottom)
  }

  const scrollToTop = () => {
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true
    triggerHaptic('trigger')

    const startPos = window.scrollY || document.documentElement.scrollTop
    if (startPos <= 0) {
      isAnimatingRef.current = false
      return
    }

    const startTime = performance.now()
    const cancelEvents = ['touchstart', 'mousedown', 'wheel', 'keydown']

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
  }

  // Verifica se o usuário chegou no final da página
  useEffect(() => {
    window.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll, { passive: true })
    checkScroll()

    return () => {
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [])

  const triggerHaptic = (type: 'start' | 'active' | 'cancel' | 'trigger') => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'start') {
          navigator.vibrate(5)
        } else if (type === 'active') {
          navigator.vibrate(15)
        } else if (type === 'cancel') {
          navigator.vibrate([5, 30, 5])
        } else if (type === 'trigger') {
          navigator.vibrate([12, 20, 12])
        }
      }
    } catch (err) {
      // Ignora falhas da API de vibração
    }
  }

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

  // Gerencia eventos de touch (mobile) de forma persistente com classificação de gestos
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // O gesto de puxar só deve ser iniciado se a página já estava no rodapé
      // no momento do toque inicial e respeita o tempo de acomodação contra inércia.
      if (e.touches.length === 1 && isAtBottomRef.current) {
        if (performance.now() - arrivedAtBottomTimeRef.current < 350) {
          return
        }
        touchStartRef.current = e.touches[0].clientY
        isDraggingRef.current = true
        isInteractingRef.current = true
        setIsInteracting(true)
        hasDraggedRef.current = false
        gestureTypeRef.current = 'none'
        baseOffsetRef.current = overscrollOffsetRef.current
        interactionStartStageRef.current = pullStageRef.current
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || touchStartRef.current === null) return

      const currentY = e.touches[0].clientY
      const deltaY = (touchStartRef.current - currentY) * 0.35 // positivo ao arrastar para cima

      if (deltaY > 5) {
        hasDraggedRef.current = true
      }

      // Classifica o gesto no primeiro movimento significativo
      if (gestureTypeRef.current === 'none') {
        if (Math.abs(deltaY) > 2) {
          gestureTypeRef.current = deltaY > 0 ? 'overscroll' : 'scroll'
        }
      }

      // Se for um gesto de overscroll (puxar para cima)
      if (gestureTypeRef.current === 'overscroll') {
        // Evita comportamento padrão do browser (scroll elástico nativo)
        // para impedir o cancelamento do toque
        if (e.cancelable) {
          e.preventDefault()
        }

        // Calcula o novo offset acumulado a partir do baseOffset
        const newOffset = Math.max(0, Math.min(125, baseOffsetRef.current + deltaY))
        overscrollOffsetRef.current = newOffset
        setOverscrollOffset(newOffset)

        const currentStage = pullStageRef.current

        // Transições da máquina de estados baseadas no offset
        if (currentStage === 'collapsed') {
          if (newOffset >= 35) {
            setPullStage('first-stage')
          }
        } else if (currentStage === 'first-stage') {
          if (interactionStartStageRef.current === 'first-stage' && newOffset >= 90) {
            setPullStage('second-stage')
          } else if (newOffset <= 10) {
            setPullStage('collapsed')
          }
        } else if (currentStage === 'second-stage') {
          if (newOffset < 50) {
            setPullStage('first-stage')
          }
        }
      } else if (gestureTypeRef.current === 'scroll') {
        // Se for rolagem para cima normal, reseta estados locais
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
        scrollToTop()
        setTimeout(() => {
          overscrollOffsetRef.current = 0
          setOverscrollOffset(0)
          setPullStage('collapsed')
        }, 300)
      } else if (finalStage === 'first-stage') {
        // Permanece travado no primeiro estágio ("Deslize para subir")
        overscrollOffsetRef.current = 30
        setOverscrollOffset(30)
      } else {
        // Retornou para collapsed
        overscrollOffsetRef.current = 0
        setOverscrollOffset(0)
      }

      touchStartRef.current = null
      gestureTypeRef.current = 'none'

      // Re-verifica se o scroll mudou após finalizar a interação
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
  }, [])

  // Gerencia eventos de wheel (desktop)
  useEffect(() => {
    if (!isAtBottom) {
      setOverscrollOffset(0)
      setPullStage('collapsed')
      setIsInteracting(false)
      isInteractingRef.current = false
      return
    }

    const handleWheel = (e: WheelEvent) => {
      if (isDraggingRef.current) return
      
      // Evita ativação imediata se acabou de chegar no rodapé por rolagem rápida (inércia)
      if (performance.now() - arrivedAtBottomTimeRef.current < 350) {
        return
      }

      const deltaY = e.deltaY

      if (deltaY > 0) {
        if (!isInteractingRef.current) {
          isInteractingRef.current = true
          setIsInteracting(true)
          interactionStartStageRef.current = pullStageRef.current
        }
        setOverscrollOffset((prev) => {
          const next = Math.min(125, prev + deltaY * 0.12)
          
          const currentStage = pullStageRef.current
          if (currentStage === 'collapsed' && next >= 35) {
            setPullStage('first-stage')
          } else if (currentStage === 'first-stage' && interactionStartStageRef.current === 'first-stage' && next >= 90) {
            setPullStage('second-stage')
          }
          
          return next
        })

        if (wheelTimeoutRef.current) {
          clearTimeout(wheelTimeoutRef.current)
        }

        wheelTimeoutRef.current = setTimeout(() => {
          isInteractingRef.current = false
          setIsInteracting(false)
          
          const finalStage = pullStageRef.current
          if (finalStage === 'second-stage') {
            scrollToTop()
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
        setOverscrollOffset((prev) => {
          const next = Math.max(0, prev + deltaY * 0.12)
          
          const currentStage = pullStageRef.current
          if (currentStage === 'second-stage' && next < 50) {
            setPullStage('first-stage')
          } else if (currentStage === 'first-stage' && next <= 10) {
            setPullStage('collapsed')
          }
          
          if (next === 0) {
            isInteractingRef.current = false
            setIsInteracting(false)
            setTimeout(checkScroll, 50)
          }
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

  // Sincroniza a propriedade CSS de overscroll e a classe de interação no layout raiz
  useEffect(() => {
    document.documentElement.style.setProperty('--overscroll-offset', `${overscrollOffset}px`)
    const root = document.querySelector('.app-layout-root')
    if (root) {
      if (isInteracting) {
        root.classList.add('is-interacting')
      } else {
        root.classList.remove('is-interacting')
      }
    }
  }, [overscrollOffset, isInteracting])

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--overscroll-offset')
      const root = document.querySelector('.app-layout-root')
      if (root) {
        root.classList.remove('is-interacting')
      }
    }
  }, [])

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
            }}
            exit={{ opacity: 0, scale: 0.8, y: 0, transition: { duration: 0.2 } }}
            transition={isInteracting
              ? {
                  scale: { type: 'spring', stiffness: 200, damping: 20 },
                  opacity: { type: 'tween', duration: 0.15 },
                  layout: { type: 'spring', stiffness: 200, damping: 20 }
                }
              : {
                  type: 'spring',
                  stiffness: 250,
                  damping: 25
                }
            }
            className={[
              'pointer-events-auto',
              'flex items-center justify-center select-none cursor-pointer',
              'rounded-full transition-all duration-300',
              isActive
                ? 'bg-primary text-primary-foreground border border-transparent'
                : 'surface-glass border border-glass text-secondary hover:text-primary hover:bg-glass/95 hover:border-glass-strong',
            ].join(' ')}
            style={{
              boxShadow: isActive
                ? 'var(--glass-shadow-elevated)'
                : 'var(--glass-shadow-panel)',
              padding: overscrollOffset >= 15 ? '10px 16px' : '10px',
              width: `${40 + dragProgress * 150}px`,
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

              <AnimatePresence>
                {overscrollOffset >= 15 && (
                  <motion.span
                    initial={{ opacity: 0, width: 0, scale: 0.95 }}
                    animate={{ opacity: 1, width: 'auto', scale: 1 }}
                    exit={{ opacity: 0, width: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="text-xs font-semibold whitespace-nowrap overflow-hidden"
                  >
                    {isActive ? 'Solte para subir!' : 'Deslize para subir'}
                  </motion.span>
                )}
              </AnimatePresence>
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
