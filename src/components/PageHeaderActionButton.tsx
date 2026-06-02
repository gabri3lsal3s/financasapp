import { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Button, { type ButtonVariant } from '@/components/Button'
import { cn } from '@/lib/utils'

export type PageHeaderActionIntent = 'neutral' | 'primary' | 'income' | 'expense' | 'balance' | 'warning'

const intentVariantMap: Record<PageHeaderActionIntent, ButtonVariant> = {
  neutral: 'outline',
  primary: 'primary',
  income: 'income',
  expense: 'expense',
  balance: 'balance',
  warning: 'warning',
}

interface PageHeaderActionButtonProps extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  label?: string
  icon?: LucideIcon
  intent?: PageHeaderActionIntent
  /** Oculta o rótulo em telas estreitas (mantém ícone). */
  compactOnMobile?: boolean
  children?: ReactNode
}

export default function PageHeaderActionButton({
  label,
  icon: Icon,
  intent = 'neutral',
  compactOnMobile = true,
  variant,
  size = 'sm',
  className,
  children,
  ...props
}: PageHeaderActionButtonProps) {
  const resolvedVariant = variant ?? intentVariantMap[intent]

  return (
    <Button
      size={size}
      variant={resolvedVariant}
      className={cn('gap-2 font-semibold', className)}
      {...props}
    >
      {Icon ? <Icon size={16} className="shrink-0" aria-hidden /> : null}
      {children ?? (
        label ? (
          <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>{label}</span>
        ) : null
      )}
    </Button>
  )
}
