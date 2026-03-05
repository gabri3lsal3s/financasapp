/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  learnFromCreditCardCsvInsertion,
  suggestFromCreditCardCsvLearning,
} from '@/utils/creditCardCsvLearning'

describe('creditCardCsvLearning', () => {
  beforeEach(() => {
    localStorage.clear()
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
