import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueOfflineOperation,
  getOfflineQueueSize,
  removeOfflineCreateOperation,
  sanitizeOfflinePayload,
  shouldQueueOffline,
  updateOfflineCreatePayload,
} from '@/utils/offlineQueue'

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

describe('offlineQueue idempotency', () => {
  beforeEach(() => {
    const localStorageMock = createMemoryLocalStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })
  })

  it('evita duplicação quando idempotencyKey é igual', () => {
    const first = enqueueOfflineOperation({
      entity: 'expenses',
      action: 'create',
      payload: { amount: 120 },
      idempotencyKey: 'offline:cmd-1:expense:0',
    })

    const second = enqueueOfflineOperation({
      entity: 'expenses',
      action: 'create',
      payload: { amount: 120 },
      idempotencyKey: 'offline:cmd-1:expense:0',
    })

    expect(getOfflineQueueSize()).toBe(1)
    expect(second.id).toBe(first.id)
  })

  it('mantém itens distintos sem idempotencyKey', () => {
    enqueueOfflineOperation({
      entity: 'incomes',
      action: 'create',
      payload: { amount: 500 },
    })

    enqueueOfflineOperation({
      entity: 'incomes',
      action: 'create',
      payload: { amount: 500 },
    })

    expect(getOfflineQueueSize()).toBe(2)
  })
})

describe('shouldQueueOffline', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retorna true quando navigator está offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(shouldQueueOffline()).toBe(true)
  })

  it('retorna true para erros de rede', () => {
    vi.stubGlobal('navigator', { onLine: true })
    expect(shouldQueueOffline(new Error('Failed to fetch'))).toBe(true)
  })

  it('retorna false para outros erros com rede online', () => {
    vi.stubGlobal('navigator', { onLine: true })
    expect(shouldQueueOffline(new Error('permission denied'))).toBe(false)
  })
})

describe('sanitizeOfflinePayload', () => {
  it('remove campos de UI e joins do payload', () => {
    const sanitized = sanitizeOfflinePayload({
      amount: 10,
      _uiId: 'offline-1',
      category: { name: 'Food' },
      credit_card: { id: 'c1' },
    })

    expect(sanitized).toEqual({ amount: 10 })
  })
})

describe('updateOfflineCreatePayload', () => {
  beforeEach(() => {
    const localStorageMock = createMemoryLocalStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })
  })

  it('atualiza payload de create pendente pelo _uiId', () => {
    enqueueOfflineOperation({
      entity: 'expenses',
      action: 'create',
      payload: { amount: 10, _uiId: 'ui-exp-1' },
    })

    const updated = updateOfflineCreatePayload('ui-exp-1', { amount: 25 })
    expect(updated).toBe(true)
    expect(getOfflineQueueSize()).toBe(1)
  })

  it('remove operação create pendente pelo _uiId', () => {
    enqueueOfflineOperation({
      entity: 'expenses',
      action: 'create',
      payload: { amount: 10, _uiId: 'ui-exp-2' },
    })

    expect(removeOfflineCreateOperation('ui-exp-2')).toBe(true)
    expect(getOfflineQueueSize()).toBe(0)
  })
})
