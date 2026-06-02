import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface PageHeaderActionsProps {
  children: ReactNode
  className?: string
}

/** Agrupa CTAs do `PageHeader` com espaçamento e alinhamento consistentes de forma vertical ou horizontal. */
export function PageHeaderActions({ children, className }: PageHeaderActionsProps) {
  const { floatingButtonsDesktopPosition, floatingButtonsMobilePosition } = useAppSettings()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const activePosition = isDesktop ? floatingButtonsDesktopPosition : floatingButtonsMobilePosition

  return (
    <div
      className={cn(
        'flex gap-2 w-auto pointer-events-auto',
        activePosition === 'top'
          ? 'flex-row items-start'
          : activePosition === 'left'
          ? 'flex-col items-start'
          : 'flex-col items-end',
        className
      )}
    >
      {children}
    </div>
  )
}

