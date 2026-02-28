import { useEffect } from 'react'
import { flushOfflineQueue } from '@/utils/offlineQueue'

export default function OfflineSyncManager() {
  useEffect(() => {
    const runSync = () => {
      flushOfflineQueue()
    }

    runSync()
    window.addEventListener('online', runSync)

    return () => {
      window.removeEventListener('online', runSync)
    }
  }, [])

  return null
}
