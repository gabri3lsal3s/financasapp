import { beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  expenseInsertCalls: [] as Array<Array<Record<string, unknown>>>,
  assistantCommandUpdates: [] as Array<Record<string, unknown>>,
  confirmationInsertCalls: [] as Array<Array<Record<string, unknown>>>,
  currentCommand: {} as Record<string, unknown>,
}))

const supabaseMock = vi.hoisted(() => ({
  from: (table: string) => {
    if (table === 'assistant_commands') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: testState.currentCommand, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            testState.assistantCommandUpdates.push(payload)
            return { data: null, error: null }
          },
        }),
      }
    }

    if (table === 'assistant_confirmations') {
      return {
        insert: async (payload: Array<Record<string, unknown>>) => {
          testState.confirmationInsertCalls.push(payload)
          return { data: null, error: null }
        },
      }
    }

    if (table === 'credit_cards') {
      return {
        select: () => ({
          order: async () => ({
            data: [{ id: 'card-1', name: 'Nubank', closing_day: 8, is_active: true }],
            error: null,
          }),
        }),
      }
    }

    if (table === 'categories') {
      return {
        select: () => ({
          order: async () => ({
            data: [{ id: 'cat-1', name: 'Sem categoria', color: '#000000' }],
            error: null,
          }),
        }),
      }
    }

    if (table === 'credit_card_monthly_cycles') {
      return {
        select: () => ({
          in: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        }),
      }
    }

    if (table === 'expenses') {
      return {
        insert: (payload: Array<Record<string, unknown>>) => {
          testState.expenseInsertCalls.push(payload)
          return {
            select: async () => ({
              data: payload.map((_, index) => ({ id: `exp-${index + 1}` })),
              error: null,
            }),
          }
        },
      }
    }

    if (table === 'assistant_category_mappings') {
      return {
        insert: async () => ({ data: null, error: null }),
      }
    }

    throw new Error(`Tabela não mockada no teste: ${table}`)
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}))

vi.mock('@/utils/offlineQueue', () => ({
  enqueueOfflineOperation: vi.fn(),
  shouldQueueOffline: vi.fn(() => false),
}))

import { confirmAssistantCommand } from '@/services/assistantService'

describe('confirmAssistantCommand - cartões de crédito', () => {
  beforeEach(() => {
    testState.expenseInsertCalls.length = 0
    testState.assistantCommandUpdates.length = 0
    testState.confirmationInsertCalls.length = 0

    testState.currentCommand = {
      id: 'cmd-1',
      session_id: 'session-1',
      user_id: 'user-1',
      command_text: 'despesa de 120 no cartão nubank',
      interpreted_intent: 'add_expense',
      slots_json: {
        transactionType: 'expense',
        amount: 120,
        date: '2026-03-10',
      },
      category_resolution_json: null,
      requires_confirmation: true,
      status: 'pending_confirmation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  })

  it('aplica editedSlots com cartão e persiste lançamento parcelado', async () => {
    const result = await confirmAssistantCommand({
      commandId: 'cmd-1',
      confirmed: true,
      confirmationMethod: 'touch',
      editedSlots: {
        transactionType: 'expense',
        amount: 240,
        installment_count: 2,
        payment_method: 'credit_card',
        credit_card_id: 'card-1',
        credit_card_name: 'Nubank',
        date: '2026-03-10',
      },
    })

    expect(result.status).toBe('executed')
    expect(testState.confirmationInsertCalls).toHaveLength(1)

    const slotsUpdate = testState.assistantCommandUpdates.find((payload) => 'slots_json' in payload)
    expect(slotsUpdate).toBeDefined()
    expect((slotsUpdate?.slots_json as Record<string, unknown>)?.payment_method).toBe('credit_card')
    expect((slotsUpdate?.slots_json as Record<string, unknown>)?.credit_card_id).toBe('card-1')

    expect(testState.expenseInsertCalls).toHaveLength(1)
    expect(testState.expenseInsertCalls[0]).toHaveLength(2)
    expect(testState.expenseInsertCalls[0][0]?.payment_method).toBe('credit_card')
    expect(testState.expenseInsertCalls[0][0]?.credit_card_id).toBe('card-1')
    expect(testState.expenseInsertCalls[0][0]?.installment_total).toBe(2)
    expect(testState.expenseInsertCalls[0][1]?.installment_total).toBe(2)
  })

  it('executa despesa no cartão por nome, à vista e parcelada, com competência de fatura', async () => {
    testState.currentCommand = {
      ...testState.currentCommand,
      id: 'cmd-2',
      command_text: 'despesa no cartão nubank',
      slots_json: {
        items: [
          {
            transactionType: 'expense',
            amount: 100,
            payment_method: 'credit_card',
            credit_card_name: 'Nubank',
            date: '2026-03-10',
          },
          {
            transactionType: 'expense',
            amount: 300,
            installment_count: 3,
            payment_method: 'credit_card',
            credit_card_name: 'Nubank',
            date: '2026-03-07',
          },
        ],
      },
    }

    const result = await confirmAssistantCommand({
      commandId: 'cmd-2',
      confirmed: true,
      confirmationMethod: 'touch',
    })

    expect(result.status).toBe('executed')
  expect(testState.expenseInsertCalls).toHaveLength(1)
  expect(testState.expenseInsertCalls[0]).toHaveLength(4)

  const [avista, parcela1, parcela2, parcela3] = testState.expenseInsertCalls[0]

    expect(avista?.credit_card_id).toBe('card-1')
    expect(avista?.payment_method).toBe('credit_card')
    expect(avista?.bill_competence).toBe('2026-04')

    expect(parcela1?.installment_number).toBe(1)
    expect(parcela1?.installment_total).toBe(3)
    expect(parcela1?.bill_competence).toBe('2026-03')

    expect(parcela2?.installment_number).toBe(2)
    expect(parcela2?.bill_competence).toBe('2026-04')

    expect(parcela3?.installment_number).toBe(3)
    expect(parcela3?.bill_competence).toBe('2026-05')
  })
})
