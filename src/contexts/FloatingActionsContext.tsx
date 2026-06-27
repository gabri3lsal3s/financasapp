import { ReactNode, useCallback, useMemo, useState } from 'react'
import {
  FloatingActionsStateContext,
  FloatingActionsDispatchContext,
} from '@/contexts/floatingActionsSharedContext'

export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode | null>(null)
  const [launchModalOpen, setLaunchModalOpenState] = useState(false)

  const setActions = useCallback((node: ReactNode | null) => {
    setActionsState(node)
  }, [])

  const setLaunchModalOpen = useCallback((open: boolean) => {
    setLaunchModalOpenState(open)
  }, [])

  const stateValue = useMemo(
    () => ({
      actions,
      launchModalOpen,
    }),
    [actions, launchModalOpen]
  )

  const dispatchValue = useMemo(
    () => ({
      setActions,
      setLaunchModalOpen,
    }),
    [setActions, setLaunchModalOpen]
  )

  return (
    <FloatingActionsStateContext.Provider value={stateValue}>
      <FloatingActionsDispatchContext.Provider value={dispatchValue}>
        {children}
      </FloatingActionsDispatchContext.Provider>
    </FloatingActionsStateContext.Provider>
  )
}
