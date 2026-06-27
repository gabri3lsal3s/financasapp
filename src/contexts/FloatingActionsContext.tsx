import { ReactNode, useCallback, useMemo, useState } from 'react'
import {
  FloatingActionsStateContext,
  FloatingActionsDispatchContext,
  type RawPageAction,
} from '@/contexts/floatingActionsSharedContext'

export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode | null>(null)
  const [rawActions, setRawActionsState] = useState<RawPageAction[]>([])
  const [launchModalOpen, setLaunchModalOpenState] = useState(false)

  const setActions = useCallback((node: ReactNode | null) => {
    setActionsState(node)
  }, [])

  const setRawActions = useCallback((acts: RawPageAction[]) => {
    setRawActionsState(acts)
  }, [])

  const setLaunchModalOpen = useCallback((open: boolean) => {
    setLaunchModalOpenState(open)
  }, [])

  const stateValue = useMemo(
    () => ({
      actions,
      rawActions,
      launchModalOpen,
    }),
    [actions, rawActions, launchModalOpen]
  )

  const dispatchValue = useMemo(
    () => ({
      setActions,
      setRawActions,
      setLaunchModalOpen,
    }),
    [setActions, setRawActions, setLaunchModalOpen]
  )

  return (
    <FloatingActionsStateContext.Provider value={stateValue}>
      <FloatingActionsDispatchContext.Provider value={dispatchValue}>
        {children}
      </FloatingActionsDispatchContext.Provider>
    </FloatingActionsStateContext.Provider>
  )
}
