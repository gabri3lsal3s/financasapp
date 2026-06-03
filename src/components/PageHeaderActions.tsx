import { Children, ReactNode, isValidElement, useContext, useLayoutEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { FLOATING_SIDE_GAP } from '@/components/floatingSideLayout'
import { FloatingActionsContext } from '@/contexts/floatingActionsSharedContext'
import type { PageHeaderActionRole } from '@/components/PageHeaderActionButton'

interface PageHeaderActionsProps {
  children: ReactNode
  className?: string
  /** Oculta botões secundários quando um modal de lançamento está aberto. */
  launchModalOpen?: boolean
}

function readActionRole(child: ReactNode): PageHeaderActionRole {
  if (!isValidElement(child)) return 'secondary'
  const role = (child.props as { actionRole?: PageHeaderActionRole }).actionRole
  return role === 'launch' ? 'launch' : 'secondary'
}

/** Agrupa CTAs do `PageHeader` com espaçamento e alinhamento consistentes de forma vertical ou horizontal. */
export function PageHeaderActions({
  children,
  className,
  launchModalOpen = false,
}: PageHeaderActionsProps) {
  const setLaunchModalOpen = useContext(FloatingActionsContext)?.setLaunchModalOpen

  useLayoutEffect(() => {
    if (!setLaunchModalOpen) return

    setLaunchModalOpen(launchModalOpen)
    return () => {
      setLaunchModalOpen(false)
    }
  }, [launchModalOpen, setLaunchModalOpen])

  const visibleChildren = useMemo(() => {
    const items = Children.toArray(children)
    const sorted = [...items].sort((a, b) => {
      const aLaunch = readActionRole(a) === 'launch' ? 0 : 1
      const bLaunch = readActionRole(b) === 'launch' ? 0 : 1
      return aLaunch - bLaunch
    })

    if (!launchModalOpen) {
      return sorted
    }

    return sorted.filter((child) => readActionRole(child) === 'launch')
  }, [children, launchModalOpen])

  return (
    <div
      className={cn(
        'flex w-auto pointer-events-auto overflow-visible flex-col items-end',
        FLOATING_SIDE_GAP,
        className
      )}
    >
      {visibleChildren}
    </div>
  )
}
