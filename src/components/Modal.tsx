import { ReactNode, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
}

export default function Modal({ isOpen, onClose, title, children, maxWidth }: ModalProps) {
  const modalPanelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    const timer = window.setTimeout(() => {
      const container = modalPanelRef.current
      if (!container) return

      const firstFocusable = container.querySelector<HTMLElement>(
        'input, select, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )

      firstFocusable?.focus()
    }, 50)

    return () => window.clearTimeout(timer)
  }, [isOpen])

  // Framer Motion Variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  }

  const mobilePanelVariants = {
    hidden: { y: "100%" },
    visible: { y: 0 },
    exit: { y: "100%" }
  }

  const desktopPanelVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 12 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 12 }
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-top safe-area-bottom overflow-hidden">
          {/* Backdrop Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
            onClick={onClose}
            role="presentation"
          />

          {/* Modal Panel / Bottom Sheet */}
          <motion.div
            ref={modalPanelRef}
            variants={isMobile ? mobilePanelVariants : desktopPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={
              isMobile
                ? { type: "spring", damping: 28, stiffness: 260 }
                : { duration: 0.2, ease: "easeOut" }
            }
            className={`bg-primary w-full shadow-2xl border-t sm:border border-primary overflow-hidden flex flex-col z-[1000] relative max-h-[90vh] sm:max-h-[calc(100vh-4rem)] ${
              isMobile
                ? 'rounded-t-[1.75rem] rounded-b-none'
                : `rounded-2xl ${maxWidth || 'max-w-md'}`
            }`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {/* Mobile Drag Indicator */}
            {isMobile && (
              <div className="w-12 h-1.5 bg-primary/25 rounded-full mx-auto my-3 shrink-0" />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-primary shrink-0">
              <h2 id={titleId} className="text-lg font-black text-primary uppercase tracking-tight leading-tight">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full border border-primary bg-secondary text-secondary hover:text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                <X size={16} className="text-primary" />
              </button>
            </div>

            {/* Scrollable content body */}
            <div className="overflow-y-auto p-5 text-primary flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}





