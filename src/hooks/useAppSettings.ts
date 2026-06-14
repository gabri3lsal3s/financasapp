import { useCallback, useEffect, useState } from 'react'

const FLOATING_CALCULATOR_ENABLED_KEY = 'app.floatingCalculator.enabled'
const BIOMETRIC_LOCK_TIMEOUT_KEY = 'app.biometric.lockTimeoutMinutes'
const REMINDERS_ENABLED_KEY = 'app.reminders.enabled'
const REMINDERS_DAYS_DEBTS_KEY = 'app.reminders.daysDebts'
const REMINDERS_DAYS_CARDS_KEY = 'app.reminders.daysCards'
const APP_SETTINGS_UPDATED_EVENT = 'app-settings-updated'

let dashboardReportsWeightsEnabledMemory = false
let creditCardsWeightsEnabledMemory = false
let categoriesWeightsEnabledMemory = true

export type BiometricLockTimeout = 0 | 1 | 5 | 15

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

const readCategoriesWeightsEnabled = (): boolean => {
  return categoriesWeightsEnabledMemory
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

const parseRemindersEnabled = (value: string | null): boolean => {
  if (value === null) return true
  return value !== 'false'
}

const readRemindersEnabled = (): boolean => {
  if (!isStorageAvailable()) return true
  return parseRemindersEnabled(window.localStorage.getItem(REMINDERS_ENABLED_KEY))
}

const parseRemindersDaysDebts = (value: string | null): number => {
  if (value === null) return 3
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 3 : parsed
}

const readRemindersDaysDebts = (): number => {
  if (!isStorageAvailable()) return 3
  return parseRemindersDaysDebts(window.localStorage.getItem(REMINDERS_DAYS_DEBTS_KEY))
}

const parseRemindersDaysCards = (value: string | null): number => {
  if (value === null) return 3
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 3 : parsed
}

const readRemindersDaysCards = (): number => {
  if (!isStorageAvailable()) return 3
  return parseRemindersDaysCards(window.localStorage.getItem(REMINDERS_DAYS_CARDS_KEY))
}

export function useAppSettings() {
  const [floatingCalculatorEnabled, setFloatingCalculatorEnabledState] = useState<boolean>(readFloatingCalculatorEnabled)
  const [dashboardReportsWeightsEnabled, setDashboardReportsWeightsEnabledState] = useState<boolean>(readDashboardReportsWeightsEnabled)
  const [creditCardsWeightsEnabled, setCreditCardsWeightsEnabledState] = useState<boolean>(readCreditCardsWeightsEnabled)
  const [categoriesWeightsEnabled, setCategoriesWeightsEnabledState] = useState<boolean>(readCategoriesWeightsEnabled)
  const [biometricLockTimeout, setBiometricLockTimeoutState] = useState<BiometricLockTimeout>(readBiometricLockTimeout)
  const [remindersEnabled, setRemindersEnabledState] = useState<boolean>(readRemindersEnabled)
  const [remindersDaysBeforeDebts, setRemindersDaysBeforeDebtsState] = useState<number>(readRemindersDaysDebts)
  const [remindersDaysBeforeCardBills, setRemindersDaysBeforeCardBillsState] = useState<number>(readRemindersDaysCards)

  useEffect(() => {
    const syncFromStorage = () => {
      setFloatingCalculatorEnabledState(readFloatingCalculatorEnabled())
      setDashboardReportsWeightsEnabledState(readDashboardReportsWeightsEnabled())
      setCreditCardsWeightsEnabledState(readCreditCardsWeightsEnabled())
      setCategoriesWeightsEnabledState(readCategoriesWeightsEnabled())
      setBiometricLockTimeoutState(readBiometricLockTimeout())
      setRemindersEnabledState(readRemindersEnabled())
      setRemindersDaysBeforeDebtsState(readRemindersDaysDebts())
      setRemindersDaysBeforeCardBillsState(readRemindersDaysCards())
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === FLOATING_CALCULATOR_ENABLED_KEY
        || event.key === BIOMETRIC_LOCK_TIMEOUT_KEY
        || event.key === REMINDERS_ENABLED_KEY
        || event.key === REMINDERS_DAYS_DEBTS_KEY
        || event.key === REMINDERS_DAYS_CARDS_KEY
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

  const setCategoriesWeightsEnabled = useCallback((enabled: boolean) => {
    categoriesWeightsEnabledMemory = enabled
    setCategoriesWeightsEnabledState(enabled)
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

  const setRemindersEnabled = useCallback((enabled: boolean) => {
    if (!isStorageAvailable()) return

    window.localStorage.setItem(REMINDERS_ENABLED_KEY, String(enabled))
    setRemindersEnabledState(enabled)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setRemindersDaysBeforeDebts = useCallback((days: number) => {
    if (!isStorageAvailable()) return

    window.localStorage.setItem(REMINDERS_DAYS_DEBTS_KEY, String(days))
    setRemindersDaysBeforeDebtsState(days)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setRemindersDaysBeforeCardBills = useCallback((days: number) => {
    if (!isStorageAvailable()) return

    window.localStorage.setItem(REMINDERS_DAYS_CARDS_KEY, String(days))
    setRemindersDaysBeforeCardBillsState(days)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  return {
    floatingCalculatorEnabled,
    setFloatingCalculatorEnabled,
    dashboardReportsWeightsEnabled,
    setDashboardReportsWeightsEnabled,
    creditCardsWeightsEnabled,
    setCreditCardsWeightsEnabled,
    categoriesWeightsEnabled,
    setCategoriesWeightsEnabled,
    biometricLockTimeout,
    setBiometricLockTimeout,
    remindersEnabled,
    setRemindersEnabled,
    remindersDaysBeforeDebts,
    setRemindersDaysBeforeDebts,
    remindersDaysBeforeCardBills,
    setRemindersDaysBeforeCardBills,
  }
}

export {
  FLOATING_CALCULATOR_ENABLED_KEY,
}
