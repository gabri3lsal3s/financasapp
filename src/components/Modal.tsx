import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 safe-area-top safe-area-bottom animate-fade-in">
      <div className="bg-[var(--color-bg-primary)] w-full max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col border border-[var(--color-border)] animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-hover)] rounded-full transition-all duration-[var(--transition-fast)] hover:scale-[1.05] active:scale-[0.95]"
          >
            <X size={20} className="text-[var(--color-text-primary)]" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 text-[var(--color-text-primary)]">
          {children}
        </div>
      </div>
    </div>
  )
}


