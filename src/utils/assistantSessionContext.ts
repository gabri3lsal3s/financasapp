import type { AssistantConfirmationMode } from '@/services/assistant-core/confirmationPolicy'
import type { AssistantInterpretResult } from '@/types'

type AssistantSessionContextPayload = {
  interpretation: AssistantInterpretResult
  expiresAt: string
  createdAt: string
  offlinePending?: {
    text: string
    confirmationMode?: AssistantConfirmationMode
    forceConfirmation?: boolean
  }
}

const ASSISTANT_PENDING_CONTEXT_PREFIX = 'assistant-pending-context'
const DEFAULT_CONFIRMATION_WINDOW_MS = 5 * 60 * 1000

const getContextKey = (deviceId: string) => `${ASSISTANT_PENDING_CONTEXT_PREFIX}:${deviceId}`

const hasExpired = (expiresAt: string) => {
  const timestamp = Date.parse(expiresAt)
  if (Number.isNaN(timestamp)) return true
  return timestamp <= Date.now()
}

const parsePayload = (raw: string | null): AssistantSessionContextPayload | null => {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as AssistantSessionContextPayload

    if (!parsed?.interpretation?.command?.id || !parsed.expiresAt || !parsed.createdAt) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export const saveAssistantPendingContext = (
  deviceId: string,
  interpretation: AssistantInterpretResult,
  options?: {
    confirmationWindowMs?: number
    offlinePending?: {
      text: string
      confirmationMode?: AssistantConfirmationMode
      forceConfirmation?: boolean
    }
  },
) => {
  if (typeof localStorage === 'undefined') return null

  const confirmationWindowMs = options?.confirmationWindowMs ?? DEFAULT_CONFIRMATION_WINDOW_MS
  const payload: AssistantSessionContextPayload = {
    interpretation,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + confirmationWindowMs).toISOString(),
    offlinePending: options?.offlinePending,
  }

  localStorage.setItem(getContextKey(deviceId), JSON.stringify(payload))
  return payload
}

export const getAssistantPendingContext = (deviceId: string): AssistantSessionContextPayload | null => {
  if (typeof localStorage === 'undefined') return null

  const key = getContextKey(deviceId)
  const payload = parsePayload(localStorage.getItem(key))

  if (!payload) {
    localStorage.removeItem(key)
    return null
  }

  if (hasExpired(payload.expiresAt)) {
    localStorage.removeItem(key)
    return null
  }

  return payload
}

export const clearAssistantPendingContext = (deviceId: string) => {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(getContextKey(deviceId))
}

export const getAssistantConfirmationWindowMs = () => DEFAULT_CONFIRMATION_WINDOW_MS
