/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyAssistantMemoryToSlots,
  clearAssistantMemoryEntries,
  createAssistantMemoryEntry,
  findAssistantMemoryMatch,
  getAssistantMemoryEntries,
  learnAssistantMemoryFromConfirmation,
} from '@/utils/assistantMemory'

describe('assistantMemory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('cria e lista entrada de memória', () => {
    createAssistantMemoryEntry({
      keyword: 'mercado',
      transactionType: 'expense',
      categoryId: 'cat-1',
      categoryName: 'Alimentação',
    })

    const entries = getAssistantMemoryEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.categoryName).toBe('Alimentação')
  })

  it('aplica memória para preencher categoria quando ausente', () => {
    createAssistantMemoryEntry({
      keyword: 'mercado',
      transactionType: 'expense',
      categoryId: 'cat-1',
      categoryName: 'Alimentação',
    })

    const applied = applyAssistantMemoryToSlots('add_expense', {
      transactionType: 'expense',
      amount: 30,
      description: 'mercado do mês',
    })

    expect(applied.matched).not.toBeNull()
    expect(applied.slots.category?.id).toBe('cat-1')
  })

  it('aprende memória a partir da confirmação', () => {
    learnAssistantMemoryFromConfirmation('add_income', {
      transactionType: 'income',
      amount: 1000,
      description: 'salário acme',
      category: {
        id: 'inc-1',
        name: 'Salário',
        confidence: 0.93,
        source: 'mapping',
      },
    })

    const entries = getAssistantMemoryEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.transactionType).toBe('income')
  })

  it('limpa memória local', () => {
    createAssistantMemoryEntry({
      keyword: 'ifood',
      transactionType: 'expense',
      categoryId: 'cat-2',
      categoryName: 'Alimentação',
    })

    clearAssistantMemoryEntries()
    expect(getAssistantMemoryEntries()).toEqual([])
  })

  it('encontra match de memória por descrição', () => {
    createAssistantMemoryEntry({
      keyword: 'uber',
      transactionType: 'expense',
      categoryId: 'cat-transport',
      categoryName: 'Transporte',
    })

    const matched = findAssistantMemoryMatch('add_expense', {
      transactionType: 'expense',
      description: 'uber para reunião',
    })

    expect(matched?.categoryId).toBe('cat-transport')
  })
})
