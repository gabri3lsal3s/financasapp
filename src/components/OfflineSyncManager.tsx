import { useEffect } from 'react'
import { flushOfflineQueue } from '@/utils/offlineQueue'
import { flushAssistantOfflineQueue } from '@/utils/assistantOfflineQueue'

export default function OfflineSyncManager() {
  useEffect(() => {
    const runSync = () => {
      flushOfflineQueue()
      flushAssistantOfflineQueue()
    }

    runSync()
    window.addEventListener('online', runSync)

    return () => {
      window.removeEventListener('online', runSync)
    }
  }, [])

  return null
}
