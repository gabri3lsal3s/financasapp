/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import { createAssistantMemoryEntry } from '@/utils/assistantMemory'
import {
  clearAssistantContextDecisionLogs,
  getAssistantContextDecisionLogs,
  rememberAssistantSessionPreference,
  resolveAssistantContextWithPriority,
} from '@/utils/assistantContextResolver'

describe('assistantContextResolver', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAssistantContextDecisionLogs()
  })

  it('mantém categoria do comando quando presente', () => {
    createAssistantMemoryEntry({
      keyword: 'mercado',
      transactionType: 'expense',
      categoryId: 'cat-memory',
      categoryName: 'Memória',
    })

    rememberAssistantSessionPreference('device-1', 'add_expense', {
      transactionType: 'expense',
      category: {
        id: 'cat-session',
        name: 'Sessão',
        confidence: 0.91,
        source: 'session',
      },
    })

    const result = resolveAssistantContextWithPriority('device-1', 'add_expense', {
      transactionType: 'expense',
      description: 'mercado',
      category: {
        id: 'cat-command',
        name: 'Comando',
        confidence: 0.95,
        source: 'name_match',
      },
    })

    expect(result.source).toBe('command')
    expect(result.slots.category?.id).toBe('cat-command')
  })

  it('prioriza preferência de sessão sobre memória longa', () => {
    createAssistantMemoryEntry({
      keyword: 'mercado',
      transactionType: 'expense',
      categoryId: 'cat-memory',
      categoryName: 'Memória',
    })

    rememberAssistantSessionPreference('device-1', 'add_expense', {
      transactionType: 'expense',
      category: {
        id: 'cat-session',
        name: 'Sessão',
        confidence: 0.91,
        source: 'session',
      },
    })

    const result = resolveAssistantContextWithPriority('device-1', 'add_expense', {
      transactionType: 'expense',
      description: 'mercado do mês',
    })

    expect(result.source).toBe('session')
    expect(result.slots.category?.id).toBe('cat-session')
  })

  it('usa memória quando não há comando nem sessão', () => {
    createAssistantMemoryEntry({
      keyword: 'ifood',
      transactionType: 'expense',
      categoryId: 'cat-memory',
      categoryName: 'Alimentação',
    })

    const result = resolveAssistantContextWithPriority('device-1', 'add_expense', {
      transactionType: 'expense',
      description: 'ifood almoço',
    })

    expect(result.source).toBe('memory')
    expect(result.slots.category?.id).toBe('cat-memory')
  })

  it('registra log técnico da decisão', () => {
    resolveAssistantContextWithPriority('device-1', 'add_expense', {
      transactionType: 'expense',
      description: 'sem categoria',
    })

    const logs = getAssistantContextDecisionLogs()
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0]?.source).toBe('none')
  })

  it('limpa logs técnicos de decisão', () => {
    resolveAssistantContextWithPriority('device-1', 'add_expense', {
      transactionType: 'expense',
      description: 'teste',
    })

    expect(getAssistantContextDecisionLogs().length).toBeGreaterThan(0)

    clearAssistantContextDecisionLogs()
    expect(getAssistantContextDecisionLogs()).toEqual([])
  })
})
