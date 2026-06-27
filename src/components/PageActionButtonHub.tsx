import { useState, useLayoutEffect, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useFloatingActions } from '@/hooks/useFloatingActions'
import { cn } from '@/lib/utils'

/**
 * PageActionButtonHub — pílula flutuante de ações de página.
 *
 * Visual idêntico ao menu de navegação mobile (glass-bottom-nav).
 * Ícones sempre em cor neutra (text-secondary), exceto quando o intent
 * indica um estado condicional ativo (non-neutral).
 *
 * Comportamentos:
 * - 0 ações: some com animação (scale + fade para baixo)
 * - 1 ação:  clique direto, sem submenu
 * - 2+ ações: abre speed dial vertical com spring animations
 */

const intentIconColor: Record<string, string> = {
  primary: 'var(--ds-color-accent-primary)',
  income:  'var(--color-income)',
  expense: 'var(--color-expense)',
  balance: 'var(--color-balance)',
  warning: 'var(--color-warning)',
  neutral: 'var(--color-text-secondary)',
}

function getIconColor(intent: string | undefined): string {
  return intentIconColor[intent ?? 'neutral'] ?? intentIconColor.neutral
}

/** Variantes de animação do FAB raiz (aparece / some) */
const fabVariants = {
  hidden: {
    opacity: 0,
    scale: 0.72,
    y: 16,
    transition: {
      type: 'spring' as const,
      stiffness: 320,
      damping: 28,
    },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 440,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.72,
    y: 14,
    transition: {
      type: 'spring' as const,
      stiffness: 360,
      damping: 30,
    },
  },
}

function PageActionButtonHubPortalContent() {
  const { rawActions } = useFloatingActions()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const visibleActions = rawActions.filter((a) => a.show !== false)

  // Cache the last seen non-empty actions to prevent flickering during page transitions
  const [cachedActions, setCachedActions] = useState<typeof visibleActions>([])
  useEffect(() => {
    if (visibleActions.length > 0) {
      setCachedActions(visibleActions)
    }
  }, [visibleActions])

  const isSettingsPage = location.pathname === '/settings'
  const hasActions = visibleActions.length > 0 || !isSettingsPage

  const activeActions = visibleActions.length > 0 ? visibleActions : cachedActions
  const hasSingleAction = activeActions.length === 1
  const hasMultipleActions = activeActions.length > 1

  // Fecha speed dial ao clicar fora
  useEffect(() => {
    if (!isOpen) return
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [isOpen])

  // Fecha speed dial ao trocar de página
  useEffect(() => {
    setIsOpen(false)
  }, [rawActions])

  const primaryAction = activeActions.find((a) => a.actionRole === 'launch') ?? activeActions[0]
  const PrimaryIcon = hasSingleAction
    ? (primaryAction?.icon ?? Plus)
    : isOpen ? X : Plus

  // FAB icon: neutral (como nav inativo), exceto toggle condicional ativo (non-neutral intent)
  const fabIconColor = hasSingleAction
    ? getIconColor(primaryAction?.intent)
    : 'var(--color-text-secondary)'

  const handleMainClick = () => {
    if (hasSingleAction && primaryAction) {
      primaryAction.onClick()
    } else {
      setIsOpen((prev) => !prev)
    }
  }

  return (
    // AnimatePresence detecta quando hasActions muda e anima a entrada/saída
    <AnimatePresence mode="wait">
      {hasActions && (
        <motion.div
          ref={containerRef}
          key="page-action-hub"
          className="page-action-hub-root"
          variants={fabVariants}
          initial="hidden"
          animate="visible"
          exit={{
            opacity: 0,
            scale: 0.72,
            y: 14,
            transition: isSettingsPage
              ? { duration: 0.05, ease: 'easeOut' }
              : { type: 'spring' as const, stiffness: 360, damping: 30 }
          }}
        >
          {/* Speed dial — surge de baixo para cima sobre o FAB */}
          <AnimatePresence>
            {isOpen && hasMultipleActions && (
              <div className="page-action-hub-dial">
                {[...activeActions].reverse().map((action, revIdx) => {
                  const Icon = action.icon
                  const naturalIdx = activeActions.length - 1 - revIdx
                  const itemIconColor = getIconColor(action.intent)

                  return (
                    <motion.div
                      key={action.label}
                      className="page-action-hub-dial-item"
                      initial={{ opacity: 0, y: 14, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.88 }}
                      transition={{
                        type: 'spring',
                        stiffness: 440,
                        damping: 32,
                        delay: naturalIdx * 0.04,
                      }}
                    >
                      <motion.span
                        className="page-action-hub-dial-label"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        transition={{ delay: naturalIdx * 0.04 + 0.05 }}
                      >
                        {action.label}
                      </motion.span>

                      <button
                        type="button"
                        onClick={() => {
                          if (!action.disabled) {
                            action.onClick()
                            setIsOpen(false)
                          }
                        }}
                        disabled={action.disabled}
                        title={action.title ?? action.label}
                        style={{ pointerEvents: 'auto' }}
                        className={cn(
                          'page-action-hub-dial-btn',
                          action.disabled && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <Icon
                          size={18}
                          style={{ color: itemIconColor, flexShrink: 0 }}
                          aria-hidden
                        />
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>

          {/* Botão FAB principal */}
          <motion.button
            type="button"
            onClick={handleMainClick}
            title={
              hasSingleAction && primaryAction
                ? (primaryAction.title ?? primaryAction.label)
                : isOpen ? 'Fechar' : 'Ações'
            }
            disabled={hasSingleAction && primaryAction?.disabled}
            style={{ pointerEvents: 'auto' }}
            className={cn(
              'page-action-hub-fab',
              hasSingleAction && primaryAction?.disabled && 'opacity-40 cursor-not-allowed',
            )}
            whileTap={{ scale: 0.93 }}
            animate={{ rotate: hasMultipleActions && isOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            <PrimaryIcon
              size={22}
              style={{ flexShrink: 0, color: fabIconColor, transition: 'color 200ms ease' }}
              aria-hidden
            />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function PageActionButtonHub() {
  // useLayoutEffect: monta na mesma passagem de pintura que o nav — sem delay visual
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(<PageActionButtonHubPortalContent />, document.body)
}
