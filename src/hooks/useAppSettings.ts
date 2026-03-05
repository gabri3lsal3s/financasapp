import { useCallback, useEffect, useState } from 'react'

const MONTHLY_INSIGHTS_ENABLED_KEY = 'app.monthlyInsights.enabled'
const ASSISTANT_CONFIRMATION_MODE_KEY = 'app.assistant.confirmationMode'
const ASSISTANT_DATA_RETENTION_DAYS_KEY = 'app.assistant.dataRetentionDays'
const ASSISTANT_LOCALE_KEY = 'app.assistant.locale'
const ASSISTANT_OFFLINE_BEHAVIOR_KEY = 'app.assistant.offlineBehavior'
const ASSISTANT_RESPONSE_DEPTH_KEY = 'app.assistant.responseDepth'
const ASSISTANT_AUTO_SPEAK_KEY = 'app.assistant.autoSpeak'
const ASSISTANT_SPEECH_RATE_KEY = 'app.assistant.speechRate'
const ASSISTANT_SPEECH_PITCH_KEY = 'app.assistant.speechPitch'
const FLOATING_CALCULATOR_ENABLED_KEY = 'app.floatingCalculator.enabled'
const APP_SETTINGS_UPDATED_EVENT = 'app-settings-updated'

let dashboardReportsWeightsEnabledMemory = true
let creditCardsWeightsEnabledMemory = false

export type AssistantConfirmationMode = 'both' | 'touch' | 'voice'
export type AssistantConfirmationPolicyMode = 'write_only' | 'always' | 'never'
export type AssistantDataRetentionDays = 7 | 30 | 90 | 180 | 365
export type AssistantLocale = 'pt-BR'
export type AssistantOfflineBehavior = 'write_fallback' | 'strict_online'
export type AssistantResponseDepth = 'concise' | 'consultive'
export type AssistantSpeechRate = 'slow' | 'normal' | 'fast'
export type AssistantSpeechPitch = 'low' | 'normal' | 'high'

const parseInsightsEnabled = (value: string | null) => {
  if (value === null) return true
  return value !== 'false'
}

const readMonthlyInsightsEnabled = () => {
  if (typeof window === 'undefined') return true
  return parseInsightsEnabled(window.localStorage.getItem(MONTHLY_INSIGHTS_ENABLED_KEY))
}

const parseAssistantConfirmationMode = (value: string | null): AssistantConfirmationMode => {
  if (value === 'touch' || value === 'voice' || value === 'both') return value
  return 'both'
}

const ASSISTANT_CONFIRMATION_POLICY_MODE_KEY = 'app.assistant.confirmationPolicyMode'

const parseAssistantConfirmationPolicyMode = (value: string | null): AssistantConfirmationPolicyMode => {
  if (value === 'always' || value === 'never' || value === 'write_only') return value
  return 'write_only'
}

const readAssistantConfirmationMode = (): AssistantConfirmationMode => {
  if (typeof window === 'undefined') return 'both'
  return parseAssistantConfirmationMode(window.localStorage.getItem(ASSISTANT_CONFIRMATION_MODE_KEY))
}

const readAssistantConfirmationPolicyMode = (): AssistantConfirmationPolicyMode => {
  if (typeof window === 'undefined') return 'write_only'
  return parseAssistantConfirmationPolicyMode(window.localStorage.getItem(ASSISTANT_CONFIRMATION_POLICY_MODE_KEY))
}

const parseAssistantDataRetentionDays = (value: string | null): AssistantDataRetentionDays => {
  const parsed = Number(value)
  if (parsed === 7 || parsed === 30 || parsed === 90 || parsed === 180 || parsed === 365) return parsed
  return 90
}

const readAssistantDataRetentionDays = (): AssistantDataRetentionDays => {
  if (typeof window === 'undefined') return 90
  return parseAssistantDataRetentionDays(window.localStorage.getItem(ASSISTANT_DATA_RETENTION_DAYS_KEY))
}

const parseAssistantLocale = (value: string | null): AssistantLocale => {
  if (value === 'pt-BR') return value
  return 'pt-BR'
}

const readAssistantLocale = (): AssistantLocale => {
  if (typeof window === 'undefined') return 'pt-BR'
  return parseAssistantLocale(window.localStorage.getItem(ASSISTANT_LOCALE_KEY))
}

const parseAssistantOfflineBehavior = (value: string | null): AssistantOfflineBehavior => {
  if (value === 'write_fallback' || value === 'strict_online') return value
  return 'write_fallback'
}

const readAssistantOfflineBehavior = (): AssistantOfflineBehavior => {
  if (typeof window === 'undefined') return 'write_fallback'
  return parseAssistantOfflineBehavior(window.localStorage.getItem(ASSISTANT_OFFLINE_BEHAVIOR_KEY))
}

const parseAssistantResponseDepth = (value: string | null): AssistantResponseDepth => {
  if (value === 'concise' || value === 'consultive') return value
  return 'consultive'
}

const readAssistantResponseDepth = (): AssistantResponseDepth => {
  if (typeof window === 'undefined') return 'consultive'
  return parseAssistantResponseDepth(window.localStorage.getItem(ASSISTANT_RESPONSE_DEPTH_KEY))
}

const parseAssistantAutoSpeak = (value: string | null): boolean => {
  if (value === null) return true
  return value !== 'false'
}

const readAssistantAutoSpeak = (): boolean => {
  if (typeof window === 'undefined') return true
  return parseAssistantAutoSpeak(window.localStorage.getItem(ASSISTANT_AUTO_SPEAK_KEY))
}

const parseAssistantSpeechRate = (value: string | null): AssistantSpeechRate => {
  if (value === 'slow' || value === 'normal' || value === 'fast') return value
  return 'normal'
}

const readAssistantSpeechRate = (): AssistantSpeechRate => {
  if (typeof window === 'undefined') return 'normal'
  return parseAssistantSpeechRate(window.localStorage.getItem(ASSISTANT_SPEECH_RATE_KEY))
}

const parseAssistantSpeechPitch = (value: string | null): AssistantSpeechPitch => {
  if (value === 'low' || value === 'normal' || value === 'high') return value
  return 'normal'
}

const readAssistantSpeechPitch = (): AssistantSpeechPitch => {
  if (typeof window === 'undefined') return 'normal'
  return parseAssistantSpeechPitch(window.localStorage.getItem(ASSISTANT_SPEECH_PITCH_KEY))
}

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

export function useAppSettings() {
  const [monthlyInsightsEnabled, setMonthlyInsightsEnabledState] = useState<boolean>(readMonthlyInsightsEnabled)
  const [assistantConfirmationMode, setAssistantConfirmationModeState] = useState<AssistantConfirmationMode>(readAssistantConfirmationMode)
  const [assistantConfirmationPolicyMode, setAssistantConfirmationPolicyModeState] = useState<AssistantConfirmationPolicyMode>(readAssistantConfirmationPolicyMode)
  const [assistantDataRetentionDays, setAssistantDataRetentionDaysState] = useState<AssistantDataRetentionDays>(readAssistantDataRetentionDays)
  const [assistantLocale, setAssistantLocaleState] = useState<AssistantLocale>(readAssistantLocale)
  const [assistantOfflineBehavior, setAssistantOfflineBehaviorState] = useState<AssistantOfflineBehavior>(readAssistantOfflineBehavior)
  const [assistantResponseDepth, setAssistantResponseDepthState] = useState<AssistantResponseDepth>(readAssistantResponseDepth)
  const [assistantAutoSpeak, setAssistantAutoSpeakState] = useState<boolean>(readAssistantAutoSpeak)
  const [assistantSpeechRate, setAssistantSpeechRateState] = useState<AssistantSpeechRate>(readAssistantSpeechRate)
  const [assistantSpeechPitch, setAssistantSpeechPitchState] = useState<AssistantSpeechPitch>(readAssistantSpeechPitch)
  const [floatingCalculatorEnabled, setFloatingCalculatorEnabledState] = useState<boolean>(readFloatingCalculatorEnabled)
  const [dashboardReportsWeightsEnabled, setDashboardReportsWeightsEnabledState] = useState<boolean>(readDashboardReportsWeightsEnabled)
  const [creditCardsWeightsEnabled, setCreditCardsWeightsEnabledState] = useState<boolean>(readCreditCardsWeightsEnabled)

  useEffect(() => {
    const syncFromStorage = () => {
      setMonthlyInsightsEnabledState(readMonthlyInsightsEnabled())
      setAssistantConfirmationModeState(readAssistantConfirmationMode())
      setAssistantConfirmationPolicyModeState(readAssistantConfirmationPolicyMode())
      setAssistantDataRetentionDaysState(readAssistantDataRetentionDays())
      setAssistantLocaleState(readAssistantLocale())
      setAssistantOfflineBehaviorState(readAssistantOfflineBehavior())
      setAssistantResponseDepthState(readAssistantResponseDepth())
      setAssistantAutoSpeakState(readAssistantAutoSpeak())
      setAssistantSpeechRateState(readAssistantSpeechRate())
      setAssistantSpeechPitchState(readAssistantSpeechPitch())
      setFloatingCalculatorEnabledState(readFloatingCalculatorEnabled())
      setDashboardReportsWeightsEnabledState(readDashboardReportsWeightsEnabled())
      setCreditCardsWeightsEnabledState(readCreditCardsWeightsEnabled())
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === MONTHLY_INSIGHTS_ENABLED_KEY
        || event.key === ASSISTANT_CONFIRMATION_MODE_KEY
        || event.key === ASSISTANT_CONFIRMATION_POLICY_MODE_KEY
        || event.key === ASSISTANT_DATA_RETENTION_DAYS_KEY
        || event.key === ASSISTANT_LOCALE_KEY
        || event.key === ASSISTANT_OFFLINE_BEHAVIOR_KEY
        || event.key === ASSISTANT_RESPONSE_DEPTH_KEY
        || event.key === ASSISTANT_AUTO_SPEAK_KEY
        || event.key === ASSISTANT_SPEECH_RATE_KEY
        || event.key === ASSISTANT_SPEECH_PITCH_KEY
        || event.key === FLOATING_CALCULATOR_ENABLED_KEY
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

  const setMonthlyInsightsEnabled = useCallback((enabled: boolean) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(MONTHLY_INSIGHTS_ENABLED_KEY, String(enabled))
    setMonthlyInsightsEnabledState(enabled)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantConfirmationMode = useCallback((mode: AssistantConfirmationMode) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_CONFIRMATION_MODE_KEY, mode)
    setAssistantConfirmationModeState(mode)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantConfirmationPolicyMode = useCallback((mode: AssistantConfirmationPolicyMode) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_CONFIRMATION_POLICY_MODE_KEY, mode)
    setAssistantConfirmationPolicyModeState(mode)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantDataRetentionDays = useCallback((days: AssistantDataRetentionDays) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_DATA_RETENTION_DAYS_KEY, String(days))
    setAssistantDataRetentionDaysState(days)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantLocale = useCallback((locale: AssistantLocale) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_LOCALE_KEY, locale)
    setAssistantLocaleState(locale)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantOfflineBehavior = useCallback((behavior: AssistantOfflineBehavior) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_OFFLINE_BEHAVIOR_KEY, behavior)
    setAssistantOfflineBehaviorState(behavior)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantResponseDepth = useCallback((depth: AssistantResponseDepth) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_RESPONSE_DEPTH_KEY, depth)
    setAssistantResponseDepthState(depth)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantAutoSpeak = useCallback((enabled: boolean) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_AUTO_SPEAK_KEY, String(enabled))
    setAssistantAutoSpeakState(enabled)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantSpeechRate = useCallback((rate: AssistantSpeechRate) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_SPEECH_RATE_KEY, rate)
    setAssistantSpeechRateState(rate)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
  }, [])

  const setAssistantSpeechPitch = useCallback((pitch: AssistantSpeechPitch) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(ASSISTANT_SPEECH_PITCH_KEY, pitch)
    setAssistantSpeechPitchState(pitch)
    window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT))
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

  return {
    monthlyInsightsEnabled,
    setMonthlyInsightsEnabled,
    assistantConfirmationMode,
    setAssistantConfirmationMode,
    assistantConfirmationPolicyMode,
    setAssistantConfirmationPolicyMode,
    assistantDataRetentionDays,
    setAssistantDataRetentionDays,
    assistantLocale,
    setAssistantLocale,
    assistantOfflineBehavior,
    setAssistantOfflineBehavior,
    assistantResponseDepth,
    setAssistantResponseDepth,
    assistantAutoSpeak,
    setAssistantAutoSpeak,
    assistantSpeechRate,
    setAssistantSpeechRate,
    assistantSpeechPitch,
    setAssistantSpeechPitch,
    floatingCalculatorEnabled,
    setFloatingCalculatorEnabled,
    dashboardReportsWeightsEnabled,
    setDashboardReportsWeightsEnabled,
    creditCardsWeightsEnabled,
    setCreditCardsWeightsEnabled,
  }
}

export {
  ASSISTANT_CONFIRMATION_MODE_KEY,
  ASSISTANT_CONFIRMATION_POLICY_MODE_KEY,
  ASSISTANT_DATA_RETENTION_DAYS_KEY,
  ASSISTANT_LOCALE_KEY,
  ASSISTANT_OFFLINE_BEHAVIOR_KEY,
  ASSISTANT_RESPONSE_DEPTH_KEY,
  ASSISTANT_AUTO_SPEAK_KEY,
  ASSISTANT_SPEECH_RATE_KEY,
  ASSISTANT_SPEECH_PITCH_KEY,
  FLOATING_CALCULATOR_ENABLED_KEY,
  MONTHLY_INSIGHTS_ENABLED_KEY,
}
