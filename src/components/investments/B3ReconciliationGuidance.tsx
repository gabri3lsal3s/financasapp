import type { ReactNode } from 'react'
import { AlertCircle, Info } from 'lucide-react'

type GuidanceVariant = 'info' | 'warning' | 'success'

interface B3ReconciliationGuidanceProps {
  title: string
  children: ReactNode
  variant?: GuidanceVariant
}

const variantStyles: Record<GuidanceVariant, { box: string; icon: string }> = {
  info: {
    box: 'bg-balance/8 border-balance/25',
    icon: 'text-balance',
  },
  warning: {
    box: 'bg-warning/8 border-warning/25',
    icon: 'text-warning',
  },
  success: {
    box: 'bg-income/8 border-income/25',
    icon: 'text-income',
  },
}

export default function B3ReconciliationGuidance({
  title,
  children,
  variant = 'info',
}: B3ReconciliationGuidanceProps) {
  const styles = variantStyles[variant]
  const Icon = variant === 'warning' ? AlertCircle : Info

  return (
    <div className={`rounded-2xl border p-3.5 text-left flex gap-3 items-start ${styles.box}`}>
      <Icon size={16} className={`${styles.icon} shrink-0 mt-0.5`} />
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-bold text-primary">{title}</p>
        <div className="text-[11px] text-secondary leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
