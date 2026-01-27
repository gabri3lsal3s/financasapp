import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] safe-area-top">
      <div className="px-4 py-4 lg:px-6 flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--color-text-secondary)] mt-1">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 ml-4">{action}</div>}
      </div>
    </header>
  )
}


