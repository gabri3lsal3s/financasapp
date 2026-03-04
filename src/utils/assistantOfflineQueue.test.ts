import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAssistantOfflineSyncHistory,
  enqueueAssistantOfflineCommand,
  flushAssistantOfflineQueue,
  getAssistantOfflineSyncHistory,
  getAssistantOfflineQueueSize,
} from '@/utils/assistantOfflineQueue'

const interpretMock = vi.fn()
const confirmMock = vi.fn()

vi.mock('@/services/assistantService', () => ({
  interpretAssistantCommand: (...args: unknown[]) => interpretMock(...args),
  confirmAssistantCommand: (...args: unknown[]) => confirmMock(...args),
}))

describe('assistantOfflineQueue', () => {
  beforeEach(() => {
    const storage = (() => {
      let store: Record<string, string> = {}
      return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value
        },
        removeItem: (key: string) => {
          delete store[key]
        },
        clear: () => {
          store = {}
        },
        key: (index: number) => Object.keys(store)[index] ?? null,
        get length() {
          return Object.keys(store).length
        },
      }
    })()

    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: true },
    })

    localStorage.clear()
    vi.clearAllMocks()
  })

  it('deduplica por idempotencyKey', () => {
    enqueueAssistantOfflineCommand({
      deviceId: 'device-1',
      text: 'adicionar gasto de 20',
      idempotencyKey: 'same-key',
    })

    enqueueAssistantOfflineCommand({
      deviceId: 'device-1',
      text: 'adicionar gasto de 20',
      idempotencyKey: 'same-key',
    })

    expect(getAssistantOfflineQueueSize()).toBe(1)
  })

  it('sincroniza itens enfileirados quando online', async () => {
    enqueueAssistantOfflineCommand({
      deviceId: 'device-1',
      text: 'adicionar gasto de 30 mercado',
      locale: 'pt-BR',
      confirmationMode: 'write_only',
      confirmationMethod: 'touch',
    })

    interpretMock.mockResolvedValue({
      command: { id: 'cmd-1' },
      requiresConfirmation: true,
    })
    confirmMock.mockResolvedValue({ status: 'executed', commandId: 'cmd-1' })

    const result = await flushAssistantOfflineQueue()

    expect(result).toEqual({ processed: 1, remaining: 0 })
    expect(interpretMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(getAssistantOfflineQueueSize()).toBe(0)

    const history = getAssistantOfflineSyncHistory()
    expect(history.length).toBeGreaterThan(0)
    expect(history[0]?.status).toBe('success')
    expect(history[0]?.processed).toBe(1)
  })

  it('armazena metadado de voz protegido e reaplica ao sincronizar', async () => {
    enqueueAssistantOfflineCommand({
      deviceId: 'device-1',
      text: 'adicionar gasto de 45 jantar',
      spokenText: 'confirmar jantar',
      confirmationMethod: 'voice',
    })

    const queueRaw = localStorage.getItem('assistant-offline-queue') || '[]'
    const queueParsed = JSON.parse(queueRaw)

    expect(queueParsed[0]?.spokenText).toBeUndefined()
    expect(typeof queueParsed[0]?.spokenTextEncrypted).toBe('string')

    interpretMock.mockResolvedValue({
      command: { id: 'cmd-voice' },
      requiresConfirmation: true,
    })
    confirmMock.mockResolvedValue({ status: 'executed', commandId: 'cmd-voice' })

    await flushAssistantOfflineQueue()

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      spokenText: 'confirmar jantar',
    }))
  })

  it('registra tentativa adiada quando offline', async () => {
    enqueueAssistantOfflineCommand({
      deviceId: 'device-1',
      text: 'adicionar despesa de 80 farmácia',
      locale: 'pt-BR',
      confirmationMode: 'write_only',
    })

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false },
    })

    const result = await flushAssistantOfflineQueue()

    expect(result).toEqual({ processed: 0, remaining: 1 })
    expect(interpretMock).not.toHaveBeenCalled()

    const history = getAssistantOfflineSyncHistory()
    expect(history.length).toBeGreaterThan(0)
    expect(history[0]?.status).toBe('skipped')
    expect(history[0]?.remaining).toBe(1)
  })

  it('limpa histórico de sincronização offline', async () => {
    enqueueAssistantOfflineCommand({
      deviceId: 'device-1',
      text: 'adicionar despesa de 20 café',
    })

    interpretMock.mockResolvedValue({
      command: { id: 'cmd-2' },
      requiresConfirmation: false,
    })

    await flushAssistantOfflineQueue()
    expect(getAssistantOfflineSyncHistory().length).toBeGreaterThan(0)

    clearAssistantOfflineSyncHistory()
    expect(getAssistantOfflineSyncHistory()).toEqual([])
  })
})
