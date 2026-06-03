import { ReactNode, useCallback, useMemo, useState } from 'react'
import { FloatingActionsContext } from '@/contexts/floatingActionsSharedContext'

export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode | null>(null)
  const [launchModalOpen, setLaunchModalOpenState] = useState(false)

  const setActions = useCallback((node: ReactNode | null) => {
    setActionsState(node)
  }, [])

  const setLaunchModalOpen = useCallback((open: boolean) => {
    setLaunchModalOpenState(open)
  }, [])

  const value = useMemo(
    () => ({
      actions,
      setActions,
      launchModalOpen,
      setLaunchModalOpen,
    }),
    [actions, setActions, launchModalOpen, setLaunchModalOpen]
  )

  return (
    <FloatingActionsContext.Provider value={value}>
      {children}
    </FloatingActionsContext.Provider>
  )
}
