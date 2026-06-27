import { createContext, ReactNode } from 'react'

export interface FloatingActionsStateValue {
  actions: ReactNode | null
  launchModalOpen: boolean
}

export interface FloatingActionsDispatchValue {
  setActions: (actions: ReactNode | null) => void
  setLaunchModalOpen: (open: boolean) => void
}

export const FloatingActionsStateContext = createContext<FloatingActionsStateValue | null>(null)
export const FloatingActionsDispatchContext = createContext<FloatingActionsDispatchValue | null>(null)
