import type { AssistantIntent, AssistantSlots } from '@/types'
import { findAssistantMemoryMatch } from '@/utils/assistantMemory'

type SessionPreference = {
  categoryId: string
  categoryName: string
  confidence: number
  updatedAt: string
}

type SessionPreferenceState = {
  expense?: SessionPreference
  income?: SessionPreference
}

type DecisionSource = 'command' | 'session' | 'memory' | 'none'

export interface AssistantContextDecisionLogItem {
  id: string
  deviceId: string
  intent: AssistantIntent
  source: DecisionSource
  reason: string
  hadCommandCategory: boolean
  hadSessionPreference: boolean
  hadMemoryMatch: boolean
  createdAt: string
}

const SESSION_PREFERENCES_PREFIX = 'assistant-session-preferences'
const CONTEXT_DECISIONS_STORAGE_KEY = 'assistant-context-decision-logs'
const CONTEXT_DECISIONS_LIMIT = 100
export const ASSISTANT_SESSION_PREFERENCES_PREFIX = SESSION_PREFERENCES_PREFIX
export const ASSISTANT_CONTEXT_DECISIONS_STORAGE_KEY = CONTEXT_DECISIONS_STORAGE_KEY
export const ASSISTANT_CONTEXT_DECISIONS_UPDATED_EVENT = 'assistant-context-decisions-updated'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getSessionPreferencesKey = (deviceId: string) => `${SESSION_PREFERENCES_PREFIX}:${deviceId}`

const intentToPreferenceKey = (intent: AssistantIntent): 'expense' | 'income' | null => {
  if (intent === 'add_expense') return 'expense'
  if (intent === 'add_income') return 'income'
  return null
}

const readSessionPreferences = (deviceId: string): SessionPreferenceState => {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(getSessionPreferencesKey(deviceId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

const writeSessionPreferences = (deviceId: string, state: SessionPreferenceState) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(getSessionPreferencesKey(deviceId), JSON.stringify(state))
}

const readDecisionLogs = (): AssistantContextDecisionLogItem[] => {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(CONTEXT_DECISIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeDecisionLogs = (logs: AssistantContextDecisionLogItem[]) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CONTEXT_DECISIONS_STORAGE_KEY, JSON.stringify(logs.slice(0, CONTEXT_DECISIONS_LIMIT)))

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ASSISTANT_CONTEXT_DECISIONS_UPDATED_EVENT))
  }
}

export const getAssistantContextDecisionLogs = () => readDecisionLogs()

export const rememberAssistantSessionPreference = (
  deviceId: string,
  intent: AssistantIntent,
  slots: AssistantSlots,
) => {
  const preferenceKey = intentToPreferenceKey(intent)
  if (!preferenceKey) return

  const categoryId = slots.category?.id
  const categoryName = slots.category?.name
  if (!categoryId || !categoryName) return

  const current = readSessionPreferences(deviceId)
  current[preferenceKey] = {
    categoryId,
    categoryName,
    confidence: Math.max(0.8, Math.min(0.98, slots.category?.confidence ?? 0.9)),
    updatedAt: new Date().toISOString(),
  }

  writeSessionPreferences(deviceId, current)
}

const createDecisionLog = (item: Omit<AssistantContextDecisionLogItem, 'id' | 'createdAt'>) => {
  const logs = readDecisionLogs()
  const next: AssistantContextDecisionLogItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  }

  writeDecisionLogs([next, ...logs])
}

export const resolveAssistantContextWithPriority = (
  deviceId: string,
  intent: AssistantIntent,
  slots: AssistantSlots,
) => {
  const hasCommandCategory = Boolean(slots.category?.id)
  const preferenceKey = intentToPreferenceKey(intent)
  const sessionPreferences = preferenceKey ? readSessionPreferences(deviceId) : {}
  const sessionPreference = preferenceKey ? sessionPreferences[preferenceKey] : undefined
  const memoryMatch = findAssistantMemoryMatch(intent, slots)

  if (hasCommandCategory) {
    createDecisionLog({
      deviceId,
      intent,
      source: 'command',
      reason: 'Categoria já veio no comando atual.',
      hadCommandCategory: true,
      hadSessionPreference: Boolean(sessionPreference),
      hadMemoryMatch: Boolean(memoryMatch),
    })

    return {
      slots,
      source: 'command' as const,
    }
  }

  if (sessionPreference) {
    const resolvedSlots: AssistantSlots = {
      ...slots,
      category: {
        id: sessionPreference.categoryId,
        name: sessionPreference.categoryName,
        confidence: sessionPreference.confidence,
        source: 'session',
      },
    }

    createDecisionLog({
      deviceId,
      intent,
      source: 'session',
      reason: 'Categoria aplicada da preferência de sessão.',
      hadCommandCategory: false,
      hadSessionPreference: true,
      hadMemoryMatch: Boolean(memoryMatch),
    })

    return {
      slots: resolvedSlots,
      source: 'session' as const,
    }
  }

  if (memoryMatch) {
    const resolvedSlots: AssistantSlots = {
      ...slots,
      category: {
        id: memoryMatch.categoryId,
        name: memoryMatch.categoryName,
        confidence: memoryMatch.confidence,
        source: 'memory',
      },
    }

    createDecisionLog({
      deviceId,
      intent,
      source: 'memory',
      reason: 'Categoria aplicada da memória longa.',
      hadCommandCategory: false,
      hadSessionPreference: false,
      hadMemoryMatch: true,
    })

    return {
      slots: resolvedSlots,
      source: 'memory' as const,
    }
  }

  createDecisionLog({
    deviceId,
    intent,
    source: 'none',
    reason: 'Sem categoria em comando/sessão/memória.',
    hadCommandCategory: false,
    hadSessionPreference: false,
    hadMemoryMatch: false,
  })

  return {
    slots,
    source: 'none' as const,
  }
}

export const clearAssistantContextDecisionLogs = () => {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(CONTEXT_DECISIONS_STORAGE_KEY)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ASSISTANT_CONTEXT_DECISIONS_UPDATED_EVENT))
  }
}

export const clearAssistantSessionPreferences = (deviceId: string) => {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(getSessionPreferencesKey(deviceId))
}

export const getAssistantSessionPreferences = (deviceId: string) => readSessionPreferences(deviceId)

export const hasAssistantMemoryKeyword = (description: string | undefined, keyword: string) => {
  if (!description || !keyword) return false
  return normalize(description).includes(normalize(keyword))
}
