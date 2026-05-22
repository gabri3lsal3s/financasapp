/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  learnFromCreditCardCsvInsertion,
  suggestFromCreditCardCsvLearning,
} from '@/utils/creditCardCsvLearning'

describe('creditCardCsvLearning', () => {
  beforeEach(() => {
    if (typeof localStorage === 'undefined' || !localStorage.clear) {
      const store = new Map<string, string>()
      const mock = {
        getItem: (key: string) => store.get(key) || null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
        length: 0,
        key: () => null,
      }
      Object.defineProperty(globalThis, 'localStorage', {
        value: mock,
        writable: true,
        configurable: true,
      })
    } else {
      localStorage.clear()
    }
  })

  it('aprende mapeamento de descrição oficial para categoria/descrição escolhida', () => {
    learnFromCreditCardCsvInsertion({
      officialDescription: 'SUPERMERCADO ALFA 123',
      chosenDescription: 'Mercado do mês',
      chosenCategoryId: 'cat-food',
    })

    const suggestion = suggestFromCreditCardCsvLearning('SUPERMERCADO ALFA 123')

    expect(suggestion?.categoryId).toBe('cat-food')
    expect(suggestion?.description).toBe('Mercado do mês')
    expect(suggestion?.confidence).toBe(1)
  })

  it('sugere por similaridade para descrições próximas', () => {
    learnFromCreditCardCsvInsertion({
      officialDescription: 'UBER VIAGEM CENTRO',
      chosenDescription: 'Uber',
      chosenCategoryId: 'cat-transport',
    })

    const suggestion = suggestFromCreditCardCsvLearning('UBER*VIAGEM CENTRO SP')

    expect(suggestion).not.toBeNull()
    expect(suggestion?.categoryId).toBe('cat-transport')
    expect((suggestion?.confidence || 0)).toBeGreaterThanOrEqual(0.55)
  })
})
