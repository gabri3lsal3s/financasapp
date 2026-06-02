import { useCallback, useEffect, useState } from 'react'

const FLOATING_CALCULATOR_ENABLED_KEY = 'app.floatingCalculator.enabled'
const BIOMETRIC_LOCK_TIMEOUT_KEY = 'app.biometric.lockTimeoutMinutes'
const DESKTOP_POSITION_KEY = 'app.floatingButtons.desktopPosition'
const MOBILE_POSITION_KEY = 'app.floatingButtons.mobilePosition'
const APP_SETTINGS_UPDATED_EVENT = 'app-settings-updated'

let dashboardReportsWeightsEnabledMemory = true
let creditCardsWeightsEnabledMemory = false

export type BiometricLockTimeout = 0 | 1 | 5 | 15
export type DesktopPosition = 'right' | 'top'
export type MobilePosition = 'right' | 'left'

const isStorageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' &&
      window.localStorage !== null &&
      typeof window.localStorage === 'object' &&
      typeof window.localStorage.getItem === 'function' &&
      typeof window.localStorage.setItem === 'function' &&
      typeof window.localStorage.removeItem === 'function'
  } catch {
    return false
  }
}

const parseFloatingCalculatorEnabled = (value: string | null): boolean => {
  if (value === null) return true
  return value !== 'false'
}

const readFloatingCalculatorEnabled = (): boolean => {
  if (!isStorageAvailable()) return true
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
  if (!isStorageAvailable()) return 0
  return parseBiometricLockTimeout(window.localStorage.getItem(BIOMETRIC_LOCK_TIMEOUT_KEY))
}

const readDesktopPosition = (): DesktopPosition => {
  if (!isStorageAvailable()) return 'right'
  const val = window.localStorage.getItem(DESKTOP_POSITION_KEY)
  return val === 'top' ? 'top' : 'right'
}

const readMobilePosition = (): MobilePosition => {
  if (!isStorageAvailable()) return 'right'
  const val = window.localStorage.getItem(MOBILE_POSITION_KEY)
  return val === 'left' ? 'left' : 'right'
}

export function useAppSettings() {
  const [floatingCalculatorEnabled, setFloatingCalculatorEnabledState] = useState<boolean>(readFloatingCalculatorEnabled)
  const [dashboardReportsWeightsEnabled, setDashboardReportsWeightsEnabledState] = useState<boolean>(readDashboardReportsWeightsEnabled)
  const [creditCardsWeightsEnabled, setCreditCardsWeightsEnabledState] = useState<boolean>(readCreditCardsWeightsEnabled)
  const [biometricLockTimeout, setBiometricLockTimeoutState] = useState<BiometricLockTimeout>(readBiometricLockTimeout)
  const [floatingButtonsDesktopPosition, setFloatingButtonsDesktopPositionState] = useState<DesktopPosition>(readDesktopPosition)
  const [floatingButtonsMobilePosition, setFloatingButtonsMobilePositionState] = useState<MobilePosition>(readMobilePosition)

  useEffect(() => {
    const syncFromStorage = () => {
      setFloatingCalculatorEnabledState(readFloatingCalculatorEnabled())
      setDashboardReportsWeightsEnabledState(readDashboardReportsWeightsEnabled())
      setCreditCardsWeightsEnabledState(readCreditCardsWeightsEnabled())
      setBiometricLockTimeoutState(readBiometricLockTimeout())
      setFloatingButtonsDesktopPositionState(readDesktopPosition())
      setFloatingButtonsMobilePositionState(readMobilePosition())
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === FLOATING_CALCULATOR_ENABLED_KEY
        || event.key === BIOMETRIC_LOCK_TIMEOUT_KEY
        || event.key === DESKTOP_POSITION_KEY
        || event.key === MOBILE_POSITION_KEY
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
    if (!isStorageAvailable()) return

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
    if (!isStorageAvailable()) return

    window.localStorage.setItem(BIOMETRIC_LOCK_TIMEOUT_KEY, String(timeout))
    setBiometricLockTimeoutState(timeout)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setFloatingButtonsDesktopPosition = useCallback((pos: DesktopPosition) => {
    if (!isStorageAvailable()) return

    window.localStorage.setItem(DESKTOP_POSITION_KEY, pos)
    setFloatingButtonsDesktopPositionState(pos)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setFloatingButtonsMobilePosition = useCallback((pos: MobilePosition) => {
    if (!isStorageAvailable()) return

    window.localStorage.setItem(MOBILE_POSITION_KEY, pos)
    setFloatingButtonsMobilePositionState(pos)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const resetAllSettings = useCallback(() => {
    if (!isStorageAvailable()) return

    window.localStorage.removeItem(FLOATING_CALCULATOR_ENABLED_KEY)
    window.localStorage.removeItem(DESKTOP_POSITION_KEY)
    window.localStorage.removeItem(MOBILE_POSITION_KEY)
    window.localStorage.removeItem('floating-calculator-custom-top')
    window.localStorage.removeItem('floating-calculator-state')
    window.localStorage.removeItem('floating-calculator-ui')

    window.dispatchEvent(new Event('app-settings-reset'))

    setFloatingCalculatorEnabledState(true)
    setFloatingButtonsDesktopPositionState('right')
    setFloatingButtonsMobilePositionState('right')
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
    floatingButtonsDesktopPosition,
    setFloatingButtonsDesktopPosition,
    floatingButtonsMobilePosition,
    setFloatingButtonsMobilePosition,
    resetAllSettings,
  }
}

export {
  FLOATING_CALCULATOR_ENABLED_KEY,
}
