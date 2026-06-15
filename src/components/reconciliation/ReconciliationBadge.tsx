import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'conflict' | 'missing' | 'system' | 'official' | 'success' | 'warning'

interface ReconciliationBadgeProps {
  variant: BadgeVariant
  children: ReactNode
  title?: string
  className?: string
}

const badgeStyles: Record<BadgeVariant, string> = {
  conflict: 'bg-warning/10 text-warning border-warning/10',
  missing: 'bg-expense/10 text-expense border-expense/10',
  system: 'bg-expense/10 text-expense border-expense/10',
  official: 'bg-balance/10 text-balance border-balance/10',
  success: 'bg-income/10 text-income border-income/10',
  warning: 'bg-warning/10 text-warning border-warning/10',
}

export default function ReconciliationBadge({
  variant,
  children,
  title,
  className = '',
}: ReconciliationBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap inline-flex items-center justify-center font-sans',
        badgeStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
