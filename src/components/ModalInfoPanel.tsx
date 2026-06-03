import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalInfoPanelProps {
  children: ReactNode
  className?: string
}

/** Painel L2 informativo dentro de modais (checkbox, toggles, avisos). */
export default function ModalInfoPanel({ children, className }: ModalInfoPanelProps) {
  return (
    <div className={cn('modal-info-panel animate-page-enter', className)}>
      {children}
    </div>
  )
}
