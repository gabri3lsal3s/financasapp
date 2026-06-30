import { ReactNode } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'outline' | 'danger' | 'ghost' | 'ghost-success' | 'ghost-danger'
    className?: string
  }
  className?: string
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <Card className={`text-center py-10 space-y-4 ${className}`}>
      {icon && (
        <div className="flex justify-center text-secondary opacity-50">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-primary">{title}</p>
        {description && (
          <p className="text-xs text-secondary max-w-xs mx-auto leading-relaxed">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex justify-center pt-1">
          <Button
            onClick={action.onClick}
            variant={action.variant || 'primary'}
            className={action.className}
          >
            {action.label}
          </Button>
        </div>
      )}
    </Card>
  )
}
