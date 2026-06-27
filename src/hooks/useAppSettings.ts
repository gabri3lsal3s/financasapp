import { useCallback, useEffect, useReducer } from 'react'

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

export type AppSettingsState = {
  floatingCalculatorEnabled: boolean
  dashboardReportsWeightsEnabled: boolean
  creditCardsWeightsEnabled: boolean
  categoriesWeightsEnabled: boolean
  biometricLockTimeout: BiometricLockTimeout
  remindersEnabled: boolean
  remindersDaysBeforeDebts: number
  remindersDaysBeforeCardBills: number
}

type AppSettingsAction = {
  key: keyof AppSettingsState
  value: AppSettingsState[keyof AppSettingsState]
}

function appSettingsReducer(state: AppSettingsState, action: AppSettingsAction): AppSettingsState {
  return { ...state, [action.key]: action.value }
}

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
  return 0
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

const readAllSettings = (): AppSettingsState => ({
  floatingCalculatorEnabled: readFloatingCalculatorEnabled(),
  dashboardReportsWeightsEnabled: readDashboardReportsWeightsEnabled(),
  creditCardsWeightsEnabled: readCreditCardsWeightsEnabled(),
  categoriesWeightsEnabled: readCategoriesWeightsEnabled(),
  biometricLockTimeout: readBiometricLockTimeout(),
  remindersEnabled: readRemindersEnabled(),
  remindersDaysBeforeDebts: readRemindersDaysDebts(),
  remindersDaysBeforeCardBills: readRemindersDaysCards(),
})

export function useAppSettings() {
  const [settings, dispatch] = useReducer(appSettingsReducer, null, readAllSettings)

  useEffect(() => {
    const syncFromStorage = () => {
      dispatch({ key: 'floatingCalculatorEnabled', value: readFloatingCalculatorEnabled() })
      dispatch({ key: 'dashboardReportsWeightsEnabled', value: readDashboardReportsWeightsEnabled() })
      dispatch({ key: 'creditCardsWeightsEnabled', value: readCreditCardsWeightsEnabled() })
      dispatch({ key: 'categoriesWeightsEnabled', value: readCategoriesWeightsEnabled() })
      dispatch({ key: 'biometricLockTimeout', value: readBiometricLockTimeout() })
      dispatch({ key: 'remindersEnabled', value: readRemindersEnabled() })
      dispatch({ key: 'remindersDaysBeforeDebts', value: readRemindersDaysDebts() })
      dispatch({ key: 'remindersDaysBeforeCardBills', value: readRemindersDaysCards() })
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

  const updateSetting = useCallback(<K extends keyof AppSettingsState>(
    key: K,
    value: AppSettingsState[K],
  ) => {
    switch (key) {
      case 'floatingCalculatorEnabled':
        if (!isStorageAvailable()) return
        window.localStorage.setItem(FLOATING_CALCULATOR_ENABLED_KEY, String(value))
        break
      case 'biometricLockTimeout':
        if (!isStorageAvailable()) return
        window.localStorage.setItem(BIOMETRIC_LOCK_TIMEOUT_KEY, String(value))
        break
      case 'remindersEnabled':
        if (!isStorageAvailable()) return
        window.localStorage.setItem(REMINDERS_ENABLED_KEY, String(value))
        break
      case 'remindersDaysBeforeDebts':
        if (!isStorageAvailable()) return
        window.localStorage.setItem(REMINDERS_DAYS_DEBTS_KEY, String(value))
        break
      case 'remindersDaysBeforeCardBills':
        if (!isStorageAvailable()) return
        window.localStorage.setItem(REMINDERS_DAYS_CARDS_KEY, String(value))
        break
      case 'dashboardReportsWeightsEnabled':
        dashboardReportsWeightsEnabledMemory = value as boolean
        break
      case 'creditCardsWeightsEnabled':
        creditCardsWeightsEnabledMemory = value as boolean
        break
      case 'categoriesWeightsEnabled':
        categoriesWeightsEnabledMemory = value as boolean
        break
    }

    dispatch({ key, value })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
    }
  }, [])

  return { settings, updateSetting }
}

export {
  FLOATING_CALCULATOR_ENABLED_KEY,
}
