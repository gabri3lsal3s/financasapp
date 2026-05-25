import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  responsiveStack?: boolean
}

export default function PageHeader({ title, subtitle, action, responsiveStack = false }: PageHeaderProps) {
  const containerClasses = responsiveStack
    ? "px-4 py-3.5 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 motion-standard"
    : "px-4 py-3 lg:px-6 flex items-center justify-between gap-4 motion-standard";

  const titleClasses = responsiveStack
    ? "text-lg sm:text-2xl font-black text-primary truncate leading-tight tracking-tight"
    : "text-xl sm:text-2xl font-bold text-primary truncate";

  const subtitleClasses = responsiveStack
    ? "text-[10px] sm:text-sm text-secondary mt-0.5 sm:mt-1 truncate font-medium"
    : "text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1 truncate";

  const actionClasses = responsiveStack
    ? "w-full sm:w-auto flex-shrink-0 flex items-center gap-2 motion-standard"
    : "flex-shrink-0 flex items-center gap-2 motion-standard";

  return (
    <header className="bg-secondary border-b border-primary safe-area-top motion-standard relative z-30">
      <div className={containerClasses}>
        <div className="flex-1 min-w-0">
          <h1 className={titleClasses}>{title}</h1>
          {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
        </div>
        {action && <div className={actionClasses}>{action}</div>}
      </div>
    </header>
  )
}



