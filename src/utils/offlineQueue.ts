import { supabase } from '@/lib/supabase'

type QueueEntity = 'expenses' | 'incomes' | 'investments' | 'credit_cards' | 'credit_card_bills' | 'user_settings' | 'categories' | 'income_categories' | 'expense_category_month_limits'
type QueueAction = 'create' | 'update' | 'delete'

interface OfflineQueueItem {
  id: string
  entity: QueueEntity
  action: QueueAction
  recordId?: string
  payload?: Record<string, unknown>
  idempotencyKey?: string
  createdAt: string
  _uiId?: string
}

export interface ConflictItem {
  id: string
  queueItem: OfflineQueueItem
  serverData: Record<string, unknown>
  createdAt: string
}

const STORAGE_KEY = 'offline-sync-queue'
const CONFLICT_STORAGE_KEY = 'offline-conflict-queue'

function readQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(queue: OfflineQueueItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function readConflictQueue(): ConflictItem[] {
  try {
    const raw = localStorage.getItem(CONFLICT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeConflictQueue(queue: ConflictItem[]) {
  localStorage.setItem(CONFLICT_STORAGE_KEY, JSON.stringify(queue))
}

function addConflict(conflict: Omit<ConflictItem, 'id' | 'createdAt'>) {
  const queue = readConflictQueue()
  const nextItem: ConflictItem = {
    ...conflict,
    id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  }
  queue.push(nextItem)
  writeConflictQueue(queue)
  window.dispatchEvent(new CustomEvent('offline-conflict-detected'))
  return nextItem
}

export function removeConflict(id: string) {
  const queue = readConflictQueue()
  writeConflictQueue(queue.filter(c => c.id !== id))
}

export function enqueueOfflineOperation(item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) {
  const queue = readQueue()

  if (item.idempotencyKey) {
    const existing = queue.find((queuedItem) => (
      queuedItem.idempotencyKey === item.idempotencyKey
      && queuedItem.entity === item.entity
      && queuedItem.action === item.action
    ))

    if (existing) {
      return existing
    }
  }

  const nextItem: OfflineQueueItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  }
  queue.push(nextItem)
  writeQueue(queue)
  return nextItem
}

export function getOfflineQueueSize() {
  return readQueue().length
}

export function updateOfflineCreatePayload(uiId: string, updates: Record<string, unknown>): boolean {
  const queue = readQueue()
  const itemIndex = queue.findIndex(item => item.action === 'create' && item.payload?._uiId === uiId)

  if (itemIndex >= 0) {
    queue[itemIndex].payload = { ...queue[itemIndex].payload, ...updates }
    writeQueue(queue)
    return true
  }
  return false
}

export function removeOfflineCreateOperation(uiId: string): boolean {
  const queue = readQueue()
  const filteredQueue = queue.filter(item => !(item.action === 'create' && item.payload?._uiId === uiId))

  if (filteredQueue.length !== queue.length) {
    writeQueue(filteredQueue)
    return true
  }
  return false
}

function isLikelyConnectionError(error: unknown) {
  if (!error) return false
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: string }).message || '').toLowerCase()
    : String(error).toLowerCase()

  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('offline')
  )
}

export function shouldQueueOffline(error?: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return isLikelyConnectionError(error)
}

function sanitizePayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload) return {}
  const sanitized = { ...payload }
  const keysToRemove = ['_uiId', 'category', 'credit_card', 'income_category', 'installment_items']
  keysToRemove.forEach(key => {
    delete sanitized[key]
  })
  return sanitized
}

async function processOne(item: OfflineQueueItem) {
  if (item.action === 'create') {
    const payloadToInsert = sanitizePayload(item.payload)
    const { error } = await supabase.from(item.entity).insert([payloadToInsert])
    if (error) {
      console.error(`Offline sync failed for ${item.entity}.${item.action}:`, error)
      console.error('Payload attempted:', payloadToInsert)
      throw error
    }
    return
  }

  if (!item.recordId) {
    throw new Error('recordId ausente para operação offline')
  }

  if (item.recordId.startsWith('offline-')) {
    // This item was created offline but not yet synced.
    // If it's an update, it was likely merged into the 'create' payload.
    // If it's a delete, it only needs to be removed from the local queue (handled by removal from queue).
    return
  }

  if (item.action === 'update') {
    // Conflict detection
    if (!['expense_category_month_limits', 'income_category_month_expectations'].includes(item.entity)) {
      const { data: serverData } = await supabase.from(item.entity).select('*').eq('id', item.recordId).maybeSingle()
      if (serverData && serverData.updated_at) {
        if (new Date(serverData.updated_at) > new Date(item.createdAt)) {
          addConflict({
            queueItem: item,
            serverData
          })
          return // Treated as processed
        }
      }
    }

    const payloadToUpdate = sanitizePayload(item.payload)
    let query = supabase.from(item.entity).update(payloadToUpdate)

    if (item.entity === 'expense_category_month_limits') {
      query = query.eq('category_id', payloadToUpdate.category_id).eq('month', payloadToUpdate.month)
    } else {
      query = query.eq('id', item.recordId)
    }

    const { error } = await query
    if (error) {
      console.error(`Offline sync failed for ${item.entity}.${item.action}:`, error)
      console.error('Payload attempted:', payloadToUpdate)
      throw error
    }
    return
  }

  if (item.action === 'delete') {
    let deleteQuery = supabase.from(item.entity).delete()
    if (item.entity === 'expense_category_month_limits' && item.payload) {
      deleteQuery = deleteQuery.eq('category_id', item.payload.category_id).eq('month', item.payload.month)
    } else {
      deleteQuery = deleteQuery.eq('id', item.recordId)
    }
    const { error } = await deleteQuery
    if (error) {
      console.error(`Offline sync failed for ${item.entity}.${item.action}:`, error)
      throw error
    }
  }
}

export async function flushOfflineQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, remaining: getOfflineQueueSize() }
  }

  const queue = readQueue()
  if (queue.length === 0) {
    return { processed: 0, remaining: 0 }
  }

  let processed = 0
  const remaining: OfflineQueueItem[] = []

  for (const item of queue) {
    try {
      await processOne(item)
      processed += 1
    } catch {
      remaining.push(item)
    }
  }

  writeQueue(remaining)

  if (processed > 0) {
    window.dispatchEvent(new CustomEvent('offline-queue-processed', {
      detail: { processed, remaining: remaining.length },
    }))
  }

  return { processed, remaining: remaining.length }
}
