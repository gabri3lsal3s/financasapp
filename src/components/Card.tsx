import { Card as CardPrimitive } from '@/components/ui/card'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  style?: CSSProperties
  id?: string
}

/**
 * Card com padding padrão e transições de hover.
 * A funcionalidade de onClick + keyboard accessibility vem diretamente de `ui/card`.
 *
 * Prefira usar `Card` de `@/components/ui/card` para novo código.
 */
export default function Card({ children, className = '', onClick, style, id }: CardProps) {
  return (
    <CardPrimitive
      id={id}
      className={cn(
        'p-4 transition-all duration-300 hover:border-glass-strong hover:shadow-md',
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </CardPrimitive>
  )
}
