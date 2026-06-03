import { ReactNode } from 'react'
import { useRegisterFloatingActions } from '@/hooks/useFloatingActions'

interface PageHeaderProps {
  action?: ReactNode
}

export default function PageHeader({ action }: PageHeaderProps) {
  useRegisterFloatingActions(action)
  return null
}

export { PageHeaderActions } from '@/components/PageHeaderActions'
