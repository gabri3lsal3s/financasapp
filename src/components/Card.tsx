import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-[var(--color-bg-primary)] rounded-lg shadow-sm border border-[var(--color-border)] p-4 transition-all duration-[var(--transition-fast)] ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}





