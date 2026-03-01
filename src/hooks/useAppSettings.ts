import { useCallback, useEffect, useState } from 'react'

const MONTHLY_INSIGHTS_ENABLED_KEY = 'app.monthlyInsights.enabled'
const APP_SETTINGS_UPDATED_EVENT = 'app-settings-updated'

const parseInsightsEnabled = (value: string | null) => {
  if (value === null) return true
  return value !== 'false'
}

const readMonthlyInsightsEnabled = () => {
  if (typeof window === 'undefined') return true
  return parseInsightsEnabled(window.localStorage.getItem(MONTHLY_INSIGHTS_ENABLED_KEY))
}

export function useAppSettings() {
  const [monthlyInsightsEnabled, setMonthlyInsightsEnabledState] = useState<boolean>(readMonthlyInsightsEnabled)

  useEffect(() => {
    const syncFromStorage = () => {
      setMonthlyInsightsEnabledState(readMonthlyInsightsEnabled())
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === MONTHLY_INSIGHTS_ENABLED_KEY) {
        syncFromStorage()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, syncFromStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, syncFromStorage)
    }
  }, [])

  const setMonthlyInsightsEnabled = useCallback((enabled: boolean) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(MONTHLY_INSIGHTS_ENABLED_KEY, String(enabled))
    setMonthlyInsightsEnabledState(enabled)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  return {
    monthlyInsightsEnabled,
    setMonthlyInsightsEnabled,
  }
}

export { MONTHLY_INSIGHTS_ENABLED_KEY }
