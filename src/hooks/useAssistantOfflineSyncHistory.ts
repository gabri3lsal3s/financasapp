import { useEffect, useMemo, useState } from 'react'
import {
  ASSISTANT_OFFLINE_SYNC_EVENT,
  clearAssistantOfflineSyncHistory,
  getAssistantOfflineSyncHistory,
} from '@/utils/assistantOfflineQueue'

export function useAssistantOfflineSyncHistory() {
  const [history, setHistory] = useState(() => getAssistantOfflineSyncHistory())

  useEffect(() => {
    const update = () => {
      setHistory(getAssistantOfflineSyncHistory())
    }

    if (typeof window === 'undefined') {
      return undefined
    }

    window.addEventListener(ASSISTANT_OFFLINE_SYNC_EVENT, update)
    window.addEventListener('online', update)

    return () => {
      window.removeEventListener(ASSISTANT_OFFLINE_SYNC_EVENT, update)
      window.removeEventListener('online', update)
    }
  }, [])

  const lastSync = useMemo(() => history[0] || null, [history])

  return {
    history,
    lastSync,
    clearHistory: clearAssistantOfflineSyncHistory,
  }
}
