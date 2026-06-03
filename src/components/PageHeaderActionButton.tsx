import { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Button from '@/components/Button'
import { cn } from '@/lib/utils'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export type PageHeaderActionIntent = 'neutral' | 'primary' | 'income' | 'expense' | 'balance' | 'warning'

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
  variant: _variant,
  size = 'sm',
  className,
  children,
  ...props
}: PageHeaderActionButtonProps) {
  const { floatingButtonsDesktopPosition, floatingButtonsMobilePosition } = useAppSettings()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const activePosition = isDesktop ? floatingButtonsDesktopPosition : floatingButtonsMobilePosition

  const isPrimary = intent === 'primary'

  const buttonClasses = isPrimary
    ? 'text-[var(--ds-color-accent-primary)] border-[color-mix(in_srgb,var(--ds-color-accent-primary)_45%,transparent)] hover:border-[color-mix(in_srgb,var(--ds-color-accent-primary)_85%,transparent)] hover:bg-[color-mix(in_srgb,var(--ds-color-accent-primary)_15%,transparent)] glass-glow-button-primary'
    : 'text-primary border-[var(--floating-btn-border)] hover:border-[var(--floating-btn-border-hover)] hover:bg-accent/60 glass-glow-button-neutral'

  const iconColorMap: Record<PageHeaderActionIntent, string> = {
    neutral: 'text-primary',
    primary: 'text-[var(--ds-color-accent-primary)]',
    income: 'text-income',
    expense: 'text-expense',
    balance: 'text-balance',
    warning: 'text-warning',
  }

  const labelClasses = compactOnMobile
    ? 'max-w-0 overflow-hidden opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-2.5'
    : 'max-w-[14rem] opacity-100 ml-2 sm:ml-2.5'

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

  // Symmetrical classes based on active position (left/right/top)
  const positionClasses = {
    top: 'rounded-b-2xl rounded-t-none border-x border-b border-t-0 pt-2.5 pb-2 px-4',
    left: 'rounded-r-2xl rounded-l-none border-y border-r border-l-0 pl-6 pr-4',
    right: 'rounded-l-2xl rounded-r-none border-y border-l border-r-0 pl-4 pr-6',
  }[activePosition]

  return (
    <Button
      size={size}
      variant="ghost"
      className={cn(
        'group relative flex items-center justify-start h-10 shadow-lg transition-all duration-300 select-none pointer-events-auto surface-glass-strong motion-spring',
        positionClasses,
        buttonClasses,
        className
      )}
      {...props}
    >
      {Icon ? <Icon size={isDesktop ? 18 : 16} className={cn("shrink-0", iconColorMap[intent])} aria-hidden /> : null}
      {renderContent()}
    </Button>
  )
}


