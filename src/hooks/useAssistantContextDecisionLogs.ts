import { useEffect, useState } from 'react'
import {
  ASSISTANT_CONTEXT_DECISIONS_UPDATED_EVENT,
  clearAssistantContextDecisionLogs,
  getAssistantContextDecisionLogs,
} from '@/utils/assistantContextResolver'

export function useAssistantContextDecisionLogs() {
  const [logs, setLogs] = useState(() => getAssistantContextDecisionLogs())

  const refresh = () => {
    setLogs(getAssistantContextDecisionLogs())
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    window.addEventListener(ASSISTANT_CONTEXT_DECISIONS_UPDATED_EVENT, refresh)

    return () => {
      window.removeEventListener(ASSISTANT_CONTEXT_DECISIONS_UPDATED_EVENT, refresh)
    }
  }, [])

  return {
    logs,
    clearLogs: clearAssistantContextDecisionLogs,
    refresh,
  }
}
