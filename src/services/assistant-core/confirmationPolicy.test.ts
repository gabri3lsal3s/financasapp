import { describe, expect, it } from 'vitest'
import { resolveConfirmationPolicy } from '@/services/assistant-core/confirmationPolicy'

describe('assistant confirmation policy', () => {
  it('exige confirmação para intents de escrita no modo write_only', () => {
    const result = resolveConfirmationPolicy({ intent: 'add_expense', mode: 'write_only' })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.reason).toBe('write_intent')
    expect(result.risk).toBe('medium')
  })

  it('não exige confirmação para intent read-only no modo write_only', () => {
    const result = resolveConfirmationPolicy({ intent: 'monthly_insights', mode: 'write_only' })

    expect(result.requiresConfirmation).toBe(false)
    expect(result.reason).toBe('read_only')
    expect(result.risk).toBe('low')
  })

  it('respeita modo always', () => {
    const result = resolveConfirmationPolicy({ intent: 'monthly_insights', mode: 'always' })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.reason).toBe('mode_always')
  })

  it('respeita modo never', () => {
    const result = resolveConfirmationPolicy({ intent: 'add_income', mode: 'never' })

    expect(result.requiresConfirmation).toBe(false)
    expect(result.reason).toBe('mode_never')
    expect(result.risk).toBe('medium')
  })

  it('mantém confirmação para ações críticas mesmo no modo never', () => {
    const result = resolveConfirmationPolicy({ intent: 'delete_transaction', mode: 'never' })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.reason).toBe('sensitive_intent')
    expect(result.risk).toBe('critical')
  })

  it('mantém confirmação quando há desambiguação de categoria pendente', () => {
    const result = resolveConfirmationPolicy({
      intent: 'add_expense',
      mode: 'never',
      needsCategoryDisambiguation: true,
    })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.reason).toBe('disambiguation_required')
    expect(result.risk).toBe('critical')
  })

  it('classifica como risco alto para valor elevado', () => {
    const result = resolveConfirmationPolicy({
      intent: 'add_expense',
      mode: 'write_only',
      slots: { amount: 1500 },
    })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.reason).toBe('high_value')
    expect(result.risk).toBe('high')
  })

  it('força confirmação independente do modo', () => {
    const result = resolveConfirmationPolicy({
      intent: 'monthly_insights',
      mode: 'never',
      forceConfirmation: true,
    })

    expect(result.requiresConfirmation).toBe(true)
    expect(result.reason).toBe('forced')
  })
})
