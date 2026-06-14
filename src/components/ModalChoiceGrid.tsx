import { Children, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalChoiceGridProps {
  children: ReactNode
  className?: string
}

/** Grid responsivo para GlassChoiceCard dentro de modais picker. */
export default function ModalChoiceGrid({ children, className }: ModalChoiceGridProps) {
  const childCount = Children.count(children)
  return (
    <div
      className={cn(
        'modal-choice-grid',
        childCount === 2 && 'modal-choice-grid--2-cols',
        className
      )}
    >
      {children}
    </div>
  )
}
