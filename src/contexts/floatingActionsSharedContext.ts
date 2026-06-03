import { createContext, ReactNode } from 'react'

export interface FloatingActionsContextValue {
  actions: ReactNode | null
  setActions: (actions: ReactNode | null) => void
  launchModalOpen: boolean
  setLaunchModalOpen: (open: boolean) => void
}

export const FloatingActionsContext = createContext<FloatingActionsContextValue | null>(null)
