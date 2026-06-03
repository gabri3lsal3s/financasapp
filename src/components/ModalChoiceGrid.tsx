import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalChoiceGridProps {
  children: ReactNode
  className?: string
}

/** Grid responsivo para GlassChoiceCard dentro de modais picker. */
export default function ModalChoiceGrid({ children, className }: ModalChoiceGridProps) {
  return <div className={cn('modal-choice-grid', className)}>{children}</div>
}
