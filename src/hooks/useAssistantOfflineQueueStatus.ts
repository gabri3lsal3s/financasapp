import { useEffect, useState } from 'react'
import {
  ASSISTANT_OFFLINE_QUEUE_EVENT,
  ASSISTANT_OFFLINE_QUEUE_UPDATED_EVENT,
  getAssistantOfflineQueueSize,
} from '@/utils/assistantOfflineQueue'

export function useAssistantOfflineQueueStatus() {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const updateCount = () => {
      setPendingCount(getAssistantOfflineQueueSize())
    }

    updateCount()

    if (typeof window === 'undefined') {
      return undefined
    }

    window.addEventListener(ASSISTANT_OFFLINE_QUEUE_EVENT, updateCount)
    window.addEventListener(ASSISTANT_OFFLINE_QUEUE_UPDATED_EVENT, updateCount)
    window.addEventListener('online', updateCount)

    return () => {
      window.removeEventListener(ASSISTANT_OFFLINE_QUEUE_EVENT, updateCount)
      window.removeEventListener(ASSISTANT_OFFLINE_QUEUE_UPDATED_EVENT, updateCount)
      window.removeEventListener('online', updateCount)
    }
  }, [])

  return {
    pendingCount,
    hasPending: pendingCount > 0,
  }
}
