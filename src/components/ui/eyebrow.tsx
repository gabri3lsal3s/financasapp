import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EyebrowProps {
  children: ReactNode
  /** Tom do texto (secundário por padrão — legível sobre glass). */
  tone?: 'secondary' | 'income' | 'expense' | 'primary'
  weight?: 'normal' | 'bold' | 'black'
  tracking?: 'wider' | 'widest'
  block?: boolean
  className?: string
}

const toneClasses = {
  secondary: 'text-secondary',
  income: 'text-income/80',
  expense: 'text-expense/80',
  primary: 'text-primary',
} as const

const weightClasses = {
  normal: 'font-normal',
  bold: 'font-bold',
  black: 'font-black',
} as const

const trackingClasses = {
  wider: 'tracking-wider',
  widest: 'tracking-widest',
} as const

/** Rótulo superior em caixa alta (eyebrow) — padroniza micro-títulos de seção. */
export function Eyebrow({
  children,
  tone = 'secondary',
  weight = 'bold',
  tracking = 'wider',
  block = false,
  className,
}: EyebrowProps) {
  return (
    <span
      className={cn(
        'text-[10px] uppercase',
        toneClasses[tone],
        weightClasses[weight],
        trackingClasses[tracking],
        block && 'block',
        className,
      )}
    >
      {children}
    </span>
  )
}
