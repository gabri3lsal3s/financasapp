import { useEffect } from 'react'
import { flushOfflineQueue } from '@/utils/offlineQueue'
import { flushAssistantOfflineQueue } from '@/utils/assistantOfflineQueue'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export default function OfflineSyncManager() {
  const { isOnline } = useNetworkStatus()

  useEffect(() => {
    if (!isOnline) return

    const runSync = () => {
      flushOfflineQueue()
      flushAssistantOfflineQueue()
    }

    runSync()
    window.addEventListener('online', runSync)

    return () => {
      window.removeEventListener('online', runSync)
    }
  }, [isOnline])

  return null
}
