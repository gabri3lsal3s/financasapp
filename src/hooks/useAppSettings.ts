import { useCallback, useEffect, useState } from 'react'

const FLOATING_CALCULATOR_ENABLED_KEY = 'app.floatingCalculator.enabled'
const BIOMETRIC_LOCK_TIMEOUT_KEY = 'app.biometric.lockTimeoutMinutes'
const APP_SETTINGS_UPDATED_EVENT = 'app-settings-updated'

let dashboardReportsWeightsEnabledMemory = true
let creditCardsWeightsEnabledMemory = false

export type BiometricLockTimeout = 0 | 1 | 5 | 15

const parseFloatingCalculatorEnabled = (value: string | null): boolean => {
  if (value === null) return true
  return value !== 'false'
}

const readFloatingCalculatorEnabled = (): boolean => {
  if (typeof window === 'undefined') return true
  return parseFloatingCalculatorEnabled(window.localStorage.getItem(FLOATING_CALCULATOR_ENABLED_KEY))
}

const readDashboardReportsWeightsEnabled = (): boolean => {
  return dashboardReportsWeightsEnabledMemory
}

const readCreditCardsWeightsEnabled = (): boolean => {
  return creditCardsWeightsEnabledMemory
}

const parseBiometricLockTimeout = (value: string | null): BiometricLockTimeout => {
  const parsed = Number(value)
  if (parsed === 0 || parsed === 1 || parsed === 5 || parsed === 15) return parsed
  return 0 // default to Immediately
}

const readBiometricLockTimeout = (): BiometricLockTimeout => {
  if (typeof window === 'undefined') return 0
  return parseBiometricLockTimeout(window.localStorage.getItem(BIOMETRIC_LOCK_TIMEOUT_KEY))
}

export function useAppSettings() {
  const [floatingCalculatorEnabled, setFloatingCalculatorEnabledState] = useState<boolean>(readFloatingCalculatorEnabled)
  const [dashboardReportsWeightsEnabled, setDashboardReportsWeightsEnabledState] = useState<boolean>(readDashboardReportsWeightsEnabled)
  const [creditCardsWeightsEnabled, setCreditCardsWeightsEnabledState] = useState<boolean>(readCreditCardsWeightsEnabled)
  const [biometricLockTimeout, setBiometricLockTimeoutState] = useState<BiometricLockTimeout>(readBiometricLockTimeout)

  useEffect(() => {
    const syncFromStorage = () => {
      setFloatingCalculatorEnabledState(readFloatingCalculatorEnabled())
      setDashboardReportsWeightsEnabledState(readDashboardReportsWeightsEnabled())
      setCreditCardsWeightsEnabledState(readCreditCardsWeightsEnabled())
      setBiometricLockTimeoutState(readBiometricLockTimeout())
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === FLOATING_CALCULATOR_ENABLED_KEY
        || event.key === BIOMETRIC_LOCK_TIMEOUT_KEY
      ) {
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

  const setFloatingCalculatorEnabled = useCallback((enabled: boolean) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(FLOATING_CALCULATOR_ENABLED_KEY, String(enabled))
    setFloatingCalculatorEnabledState(enabled)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setDashboardReportsWeightsEnabled = useCallback((enabled: boolean) => {
    dashboardReportsWeightsEnabledMemory = enabled
    setDashboardReportsWeightsEnabledState(enabled)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
    }
  }, [])

  const setCreditCardsWeightsEnabled = useCallback((enabled: boolean) => {
    creditCardsWeightsEnabledMemory = enabled
    setCreditCardsWeightsEnabledState(enabled)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
    }
  }, [])

  const setBiometricLockTimeout = useCallback((timeout: BiometricLockTimeout) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(BIOMETRIC_LOCK_TIMEOUT_KEY, String(timeout))
    setBiometricLockTimeoutState(timeout)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  return {
    floatingCalculatorEnabled,
    setFloatingCalculatorEnabled,
    dashboardReportsWeightsEnabled,
    setDashboardReportsWeightsEnabled,
    creditCardsWeightsEnabled,
    setCreditCardsWeightsEnabled,
    biometricLockTimeout,
    setBiometricLockTimeout,
  }
}

export {
  FLOATING_CALCULATOR_ENABLED_KEY,
}
