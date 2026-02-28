import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="bg-secondary border-b border-primary safe-area-top motion-standard">
      <div className="px-4 py-4 lg:px-6 flex items-start sm:items-center justify-between gap-3 motion-standard">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary">{title}</h1>
          {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 ml-2 sm:ml-4 flex items-center motion-standard [&>*]:min-h-9">{action}</div>}
      </div>
    </header>
  )
}



