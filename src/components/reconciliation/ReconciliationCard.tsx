import { ReactNode } from 'react'
import Card from '@/components/Card'
import { cn } from '@/lib/utils'

export type ReconciliationVariant = 'primary' | 'balance' | 'warning' | 'expense'

interface ReconciliationCardProps {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  variant?: ReconciliationVariant
  index?: number
  className?: string
}

const variantStyles: Record<ReconciliationVariant, string> = {
  primary: 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 bg-[var(--glass-layer-interactive)] shadow-sm',
  balance: 'border-[color-mix(in_srgb,var(--color-balance)_40%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-balance)_8%,var(--glass-layer-panel))] shadow-sm ring-1 ring-[var(--color-balance)]/15',
  warning: 'border-[color-mix(in_srgb,var(--color-warning)_40%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-warning)_8%,var(--glass-layer-panel))] shadow-sm ring-1 ring-[var(--color-warning)]/15',
  expense: 'border-[color-mix(in_srgb,var(--color-expense)_40%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-expense)_8%,var(--glass-layer-panel))] shadow-sm ring-1 ring-[var(--color-expense)]/15',
}

export default function ReconciliationCard({
  children,
  selected = false,
  onClick,
  variant = 'primary',
  index,
  className = '',
}: ReconciliationCardProps) {
  const staggerClass =
    index !== undefined
      ? `animate-stagger-item delay-${((index % 5) + 1) * 50}`
      : ''

  return (
    <Card
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 space-y-2 cursor-pointer transition-all duration-200 text-left',
        staggerClass,
        selected
          ? variantStyles[variant]
          : 'border-glass modal-panel-glass hover:border-glass-strong hover:bg-[var(--glass-surface-strong)]',
        className
      )}
    >
      {children}
    </Card>
  )
}
