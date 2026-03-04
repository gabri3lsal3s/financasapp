/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import { runAssistantPrivacyCleanup } from '@/utils/assistantPrivacy'

describe('assistantPrivacy', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('remove registros locais fora da retenção e limpa metadado de voz da fila', () => {
    const oldTimestamp = new Date(Date.now() - (120 * 24 * 60 * 60 * 1000)).toISOString()
    const recentTimestamp = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString()

    localStorage.setItem('assistant.telemetry.events', JSON.stringify([
      { id: 'old', timestamp: oldTimestamp, eventType: 'interpret' },
      { id: 'new', timestamp: recentTimestamp, eventType: 'interpret' },
    ]))

    localStorage.setItem('assistant-memory-entries', JSON.stringify([
      { id: 'old', keyword: 'x', transactionType: 'expense', categoryId: '1', categoryName: 'A', confidence: 0.9, createdAt: oldTimestamp, updatedAt: oldTimestamp },
      { id: 'new', keyword: 'y', transactionType: 'expense', categoryId: '1', categoryName: 'A', confidence: 0.9, createdAt: recentTimestamp, updatedAt: recentTimestamp },
    ]))

    localStorage.setItem('assistant-context-decision-logs', JSON.stringify([
      { id: 'old', createdAt: oldTimestamp },
      { id: 'new', createdAt: recentTimestamp },
    ]))

    localStorage.setItem('assistant-offline-sync-history', JSON.stringify([
      { id: 'old', createdAt: oldTimestamp },
      { id: 'new', createdAt: recentTimestamp },
    ]))

    localStorage.setItem('assistant-session-preferences:device-1', JSON.stringify({
      expense: { categoryId: '1', categoryName: 'A', confidence: 0.9, updatedAt: oldTimestamp },
      income: { categoryId: '2', categoryName: 'B', confidence: 0.9, updatedAt: recentTimestamp },
    }))

    localStorage.setItem('assistant-offline-queue', JSON.stringify([
      { id: 'q1', createdAt: recentTimestamp, spokenTextEncrypted: 'v1:abc', text: 'teste', deviceId: 'd1' },
    ]))

    const summary = runAssistantPrivacyCleanup(90)

    expect(summary?.telemetryRemoved).toBe(1)
    expect(summary?.memoryRemoved).toBe(1)
    expect(summary?.contextLogsRemoved).toBe(1)
    expect(summary?.offlineHistoryRemoved).toBe(1)
    expect(summary?.sessionPreferencesRemoved).toBe(1)
    expect(summary?.queueVoiceMetadataRedacted).toBe(1)

    const queue = JSON.parse(localStorage.getItem('assistant-offline-queue') || '[]')
    expect(queue[0]?.spokenText).toBeUndefined()
    expect(queue[0]?.spokenTextEncrypted).toBeUndefined()
  })
})
