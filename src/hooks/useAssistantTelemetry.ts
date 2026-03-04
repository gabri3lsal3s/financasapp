import { useCallback, useEffect, useState } from 'react'
import {
  ASSISTANT_TELEMETRY_EVENT,
  ASSISTANT_TELEMETRY_KEY,
  clearAssistantTelemetryEvents,
  getAssistantTelemetryEvents,
  getAssistantTelemetrySummary,
} from '@/utils/assistantTelemetry'

export type AssistantTelemetrySourceFilter = 'all' | 'dashboard' | 'settings'

const resolveDeviceIdFromFilter = (filter: AssistantTelemetrySourceFilter) => {
  if (filter === 'dashboard') return 'web-dashboard-device'
  if (filter === 'settings') return 'web-settings-device'
  return undefined
}

export function useAssistantTelemetry() {
  const [sourceFilter, setSourceFilter] = useState<AssistantTelemetrySourceFilter>('all')
  const [events, setEvents] = useState(getAssistantTelemetryEvents)
  const [summary, setSummary] = useState(getAssistantTelemetrySummary)
  const [weeklySummary, setWeeklySummary] = useState(() => getAssistantTelemetrySummary({ days: 7 }))
  const [previousWeeklySummary, setPreviousWeeklySummary] = useState(() => getAssistantTelemetrySummary({ days: 7, offsetDays: 7 }))

  useEffect(() => {
    const selectedDeviceId = resolveDeviceIdFromFilter(sourceFilter)

    const sync = () => {
      const allEvents = getAssistantTelemetryEvents()
      const filteredEvents = selectedDeviceId
        ? allEvents.filter((event) => event.deviceId === selectedDeviceId)
        : allEvents

      setEvents(filteredEvents)
      setSummary(getAssistantTelemetrySummary({ deviceId: selectedDeviceId }))
      setWeeklySummary(getAssistantTelemetrySummary({ days: 7, deviceId: selectedDeviceId }))
      setPreviousWeeklySummary(getAssistantTelemetrySummary({ days: 7, offsetDays: 7, deviceId: selectedDeviceId }))
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === ASSISTANT_TELEMETRY_KEY) {
        sync()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(ASSISTANT_TELEMETRY_EVENT, sync)
    sync()

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(ASSISTANT_TELEMETRY_EVENT, sync)
    }
  }, [sourceFilter])

  const clearTelemetry = useCallback(() => {
    clearAssistantTelemetryEvents()
  }, [])

  const trend = {
    interpretAccuracyDelta: Number((weeklySummary.interpretAccuracy - previousWeeklySummary.interpretAccuracy).toFixed(2)),
    executionRateDelta: Number((weeklySummary.executionRate - previousWeeklySummary.executionRate).toFixed(2)),
    averageDurationDeltaMs: Number((weeklySummary.averageDurationMs - previousWeeklySummary.averageDurationMs).toFixed(2)),
  }

  return {
    events,
    sourceFilter,
    setSourceFilter,
    summary,
    weeklySummary,
    previousWeeklySummary,
    trend,
    clearTelemetry,
  }
}
