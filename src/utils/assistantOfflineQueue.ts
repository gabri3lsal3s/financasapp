import {
  confirmAssistantCommand,
  interpretAssistantCommand,
} from '@/services/assistantService'
import { protectVoiceText, unprotectVoiceText } from '@/utils/assistantSensitiveVoice'
import type { AssistantSlots } from '@/types'

type AssistantOfflineQueueItem = {
  id: string
  createdAt: string
  deviceId: string
  text: string
  locale?: string
  confirmationMode?: 'write_only' | 'always' | 'never'
  confirmationMethod?: 'voice' | 'touch'
  spokenText?: string
  spokenTextEncrypted?: string
  editedDescription?: string
  editedSlots?: AssistantSlots
  idempotencyKey?: string
}

type AssistantOfflineSyncStatus = 'success' | 'partial' | 'error' | 'skipped'

type AssistantOfflineSyncHistoryItem = {
  id: string
  createdAt: string
  attempted: number
  processed: number
  remaining: number
  status: AssistantOfflineSyncStatus
}

const STORAGE_KEY = 'assistant-offline-queue'
const ASSISTANT_OFFLINE_QUEUE_EVENT = 'assistant-offline-queue-processed'
const ASSISTANT_OFFLINE_QUEUE_UPDATED_EVENT = 'assistant-offline-queue-updated'
const ASSISTANT_OFFLINE_SYNC_HISTORY_STORAGE_KEY = 'assistant-offline-sync-history'
const ASSISTANT_OFFLINE_SYNC_EVENT = 'assistant-offline-sync-event'
const ASSISTANT_OFFLINE_SYNC_HISTORY_LIMIT = 10

const readQueue = (): AssistantOfflineQueueItem[] => {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeQueue = (queue: AssistantOfflineQueueItem[]) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ASSISTANT_OFFLINE_QUEUE_UPDATED_EVENT, {
      detail: { pending: queue.length },
    }))
  }
}

const readSyncHistory = (): AssistantOfflineSyncHistoryItem[] => {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(ASSISTANT_OFFLINE_SYNC_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeSyncHistory = (history: AssistantOfflineSyncHistoryItem[]) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ASSISTANT_OFFLINE_SYNC_HISTORY_STORAGE_KEY, JSON.stringify(history))
}

const recordSyncHistory = (entry: Omit<AssistantOfflineSyncHistoryItem, 'id' | 'createdAt'>) => {
  const history = readSyncHistory()
  const item: AssistantOfflineSyncHistoryItem = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  }

  const nextHistory = [item, ...history].slice(0, ASSISTANT_OFFLINE_SYNC_HISTORY_LIMIT)
  writeSyncHistory(nextHistory)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ASSISTANT_OFFLINE_SYNC_EVENT, {
      detail: item,
    }))
  }
}

export const enqueueAssistantOfflineCommand = (
  item: Omit<AssistantOfflineQueueItem, 'id' | 'createdAt'>,
) => {
  const queue = readQueue()

  if (item.idempotencyKey) {
    const existing = queue.find((queuedItem) => queuedItem.idempotencyKey === item.idempotencyKey)
    if (existing) return existing
  }

  const nextItem: AssistantOfflineQueueItem = {
    ...item,
    spokenText: undefined,
    spokenTextEncrypted: protectVoiceText(item.spokenText),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  }

  queue.push(nextItem)
  writeQueue(queue)
  return nextItem
}

export const getAssistantOfflineQueueSize = () => readQueue().length
export const getAssistantOfflineSyncHistory = () => readSyncHistory()
export const clearAssistantOfflineSyncHistory = () => {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(ASSISTANT_OFFLINE_SYNC_HISTORY_STORAGE_KEY)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ASSISTANT_OFFLINE_SYNC_EVENT, {
      detail: null,
    }))
  }
}

export const flushAssistantOfflineQueue = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const remaining = getAssistantOfflineQueueSize()

    if (remaining > 0) {
      recordSyncHistory({
        attempted: remaining,
        processed: 0,
        remaining,
        status: 'skipped',
      })
    }

    return { processed: 0, remaining }
  }

  const queue = readQueue()
  if (!queue.length) {
    return { processed: 0, remaining: 0 }
  }

  let processed = 0
  const remaining: AssistantOfflineQueueItem[] = []

  for (const item of queue) {
    try {
      const interpretation = await interpretAssistantCommand({
        deviceId: item.deviceId,
        text: item.text,
        locale: item.locale || 'pt-BR',
        confirmationMode: item.confirmationMode || 'write_only',
      })

      if (interpretation.requiresConfirmation) {
        const spokenText = item.spokenText || unprotectVoiceText(item.spokenTextEncrypted)

        await confirmAssistantCommand({
          commandId: interpretation.command.id,
          confirmed: true,
          spokenText,
          editedDescription: item.editedDescription,
          editedSlots: item.editedSlots,
          confirmationMethod: item.confirmationMethod || 'touch',
        })
      }

      processed += 1
    } catch {
      remaining.push(item)
    }
  }

  writeQueue(remaining)

  const attempted = queue.length

  if (attempted > 0) {
    const status: AssistantOfflineSyncStatus = remaining.length === 0
      ? 'success'
      : processed > 0
        ? 'partial'
        : 'error'

    recordSyncHistory({
      attempted,
      processed,
      remaining: remaining.length,
      status,
    })
  }

  if (processed > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ASSISTANT_OFFLINE_QUEUE_EVENT, {
      detail: { processed, remaining: remaining.length },
    }))
  }

  return { processed, remaining: remaining.length }
}

export { ASSISTANT_OFFLINE_QUEUE_EVENT, STORAGE_KEY as ASSISTANT_OFFLINE_QUEUE_STORAGE_KEY }
export { ASSISTANT_OFFLINE_QUEUE_UPDATED_EVENT }
export { ASSISTANT_OFFLINE_SYNC_EVENT, ASSISTANT_OFFLINE_SYNC_HISTORY_STORAGE_KEY }
