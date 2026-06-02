import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
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
  title,
  subtitle,
  context,
  breadcrumb,
  action,
  responsiveStack = true,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const resolvedSubtitle = subtitle ?? context
  const resolvedBreadcrumbs = breadcrumbs ?? (
    breadcrumb?.length ? <span>{breadcrumb.join(' / ')}</span> : undefined
  )

  return (
    <header
      className={cn(
        'surface-glass relative z-30 border-b border-glass safe-area-top motion-standard',
        className
      )}
    >
      <div
        className={cn(
          'px-4 py-3 lg:px-6',
          responsiveStack
            ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
            : 'flex items-center justify-between gap-4'
        )}
      >
        <div className="min-w-0 flex-1">
          {resolvedBreadcrumbs ? (
            <div className="mb-1 hidden text-xs text-secondary lg:block">{resolvedBreadcrumbs}</div>
          ) : null}
          <h1 className="truncate text-lg font-bold tracking-tight text-primary sm:text-xl">{title}</h1>
          {resolvedSubtitle ? (
            <p className="mt-0.5 truncate text-xs text-secondary sm:text-sm">{resolvedSubtitle}</p>
          ) : null}
        </div>
        {action ? (
          <div
            className={cn(
              'flex shrink-0 items-center gap-2',
              responsiveStack && 'w-full sm:w-auto'
            )}
          >
            {action}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export { PageHeaderActions } from '@/components/PageHeaderActions'
