import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-primary rounded-lg shadow-sm border border-primary p-4 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}


