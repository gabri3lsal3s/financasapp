import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="bg-secondary border-b border-primary safe-area-top motion-standard">
      <div className="px-4 py-3 lg:px-6 flex flex-row items-center justify-between gap-4 motion-standard">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-primary truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-secondary mt-0.5 sm:mt-1 truncate">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 flex items-center motion-standard [&>*]:min-h-8 sm:[&>*]:min-h-9">{action}</div>}
      </div>
    </header>
  )
}



