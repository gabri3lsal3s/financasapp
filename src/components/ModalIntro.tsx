import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalIntroProps {
  children: ReactNode
  align?: 'start' | 'center'
  className?: string
}

/** Texto introdutório padronizado dentro de modais (picker, confirmação). */
export default function ModalIntro({ children, align = 'start', className }: ModalIntroProps) {
  return (
    <p
      className={cn(
        'modal-intro',
        align === 'center' && 'modal-intro--center',
        className
      )}
    >
      {children}
    </p>
  )
}
