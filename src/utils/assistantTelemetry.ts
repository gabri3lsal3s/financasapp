import type { AssistantIntent } from '@/types'

export type AssistantTelemetryEventType = 'interpret' | 'confirm'

export interface AssistantTelemetryEvent {
  id: string
  timestamp: string
  deviceId?: string
  eventType: AssistantTelemetryEventType
  intent?: AssistantIntent
  commandId?: string
  confirmationMode?: 'write_only' | 'always' | 'never'
  forceConfirmation?: boolean
  confirmationMethod?: 'voice' | 'touch'
  requiresConfirmation?: boolean
  confidence?: number
  status?: 'executed' | 'denied' | 'failed' | 'expired' | 'success' | 'error'
  durationMs?: number
  errorMessage?: string
}

export interface AssistantTelemetrySummary {
  totalEvents: number
  interpretedCount: number
  confirmCount: number
  interpretAccuracy: number
  executionRate: number
  averageDurationMs: number
}

const ASSISTANT_TELEMETRY_KEY = 'assistant.telemetry.events'
const ASSISTANT_TELEMETRY_EVENT = 'assistant-telemetry-updated'
const TELEMETRY_MAX_ITEMS = 300

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readTelemetryEvents = (): AssistantTelemetryEvent[] => {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(ASSISTANT_TELEMETRY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeTelemetryEvents = (events: AssistantTelemetryEvent[]) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(ASSISTANT_TELEMETRY_KEY, JSON.stringify(events))
  window.dispatchEvent(new Event(ASSISTANT_TELEMETRY_EVENT))
}

export const trackAssistantTelemetry = (event: Omit<AssistantTelemetryEvent, 'id' | 'timestamp'>) => {
  const eventWithMeta: AssistantTelemetryEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
  }

  const current = readTelemetryEvents()
  const next = [...current, eventWithMeta]
  const capped = next.length > TELEMETRY_MAX_ITEMS
    ? next.slice(next.length - TELEMETRY_MAX_ITEMS)
    : next

  writeTelemetryEvents(capped)
  return eventWithMeta
}

export const getAssistantTelemetryEvents = () => readTelemetryEvents()

export const clearAssistantTelemetryEvents = () => {
  writeTelemetryEvents([])
}

const calculateTelemetrySummary = (events: AssistantTelemetryEvent[]): AssistantTelemetrySummary => {
  const scopedEvents = events

  const interpretEvents = scopedEvents.filter((event) => event.eventType === 'interpret')
  const confirmEvents = scopedEvents.filter((event) => event.eventType === 'confirm')

  const interpretedCount = interpretEvents.length
  const interpretedWithIntent = interpretEvents.filter((event) => event.intent && event.intent !== 'unknown').length
  const interpretAccuracy = interpretedCount > 0
    ? Number(((interpretedWithIntent / interpretedCount) * 100).toFixed(2))
    : 0

  const executedCount = confirmEvents.filter((event) => event.status === 'executed').length
  const executionRate = confirmEvents.length > 0
    ? Number(((executedCount / confirmEvents.length) * 100).toFixed(2))
    : 0

  const durationEvents = scopedEvents.filter((event) => Number.isFinite(event.durationMs) && Number(event.durationMs) >= 0)
  const averageDurationMs = durationEvents.length > 0
    ? Number((durationEvents.reduce((sum, event) => sum + Number(event.durationMs || 0), 0) / durationEvents.length).toFixed(2))
    : 0

  return {
    totalEvents: scopedEvents.length,
    interpretedCount,
    confirmCount: confirmEvents.length,
    interpretAccuracy,
    executionRate,
    averageDurationMs,
  }
}

export const getAssistantTelemetrySummary = (options?: { days?: number; offsetDays?: number; deviceId?: string }): AssistantTelemetrySummary => {
  const events = readTelemetryEvents()
  const filteredByDevice = options?.deviceId
    ? events.filter((event) => event.deviceId === options.deviceId)
    : events

  if (!options?.days || options.days <= 0) {
    return calculateTelemetrySummary(filteredByDevice)
  }

  const offsetDays = Math.max(0, options.offsetDays || 0)
  const windowMs = options.days * 24 * 60 * 60 * 1000
  const now = Date.now()
  const windowEnd = now - (offsetDays * 24 * 60 * 60 * 1000)
  const windowStart = windowEnd - windowMs

  const scopedEvents = filteredByDevice.filter((event) => {
    const timestampMs = new Date(event.timestamp).getTime()
    return Number.isFinite(timestampMs) && timestampMs > windowStart && timestampMs <= windowEnd
  })

  return calculateTelemetrySummary(scopedEvents)
}

export { ASSISTANT_TELEMETRY_EVENT, ASSISTANT_TELEMETRY_KEY }
