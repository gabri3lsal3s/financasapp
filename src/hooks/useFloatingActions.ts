import { ReactNode, useContext, useLayoutEffect } from 'react'
import {
  FloatingActionsStateContext,
  FloatingActionsDispatchContext,
} from '@/contexts/floatingActionsSharedContext'

export function useFloatingActions() {
  const context = useContext(FloatingActionsStateContext)
  if (!context) {
    throw new Error('useFloatingActions must be used within FloatingActionsProvider')
  }
  return context
}

/** Registra CTAs flutuantes da página atual; limpa ao desmontar (evita duplicatas no stack). */
export function useRegisterFloatingActions(action: ReactNode | undefined): void {
  const dispatch = useContext(FloatingActionsDispatchContext)

  useLayoutEffect(() => {
    if (!dispatch) return

    dispatch.setActions(action ?? null)
    return () => {
      dispatch.setActions(null)
    }
  }, [action, dispatch])
}
