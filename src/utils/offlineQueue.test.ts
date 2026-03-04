import { beforeEach, describe, expect, it } from 'vitest'
import { enqueueOfflineOperation, getOfflineQueueSize } from '@/utils/offlineQueue'

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
      idempotencyKey: 'assistant:cmd-1:expense:0',
    })

    const second = enqueueOfflineOperation({
      entity: 'expenses',
      action: 'create',
      payload: { amount: 120 },
      idempotencyKey: 'assistant:cmd-1:expense:0',
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
