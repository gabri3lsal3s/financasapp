import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAssistantTelemetryEvents,
  getAssistantTelemetryEvents,
  getAssistantTelemetrySummary,
  trackAssistantTelemetry,
} from '@/utils/assistantTelemetry'

const createMemoryLocalStorage = () => {
  const store = new Map<string, string>()

  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

describe('assistant telemetry', () => {
  beforeEach(() => {
    const localStorageMock = createMemoryLocalStorage()
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: localStorageMock,
        dispatchEvent: () => true,
      },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })
  })

  it('registra eventos de interpretação e confirmação', () => {
    trackAssistantTelemetry({
      eventType: 'interpret',
      deviceId: 'web-dashboard-device',
      intent: 'add_expense',
      confidence: 0.9,
      requiresConfirmation: true,
      status: 'success',
      durationMs: 120,
    })

    trackAssistantTelemetry({
      eventType: 'confirm',
      deviceId: 'web-dashboard-device',
      commandId: 'cmd-1',
      intent: 'add_expense',
      confirmationMethod: 'touch',
      status: 'executed',
      durationMs: 80,
    })

    const events = getAssistantTelemetryEvents()
    expect(events).toHaveLength(2)
    expect(events[0].eventType).toBe('interpret')
    expect(events[1].eventType).toBe('confirm')
  })

  it('gera resumo com acurácia de interpretação e taxa de execução', () => {
    trackAssistantTelemetry({
      eventType: 'interpret',
      intent: 'add_income',
      status: 'success',
      durationMs: 150,
    })

    trackAssistantTelemetry({
      eventType: 'interpret',
      intent: 'unknown',
      status: 'success',
      durationMs: 170,
    })

    trackAssistantTelemetry({
      eventType: 'confirm',
      status: 'executed',
      durationMs: 60,
    })

    trackAssistantTelemetry({
      eventType: 'confirm',
      status: 'failed',
      durationMs: 90,
    })

    const summary = getAssistantTelemetrySummary()

    expect(summary.totalEvents).toBe(4)
    expect(summary.interpretedCount).toBe(2)
    expect(summary.confirmCount).toBe(2)
    expect(summary.interpretAccuracy).toBe(50)
    expect(summary.executionRate).toBe(50)
    expect(summary.averageDurationMs).toBe(117.5)
  })

  it('aplica janela temporal no resumo (últimos 7 dias)', () => {
    const now = Date.now()
    const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000)

    trackAssistantTelemetry({
      eventType: 'interpret',
      intent: 'add_income',
      status: 'success',
      durationMs: 100,
    })

    trackAssistantTelemetry({
      eventType: 'confirm',
      status: 'executed',
      durationMs: 80,
    })

    const events = getAssistantTelemetryEvents()
    const withOldEvent = [
      {
        ...events[0],
        id: 'old-event',
        timestamp: new Date(eightDaysAgo).toISOString(),
      },
      ...events,
    ]

    localStorage.setItem('assistant.telemetry.events', JSON.stringify(withOldEvent))

    const summaryAll = getAssistantTelemetrySummary()
    const summary7d = getAssistantTelemetrySummary({ days: 7 })
    const summaryPrevious7d = getAssistantTelemetrySummary({ days: 7, offsetDays: 7 })

    expect(summaryAll.totalEvents).toBe(3)
    expect(summary7d.totalEvents).toBe(2)
    expect(summaryPrevious7d.totalEvents).toBe(1)
  })

  it('limpa histórico de métricas locais', () => {
    trackAssistantTelemetry({
      eventType: 'interpret',
      intent: 'add_income',
      status: 'success',
      durationMs: 100,
    })

    expect(getAssistantTelemetryEvents().length).toBe(1)

    clearAssistantTelemetryEvents()

    expect(getAssistantTelemetryEvents().length).toBe(0)
    expect(getAssistantTelemetrySummary().totalEvents).toBe(0)
  })

  it('filtra resumo por dispositivo', () => {
    trackAssistantTelemetry({
      eventType: 'interpret',
      deviceId: 'web-dashboard-device',
      intent: 'add_income',
      status: 'success',
      durationMs: 100,
    })

    trackAssistantTelemetry({
      eventType: 'confirm',
      deviceId: 'web-settings-device',
      status: 'executed',
      durationMs: 80,
    })

    const dashboardSummary = getAssistantTelemetrySummary({ deviceId: 'web-dashboard-device' })
    const settingsSummary = getAssistantTelemetrySummary({ deviceId: 'web-settings-device' })

    expect(dashboardSummary.totalEvents).toBe(1)
    expect(dashboardSummary.interpretedCount).toBe(1)
    expect(settingsSummary.totalEvents).toBe(1)
    expect(settingsSummary.confirmCount).toBe(1)
  })
})
