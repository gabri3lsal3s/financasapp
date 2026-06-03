import { ReactNode } from 'react'
import { useRegisterFloatingActions } from '@/hooks/useFloatingActions'

interface PageHeaderProps {
  title?: string
  subtitle?: string
  /** @deprecated Use `subtitle` */
  context?: string
  breadcrumb?: string[]
  action?: ReactNode
  /** Empilha título e ações no mobile (recomendado). */
  responsiveStack?: boolean
  breadcrumbs?: ReactNode
  className?: string
}

export default function PageHeader({
  action,
}: PageHeaderProps) {
  useRegisterFloatingActions(action)
  return null
}

export { PageHeaderActions } from '@/components/PageHeaderActions'
