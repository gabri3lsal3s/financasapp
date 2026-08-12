import { formatCurrencyByCode } from '@/utils/format'
import { cn } from '@/lib/utils'

export type AmountSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
export type AmountTone = 'default' | 'muted' | 'income' | 'expense' | 'balance'
export type AmountWeight = 'semibold' | 'bold' | 'extrabold'

interface AmountTextProps {
  value: number
  currency?: 'BRL' | 'USD'
  size?: AmountSize
  tone?: AmountTone
  weight?: AmountWeight
  /** Prefixa '+' para valores positivos (ex.: fluxos de renda). */
  forceSign?: boolean
  /** Impede quebra de linha — use com moderação (valores longos em grids 2 colunas). */
  nowrap?: boolean
  className?: string
  title?: string
}

const sizeClasses: Record<AmountSize, string> = {
  xs: 'text-[10px] sm:text-[11px]',
  sm: 'text-sm sm:text-base',
  md: 'text-base sm:text-lg',
  lg: 'text-lg sm:text-xl',
  xl: 'text-xl sm:text-2xl',
  '2xl': 'text-2xl sm:text-3xl',
  '3xl': 'text-3xl sm:text-4xl',
}

const toneClasses: Record<AmountTone, string> = {
  default: 'text-primary',
  muted: 'text-secondary',
  income: 'text-income',
  expense: 'text-expense',
  balance: 'text-balance',
}

const weightClasses: Record<AmountWeight, string> = {
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
}

/**
 * Exibição padronizada de valores monetários (DRY):
 * tipografia tabular, espaçamento de dígitos e formatação via `format.ts`.
 * Nunca formatar moeda à mão fora daqui (Regra 3 dos guardrails).
 */
export default function AmountText({
  value,
  currency = 'BRL',
  size = 'md',
  tone = 'default',
  weight = 'bold',
  forceSign = false,
  nowrap = false,
  className,
  title,
}: AmountTextProps) {
  const formatted = formatCurrencyByCode(value, currency)
  const display = forceSign && value > 0 ? `+${formatted}` : formatted

  return (
    <span
      title={title}
      className={cn(
        'font-mono tabular-nums tracking-tight leading-tight',
        nowrap && 'whitespace-nowrap',
        sizeClasses[size],
        toneClasses[tone],
        weightClasses[weight],
        className,
      )}
    >
      {display}
    </span>
  )
}
