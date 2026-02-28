import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-primary rounded-lg shadow-sm border border-primary p-4 motion-standard ${
        onClick ? 'cursor-pointer hover:shadow-md hover-lift-subtle press-subtle' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}





