import { createContext, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Ação estruturada de página — espelha PageAction de usePageActions.tsx. */
export interface RawPageAction {
  icon: LucideIcon
  label: string
  intent?: 'neutral' | 'primary' | 'income' | 'expense' | 'balance' | 'warning'
  onClick: () => void
  actionRole?: 'launch' | 'secondary'
  disabled?: boolean
  title?: string
  className?: string
  show?: boolean
  compactOnMobile?: boolean
}

export interface FloatingActionsStateValue {
  actions: ReactNode | null
  rawActions: RawPageAction[]
  launchModalOpen: boolean
}

export interface FloatingActionsDispatchValue {
  setActions: (actions: ReactNode | null) => void
  setRawActions: (actions: RawPageAction[]) => void
  setLaunchModalOpen: (open: boolean) => void
}

export const FloatingActionsStateContext = createContext<FloatingActionsStateValue | null>(null)
export const FloatingActionsDispatchContext = createContext<FloatingActionsDispatchValue | null>(null)
