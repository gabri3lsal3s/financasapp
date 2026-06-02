import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderActionsProps {
  children: ReactNode
  className?: string
}

/** Agrupa CTAs do `PageHeader` com espaçamento e alinhamento consistentes. */
export function PageHeaderActions({ children, className }: PageHeaderActionsProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-stretch justify-stretch gap-2 sm:w-auto sm:items-center sm:justify-end',
        className
      )}
    >
      {children}
    </div>
  )
}
