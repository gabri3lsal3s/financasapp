import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldLabelProps {
  children: ReactNode
  htmlFor?: string
  className?: string
  /** Tamanho do texto: 'sm' (8px), 'md' (9px, default), 'lg' (10px) */
  size?: 'sm' | 'md' | 'lg'
  required?: boolean
}

const sizeClasses = {
  sm: 'text-[8px]',
  md: 'text-[9px]',
  lg: 'text-[10px]',
}

/**
 * Label padronizado para campos de formulário.
 * Segue o padrão visual do app: uppercase, font-black, text-secondary.
 *
 * @example
 * <FieldLabel htmlFor="name" required>Nome do Ativo</FieldLabel>
 * <FieldLabel size="sm">Tier S (Ex: 20%)</FieldLabel>
 * <FieldLabel size="lg" className="flex justify-between">ROIC Excelente (%)</FieldLabel>
 */
export default function FieldLabel({
  children,
  htmlFor,
  className,
  size = 'md',
  required,
}: FieldLabelProps) {
  const classes = cn(
    'uppercase font-black text-secondary tracking-wider',
    sizeClasses[size],
    required && 'after:content-[\'*\'] after:text-danger after:ml-0.5',
    className,
  )

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={classes}>
        {children}
      </label>
    )
  }

  return (
    <span className={classes}>
      {children}
    </span>
  )
}
