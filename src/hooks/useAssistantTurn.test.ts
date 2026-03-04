/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssistantTurn } from '@/hooks/useAssistantTurn'
import type { AssistantInterpretResult } from '@/types'
import { saveAssistantPendingContext } from '@/utils/assistantSessionContext'

const useAssistantMock = vi.fn()

vi.mock('@/hooks/useAssistant', () => ({
  useAssistant: (...args: unknown[]) => useAssistantMock(...args),
}))

describe('useAssistantTurn - integração de turno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('interpreta comando com trim e hidrata campos editáveis', async () => {
    const ensureSession = vi.fn().mockResolvedValue({ id: 'session-1' })
    const interpretation: AssistantInterpretResult = {
      command: {
        id: 'cmd-1',
        session_id: 'session-1',
        command_text: 'almoço 30',
        requires_confirmation: true,
        status: 'pending_confirmation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      intent: 'add_expense',
      confidence: 0.92,
      slots: {
        transactionType: 'expense',
        amount: 30,
        description: 'Almoço',
        date: '2026-03-04',
      },
      requiresConfirmation: true,
      confirmationText: 'Confirma despesa de R$30,00?',
    }

    const interpret = vi.fn().mockResolvedValue(interpretation)
    const confirm = vi.fn()

    const assistantState = {
      loading: false,
      error: null,
      lastInterpretation: null as AssistantInterpretResult | null,
      lastConfirmation: null,
      ensureSession,
      interpret,
      confirm,
      getInsights: vi.fn(),
    }

    useAssistantMock.mockImplementation(() => assistantState)

    const { result, rerender } = renderHook(() => useAssistantTurn('web-test-device'))

    await act(async () => {
      await result.current.interpretCommand('   almoço 30   ', { confirmationMode: 'always' })
    })

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(interpret).toHaveBeenCalledWith('almoço 30', { confirmationMode: 'always', locale: 'pt-BR' })

    assistantState.lastInterpretation = interpretation
    rerender()

    await waitFor(() => {
      expect(result.current.editableConfirmationText).toBe('Confirma despesa de R$30,00?')
      expect(result.current.editableSlots?.description).toBe('Almoço')
    })
  })

  it('confirma usando conteúdo editável quando includeEditable=true', async () => {
    const ensureSession = vi.fn().mockResolvedValue({ id: 'session-1' })
    const confirm = vi.fn().mockResolvedValue({
      status: 'executed',
      message: 'ok',
      commandId: 'cmd-1',
    })

    const interpretation: AssistantInterpretResult = {
      command: {
        id: 'cmd-1',
        session_id: 'session-1',
        command_text: 'almoço 30',
        requires_confirmation: true,
        status: 'pending_confirmation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      intent: 'add_expense',
      confidence: 0.92,
      slots: {
        transactionType: 'expense',
        amount: 30,
        description: 'Almoço',
        date: '2026-03-04',
      },
      requiresConfirmation: true,
      confirmationText: 'Confirma despesa de R$30,00?',
    }

    const assistantState = {
      loading: false,
      error: null,
      lastInterpretation: interpretation,
      lastConfirmation: null,
      ensureSession,
      interpret: vi.fn().mockResolvedValue(interpretation),
      confirm,
      getInsights: vi.fn(),
    }

    useAssistantMock.mockImplementation(() => assistantState)

    const { result } = renderHook(() => useAssistantTurn('web-test-device'))

    await waitFor(() => {
      expect(result.current.editableSlots?.description).toBe('Almoço')
    })

    act(() => {
      result.current.setEditableConfirmationText('Confirmar versão editada')
      result.current.updateEditableSlots((previous) => ({
        ...previous,
        description: 'Jantar',
      }))
    })

    await act(async () => {
      await result.current.confirmLastInterpretation({ confirmed: true })
    })

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledWith(
      'cmd-1',
      true,
      'Confirmar versão editada',
      'Jantar',
      expect.objectContaining({ description: 'Jantar' }),
      'touch',
    )
  })

  it('permite confirmação sem payload editável no modo includeEditable=false', async () => {
    const confirm = vi.fn().mockResolvedValue({
      status: 'executed',
      message: 'ok',
      commandId: 'cmd-2',
    })

    const assistantState = {
      loading: false,
      error: null,
      lastInterpretation: {
        command: {
          id: 'cmd-2',
          session_id: 'session-1',
          command_text: 'investi 100',
          requires_confirmation: true,
          status: 'pending_confirmation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        intent: 'add_investment',
        confidence: 0.9,
        slots: { transactionType: 'investment', amount: 100, month: '2026-03' },
        requiresConfirmation: true,
        confirmationText: 'Confirma investimento?',
      } as AssistantInterpretResult,
      lastConfirmation: null,
      ensureSession: vi.fn(),
      interpret: vi.fn(),
      confirm,
      getInsights: vi.fn(),
    }

    useAssistantMock.mockImplementation(() => assistantState)

    const { result } = renderHook(() => useAssistantTurn('web-test-device'))

    await act(async () => {
      await result.current.confirmLastInterpretation({
        confirmed: true,
        spokenText: 'sim',
        includeEditable: false,
      })
    })

    expect(confirm).toHaveBeenCalledWith('cmd-2', true, 'sim', undefined, undefined, 'voice')
  })

  it('restaura contexto pendente salvo para o mesmo dispositivo', async () => {
    const interpretation: AssistantInterpretResult = {
      command: {
        id: 'cmd-persisted',
        session_id: 'session-1',
        command_text: 'gasto 50',
        requires_confirmation: true,
        status: 'pending_confirmation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      intent: 'add_expense',
      confidence: 0.9,
      slots: { transactionType: 'expense', amount: 50, description: 'Mercado' },
      requiresConfirmation: true,
      confirmationText: 'Confirma?',
    }

    saveAssistantPendingContext('web-test-device', interpretation)

    const assistantState = {
      loading: false,
      error: null,
      lastInterpretation: null,
      lastConfirmation: null,
      ensureSession: vi.fn(),
      interpret: vi.fn(),
      confirm: vi.fn(),
      getInsights: vi.fn(),
    }

    useAssistantMock.mockImplementation(() => assistantState)

    const { result } = renderHook(() => useAssistantTurn('web-test-device'))

    await waitFor(() => {
      expect(result.current.lastInterpretation?.command.id).toBe('cmd-persisted')
    })
  })

  it('orienta reconexão para comandos não suportados offline', async () => {
    const ensureSession = vi.fn().mockResolvedValue({ id: 'session-1' })
    const interpret = vi.fn().mockRejectedValue(new Error('Network request failed'))

    const assistantState = {
      loading: false,
      error: null,
      lastInterpretation: null as AssistantInterpretResult | null,
      lastConfirmation: null,
      ensureSession,
      interpret,
      confirm: vi.fn(),
      getInsights: vi.fn(),
    }

    useAssistantMock.mockImplementation(() => assistantState)

    const { result } = renderHook(() => useAssistantTurn('web-test-device'))

    await expect(result.current.interpretCommand('qual meu saldo?')).rejects.toThrow(
      'Sem internet: no modo offline só é possível cadastrar despesas, rendas e investimentos. Para consultas e edições, reconecte e tente novamente.',
    )
  })
})
