import { ReactNode, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalPanelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

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
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black bg-opacity-50 safe-area-top safe-area-bottom animate-fade-in motion-standard p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalPanelRef}
        className="bg-primary w-full max-w-md max-h-[calc(100vh-2rem)] rounded-2xl shadow-xl border border-primary overflow-hidden animate-slide-up motion-emphasis"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between p-4 border-b border-primary">
          <h2 id={titleId} className="text-xl font-bold text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-tertiary rounded-full motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
          >
            <X size={20} className="text-primary" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 text-primary max-h-[calc(100vh-10rem)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}





