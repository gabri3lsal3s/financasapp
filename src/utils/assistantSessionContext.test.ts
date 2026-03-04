/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssistantInterpretResult } from '@/types'
import {
  clearAssistantPendingContext,
  getAssistantPendingContext,
  saveAssistantPendingContext,
} from '@/utils/assistantSessionContext'

const makeInterpretation = (commandId: string): AssistantInterpretResult => ({
  command: {
    id: commandId,
    session_id: 'session-1',
    command_text: 'almoço 25',
    interpreted_intent: 'add_expense',
    requires_confirmation: true,
    status: 'pending_confirmation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  intent: 'add_expense',
  confidence: 0.9,
  slots: {
    transactionType: 'expense',
    amount: 25,
    description: 'Almoço',
    date: '2026-03-04',
  },
  requiresConfirmation: true,
  confirmationText: 'Confirma despesa?',
})

describe('assistantSessionContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('salva e recupera contexto pendente válido', () => {
    saveAssistantPendingContext('device-1', makeInterpretation('cmd-1'))

    const loaded = getAssistantPendingContext('device-1')

    expect(loaded).not.toBeNull()
    expect(loaded?.interpretation.command.id).toBe('cmd-1')
  })

  it('remove contexto expirado ao ler', () => {
    saveAssistantPendingContext('device-1', makeInterpretation('cmd-2'), {
      confirmationWindowMs: -1,
    })

    const loaded = getAssistantPendingContext('device-1')

    expect(loaded).toBeNull()
  })

  it('limpa contexto explicitamente', () => {
    saveAssistantPendingContext('device-1', makeInterpretation('cmd-3'))
    clearAssistantPendingContext('device-1')

    const loaded = getAssistantPendingContext('device-1')
    expect(loaded).toBeNull()
  })
})
