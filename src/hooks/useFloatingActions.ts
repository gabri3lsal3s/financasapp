import { ReactNode, useContext, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  FloatingActionsStateContext,
  FloatingActionsDispatchContext,
  type RawPageAction,
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

/** Registra o array estruturado de ações da página atual; limpa ao desmontar. */
export function useRegisterRawActions(actions: RawPageAction[]): void {
  const dispatch = useContext(FloatingActionsDispatchContext)
  const location = useLocation()

  useLayoutEffect(() => {
    if (!dispatch) return

    dispatch.setRawActions(actions, location.pathname)
    return () => {
      dispatch.setRawActions([], null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, location.pathname, JSON.stringify(actions.map((a) => ({ label: a.label, intent: a.intent, disabled: a.disabled, show: a.show })))])
}
