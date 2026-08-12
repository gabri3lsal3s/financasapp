import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ativa micro-interações de motion (padrão dos cards clicáveis). */
  interactive?: boolean
}

/** Card de superfície glass — ponto único para o padrão surface-glass + border-glass. */
export function GlassCard({
  interactive = false,
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'surface-glass border border-glass rounded-2xl',
        interactive && 'motion-standard hover-lift-subtle press-subtle select-none',
        className,
      )}
      {...props}
    />
  )
}
