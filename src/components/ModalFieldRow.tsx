import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalFieldRowProps {
  children: ReactNode
  className?: string
}

/** Duas colunas responsivas para pares de campos em modais. */
export default function ModalFieldRow({ children, className }: ModalFieldRowProps) {
  return <div className={cn('modal-field-row', className)}>{children}</div>
}
