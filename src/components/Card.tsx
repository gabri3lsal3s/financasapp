import { CSSProperties, ReactNode } from 'react'
import { Card as ShadcnCard } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  style?: CSSProperties
}

export default function Card({ children, className = '', onClick, style }: CardProps) {
  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <ShadcnCard
      className={cn(
        'p-4',
        onClick
          ? 'cursor-pointer motion-standard press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'
          : '',
        className
      )}
      style={style}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </ShadcnCard>
  )
}
