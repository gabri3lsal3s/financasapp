import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="bg-secondary border-b border-primary safe-area-top motion-standard relative z-30">
      <div className="px-4 py-3.5 lg:px-6 flex items-center justify-between gap-4 motion-standard">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-black text-primary truncate leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="text-[10px] sm:text-sm text-secondary mt-0.5 sm:mt-1 truncate font-medium">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 flex items-center gap-2 motion-standard">{action}</div>}
      </div>
    </header>
  )
}



