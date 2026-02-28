import { supabase } from '@/lib/supabase'

type QueueEntity = 'expenses' | 'incomes' | 'investments'
type QueueAction = 'create' | 'update' | 'delete'

interface OfflineQueueItem {
  id: string
  entity: QueueEntity
  action: QueueAction
  recordId?: string
  payload?: Record<string, unknown>
  createdAt: string
}

const STORAGE_KEY = 'offline-sync-queue'

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

export function enqueueOfflineOperation(item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) {
  const queue = readQueue()
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

async function processOne(item: OfflineQueueItem) {
  if (item.action === 'create') {
    const { error } = await supabase.from(item.entity).insert([item.payload || {}])
    if (error) throw error
    return
  }

  if (!item.recordId) {
    throw new Error('recordId ausente para operação offline')
  }

  if (item.action === 'update') {
    const { error } = await supabase.from(item.entity).update(item.payload || {}).eq('id', item.recordId)
    if (error) throw error
    return
  }

  const { error } = await supabase.from(item.entity).delete().eq('id', item.recordId)
  if (error) throw error
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
