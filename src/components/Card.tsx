import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`bg-primary rounded-lg shadow-sm border border-primary p-4 motion-standard ${
        onClick
          ? 'cursor-pointer hover:shadow-md hover-lift-subtle press-subtle hover:bg-tertiary active:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'
          : ''
      } ${className}`}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}





