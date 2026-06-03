import { ReactNode, useContext, useLayoutEffect } from 'react'
import { FloatingActionsContext } from '@/contexts/floatingActionsSharedContext'

export function useFloatingActions() {
  const context = useContext(FloatingActionsContext)
  if (!context) {
    throw new Error('useFloatingActions must be used within FloatingActionsProvider')
  }
  return context
}

/** Registra CTAs flutuantes da página atual; limpa ao desmontar (evita duplicatas no stack). */
export function useRegisterFloatingActions(action: ReactNode | undefined): void {
  const setActions = useContext(FloatingActionsContext)?.setActions

  useLayoutEffect(() => {
    if (!setActions) return

    setActions(action ?? null)
    return () => {
      setActions(null)
    }
  }, [action, setActions])
}
