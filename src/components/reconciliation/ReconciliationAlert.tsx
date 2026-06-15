import { ReactNode } from 'react'
import { AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AlertVariant = 'warning' | 'info' | 'success' | 'danger'

interface ReconciliationAlertProps {
  children: ReactNode
  variant?: AlertVariant
  title?: string
  className?: string
}

const alertStyles: Record<AlertVariant, { box: string; icon: string }> = {
  warning: {
    box: 'border-[color-mix(in_srgb,var(--color-warning)_25%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-warning)_6%,var(--glass-layer-panel))] text-warning',
    icon: 'text-warning',
  },
  danger: {
    box: 'border-[color-mix(in_srgb,var(--color-expense)_25%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-expense)_6%,var(--glass-layer-panel))] text-expense',
    icon: 'text-expense',
  },
  info: {
    box: 'border-[color-mix(in_srgb,var(--color-balance)_25%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-balance)_6%,var(--glass-layer-panel))] text-balance',
    icon: 'text-balance',
  },
  success: {
    box: 'border-[color-mix(in_srgb,var(--color-income)_25%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-income)_6%,var(--glass-layer-panel))] text-income',
    icon: 'text-income',
  },
}

export default function ReconciliationAlert({
  children,
  variant = 'warning',
  title,
  className = '',
}: ReconciliationAlertProps) {
  const styles = alertStyles[variant]
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'info' ? Info : AlertCircle

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 flex gap-2.5 items-start text-xs leading-normal text-left font-sans',
        styles.box,
        className
      )}
    >
      <Icon size={14} className={cn('shrink-0 mt-0.5', styles.icon)} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-bold text-primary mb-0.5">{title}</p>}
        <div className="text-secondary">{children}</div>
      </div>
    </div>
  )
}
