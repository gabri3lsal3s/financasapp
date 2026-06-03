import { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Button from '@/components/Button'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  FLOATING_SIDE_BUTTON_NEUTRAL,
  getFloatingSideTabButtonClassName,
} from '@/components/floatingSideLayout'

export type PageHeaderActionIntent = 'neutral' | 'primary' | 'income' | 'expense' | 'balance' | 'warning'

export type PageHeaderActionRole = 'launch' | 'secondary'

interface PageHeaderActionButtonProps extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  label?: string
  icon?: LucideIcon
  intent?: PageHeaderActionIntent
  /** Botões de lançamento ficam no topo do stack lateral. */
  actionRole?: PageHeaderActionRole
  /** Oculta o rótulo em telas estreitas (mantém ícone). */
  compactOnMobile?: boolean
  children?: ReactNode
}

export default function PageHeaderActionButton({
  label,
  icon: Icon,
  intent = 'neutral',
  actionRole = 'secondary',
  compactOnMobile: _compactOnMobile = true,
  variant: _variant,
  size: _size = 'sm',
  className,
  children,
  ...props
}: PageHeaderActionButtonProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const intentTextClass: Record<PageHeaderActionIntent, string> = {
    neutral: 'text-primary',
    primary: 'text-[var(--ds-color-accent-primary)]',
    income: 'text-primary',
    expense: 'text-primary',
    balance: 'text-primary',
    warning: 'text-primary',
  }

  const buttonClasses = cn(FLOATING_SIDE_BUTTON_NEUTRAL, intentTextClass[intent])

  const iconColorMap: Record<PageHeaderActionIntent, string> = {
    neutral: 'text-primary',
    primary: 'text-[var(--ds-color-accent-primary)]',
    income: 'text-income',
    expense: 'text-expense',
    balance: 'text-balance',
    warning: 'text-warning',
  }

  const labelClasses =
    'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-2.5'

  const sideTabClassName = cn(
    getFloatingSideTabButtonClassName('right', buttonClasses),
    className
  )

  const renderContent = () => {
    const textClasses = cn(
      'transition-all duration-300 ease-in-out whitespace-nowrap text-xs sm:text-sm font-bold uppercase tracking-wider',
      labelClasses
    )
    if (children) {
      if (typeof children === 'string') {
        return (
          <span className={textClasses}>
            {children}
          </span>
        )
      }
      return children
    }
    if (label) {
      return (
        <span className={textClasses}>
          {label}
        </span>
      )
    }
    return null
  }

  return (
    <button
      type="button"
      className={sideTabClassName}
      {...props}
      data-floating-action-role={actionRole}
    >
      {Icon ? <Icon size={isDesktop ? 18 : 16} className={cn('shrink-0', iconColorMap[intent])} aria-hidden /> : null}
      {renderContent()}
    </button>
  )
}
