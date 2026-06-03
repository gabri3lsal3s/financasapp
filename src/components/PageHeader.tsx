import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface PageHeaderProps {
  title?: string
  subtitle?: string
  /** @deprecated Use `subtitle` */
  context?: string
  breadcrumb?: string[]
  action?: ReactNode
  /** Empilha título e ações no mobile (recomendado). */
  responsiveStack?: boolean
  breadcrumbs?: ReactNode
  className?: string
}

export default function PageHeader({
  action,
  className,
}: PageHeaderProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.getElementById('page-actions-portal-root') : null
  )
  const { floatingButtonsDesktopPosition, floatingButtonsMobilePosition } = useAppSettings()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (!portalRoot) {
      setPortalRoot(document.getElementById('page-actions-portal-root'))
    }
  }, [portalRoot])

  if (!action) return null

  const activePosition = isDesktop ? floatingButtonsDesktopPosition : floatingButtonsMobilePosition
  const mobileSideAnchor = 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))]'

  const containerClasses = cn(
    'fixed z-40 pointer-events-none transition-all duration-300 animate-in fade-in-0 duration-300',
    activePosition === 'top'
      ? 'right-8 top-0'
      : activePosition === 'left'
      ? isDesktop
        ? 'left-0 top-32 lg:top-40'
        : cn('left-0', mobileSideAnchor)
      : isDesktop
        ? 'right-0 top-32 lg:top-40'
        : cn('right-0', mobileSideAnchor),
    className
  )

  const content = (
    <div className={containerClasses} style={{ transform: 'translate(0px, 0px)' }}>
      {action}
    </div>
  )

  if (portalRoot) {
    return createPortal(content, portalRoot)
  }

  return content
}

export { PageHeaderActions } from '@/components/PageHeaderActions'


