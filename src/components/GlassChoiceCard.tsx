import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type GlassChoiceIntent = 'income' | 'expense' | 'balance' | 'neutral'

const INTENT_ICON_CLASS: Record<GlassChoiceIntent, string> = {
  income: 'bg-income/10 text-income',
  expense: 'bg-expense/10 text-expense',
  balance: 'bg-balance/10 text-balance',
  neutral: 'bg-accent text-secondary',
}

interface GlassChoiceCardProps {
  label: string
  icon: ReactNode
  intent?: GlassChoiceIntent
  onClick: () => void
  className?: string
}

/** Card interativo L3 — glass-on-glass dentro de modais (ex.: seletor de tipo de lançamento). */
export default function GlassChoiceCard({
  label,
  icon,
  intent = 'neutral',
  onClick,
  className,
}: GlassChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('glass-choice-card', `glass-choice-card--${intent}`, className)}
    >
      <div className={cn('glass-choice-card__icon', INTENT_ICON_CLASS[intent])}>{icon}</div>
      <span className="glass-choice-card__label">{label}</span>
    </button>
  )
}
