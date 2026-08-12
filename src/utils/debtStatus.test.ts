import { describe, expect, it } from 'vitest'
import { getDebtDueStatus, DEBT_DUE_STATUS_LABEL } from '@/utils/debtStatus'

const baseDebt = { status: 'pending' as const, due_date: '2026-08-15' }
const today = new Date(2026, 7, 15) // 15/08/2026

describe('getDebtDueStatus', () => {
  it('retorna paid para dívida quitada', () => {
    expect(getDebtDueStatus({ ...baseDebt, status: 'paid' }, today)).toBe('paid')
  })

  it('retorna overdue quando o vencimento já passou', () => {
    expect(getDebtDueStatus({ ...baseDebt, due_date: '2026-08-14' }, today)).toBe('overdue')
  })

  it('retorna due_today quando vence hoje', () => {
    expect(getDebtDueStatus(baseDebt, today)).toBe('due_today')
  })

  it('retorna due_soon para vencimento em até 3 dias', () => {
    expect(getDebtDueStatus({ ...baseDebt, due_date: '2026-08-18' }, today)).toBe('due_soon')
  })

  it('retorna pending para vencimento além da janela', () => {
    expect(getDebtDueStatus({ ...baseDebt, due_date: '2026-08-19' }, today)).toBe('pending')
  })

  it('trata data inválida como pending', () => {
    expect(getDebtDueStatus({ ...baseDebt, due_date: 'invalida' }, today)).toBe('pending')
  })
})

describe('DEBT_DUE_STATUS_LABEL', () => {
  it('expõe os rótulos de todos os status', () => {
    expect(DEBT_DUE_STATUS_LABEL).toMatchObject({
      paid: 'Quitada',
      overdue: 'Atrasada',
      due_today: 'Vence Hoje',
      due_soon: 'Vence em Breve',
      pending: 'A Vencer',
    })
  })
})
