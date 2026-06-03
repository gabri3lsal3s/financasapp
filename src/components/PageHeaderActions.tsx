import { Children, ReactNode } from 'react'
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
  const actionCount = Children.count(children)
  const scrollManyOnMobile = !isDesktop && actionCount > 2

  return (
    <div
      className={cn(
        'flex gap-2 w-auto pointer-events-auto',
        activePosition === 'top'
          ? 'flex-row items-start'
          : activePosition === 'left'
          ? 'flex-col items-start'
          : 'flex-col items-end',
        scrollManyOnMobile &&
          'max-h-[min(50vh,320px)] overflow-y-auto overscroll-contain [scrollbar-width:thin]',
        className
      )}
    >
      {children}
    </div>
  )
}

