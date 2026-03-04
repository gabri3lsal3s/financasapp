import { ASSISTANT_DATA_RETENTION_DAYS_KEY } from '@/hooks/useAppSettings'
import { ASSISTANT_CONTEXT_DECISIONS_STORAGE_KEY, ASSISTANT_SESSION_PREFERENCES_PREFIX } from '@/utils/assistantContextResolver'
import { ASSISTANT_MEMORY_STORAGE_KEY } from '@/utils/assistantMemory'
import { ASSISTANT_OFFLINE_QUEUE_STORAGE_KEY, ASSISTANT_OFFLINE_SYNC_HISTORY_STORAGE_KEY } from '@/utils/assistantOfflineQueue'
import { ASSISTANT_TELEMETRY_KEY } from '@/utils/assistantTelemetry'

type RetentionCleanupStats = {
  telemetryRemoved: number
  memoryRemoved: number
  contextLogsRemoved: number
  offlineHistoryRemoved: number
  sessionPreferencesRemoved: number
  queueVoiceMetadataRedacted: number
}

const PRIVACY_LAST_CLEANUP_KEY = 'assistant-privacy-last-cleanup'

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const parseArray = <T = unknown>(raw: string | null): T[] => {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const toTimestamp = (value: unknown) => {
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? timestamp : NaN
}

const applyArrayRetention = (
  key: string,
  cutoffTimestamp: number,
  timestampField: string,
): number => {
  const current = parseArray<Record<string, unknown>>(localStorage.getItem(key))
  if (!current.length) return 0

  const filtered = current.filter((item) => {
    const timestamp = toTimestamp(item[timestampField])
    if (!Number.isFinite(timestamp)) return true
    return timestamp >= cutoffTimestamp
  })

  const removed = current.length - filtered.length
  if (removed > 0) {
    localStorage.setItem(key, JSON.stringify(filtered))
  }

  return removed
}

const cleanupSessionPreferences = (cutoffTimestamp: number): number => {
  let removed = 0

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || !key.startsWith(ASSISTANT_SESSION_PREFERENCES_PREFIX)) continue

    const raw = localStorage.getItem(key)
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw) as Record<string, { updatedAt?: string }>
      const next = { ...parsed }

      ;(['expense', 'income'] as const).forEach((field) => {
        const updatedAt = parsed[field]?.updatedAt
        const timestamp = toTimestamp(updatedAt)

        if (Number.isFinite(timestamp) && timestamp < cutoffTimestamp) {
          delete next[field]
          removed += 1
        }
      })

      if (!next.expense && !next.income) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, JSON.stringify(next))
      }
    } catch {
      localStorage.removeItem(key)
      removed += 1
    }
  }

  return removed
}

const redactQueueVoiceMetadata = (): number => {
  const queue = parseArray<Record<string, unknown>>(localStorage.getItem(ASSISTANT_OFFLINE_QUEUE_STORAGE_KEY))
  if (!queue.length) return 0

  let redacted = 0

  const sanitized = queue.map((item) => {
    const hasPlain = typeof item.spokenText === 'string' && item.spokenText.trim().length > 0
    const hasProtected = typeof item.spokenTextEncrypted === 'string' && item.spokenTextEncrypted.trim().length > 0

    if (hasPlain || hasProtected) {
      redacted += 1
      const next = { ...item }
      delete next.spokenText
      delete next.spokenTextEncrypted
      return next
    }

    return item
  })

  if (redacted > 0) {
    localStorage.setItem(ASSISTANT_OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(sanitized))
  }

  return redacted
}

export const runAssistantPrivacyCleanup = (retentionDays: number): RetentionCleanupStats | null => {
  if (!canUseStorage()) return null

  const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 90
  const cutoffTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000)

  const telemetryRemoved = applyArrayRetention(ASSISTANT_TELEMETRY_KEY, cutoffTimestamp, 'timestamp')
  const memoryRemoved = applyArrayRetention(ASSISTANT_MEMORY_STORAGE_KEY, cutoffTimestamp, 'updatedAt')
  const contextLogsRemoved = applyArrayRetention(ASSISTANT_CONTEXT_DECISIONS_STORAGE_KEY, cutoffTimestamp, 'createdAt')
  const offlineHistoryRemoved = applyArrayRetention(ASSISTANT_OFFLINE_SYNC_HISTORY_STORAGE_KEY, cutoffTimestamp, 'createdAt')
  const sessionPreferencesRemoved = cleanupSessionPreferences(cutoffTimestamp)
  const queueVoiceMetadataRedacted = redactQueueVoiceMetadata()

  const summary: RetentionCleanupStats = {
    telemetryRemoved,
    memoryRemoved,
    contextLogsRemoved,
    offlineHistoryRemoved,
    sessionPreferencesRemoved,
    queueVoiceMetadataRedacted,
  }

  localStorage.setItem(PRIVACY_LAST_CLEANUP_KEY, JSON.stringify({
    timestamp: new Date().toISOString(),
    retentionDays: days,
    summary,
  }))

  return summary
}

export const getAssistantPrivacyCleanupLastRun = () => {
  if (!canUseStorage()) return null

  try {
    const raw = localStorage.getItem(PRIVACY_LAST_CLEANUP_KEY)
    if (!raw) return null
    return JSON.parse(raw) as {
      timestamp: string
      retentionDays: number
      summary: RetentionCleanupStats
    }
  } catch {
    return null
  }
}

export const readAssistantRetentionDays = () => {
  if (!canUseStorage()) return 90
  const raw = localStorage.getItem(ASSISTANT_DATA_RETENTION_DAYS_KEY)
  const parsed = Number(raw)
  if (parsed === 7 || parsed === 30 || parsed === 90 || parsed === 180 || parsed === 365) return parsed
  return 90
}
