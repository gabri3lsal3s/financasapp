import { describe, expect, it } from 'vitest'
import {
  resolveExpenseBillCompetence,
  resolveBillCompetence,
  splitAmountIntoInstallments,
  summarizeCreditCardBill,
} from '@/utils/creditCardBilling'

describe('creditCardBilling', () => {
  it('envia para a próxima competência quando compra ocorre no dia de fechamento', () => {
    const competence = resolveBillCompetence('2026-03-10', 10)
    expect(competence).toBe('2026-04')
  })

  it('mantém na competência atual quando compra ocorre antes do fechamento', () => {
    const competence = resolveBillCompetence('2026-03-09', 10)
    expect(competence).toBe('2026-03')
  })

  it('divide valor em parcelas preservando soma em centavos', () => {
    const installments = splitAmountIntoInstallments(100, 3)

    expect(installments).toEqual([33.34, 33.33, 33.33])
    const total = installments.reduce((sum, value) => sum + value, 0)
    expect(Number(total.toFixed(2))).toBe(100)
  })

  it('consolida totais e itens por cartão para fatura', () => {
    const summary = summarizeCreditCardBill(
      [
        {
          id: 'e-1',
          credit_card_id: 'card-1',
          amount: 200,
          date: '2026-03-10',
          description: 'Mercado',
          installment_number: 1,
          installment_total: 2,
        },
        {
          id: 'e-2',
          credit_card_id: 'card-1',
          amount: -20,
          date: '2026-03-12',
          description: 'Estorno',
        },
        {
          id: 'e-3',
          credit_card_id: 'card-2',
          amount: 50,
          date: '2026-03-05',
          description: 'Assinatura',
        },
      ],
      [
        { credit_card_id: 'card-1', amount: 60 },
        { credit_card_id: 'card-2', amount: 10 },
      ],
    )

    expect(summary.expensesByCard['card-1']).toBe(180)
    expect(summary.expensesByCard['card-2']).toBe(50)
    expect(summary.paymentsByCard['card-1']).toBe(60)
    expect(summary.paymentsByCard['card-2']).toBe(10)

    expect(summary.billItemsByCard['card-1']).toHaveLength(2)
    expect(summary.billItemsByCard['card-1'][0]?.date).toBe('2026-03-12')
    expect(summary.billItemsByCard['card-1'][1]?.date).toBe('2026-03-10')
  })

  it('usa bill_competence persistida quando disponível', () => {
    const competence = resolveExpenseBillCompetence(
      {
        credit_card_id: 'card-1',
        date: '2026-03-10',
        bill_competence: '2026-05',
      },
      () => 8,
    )

    expect(competence).toBe('2026-05')
  })

  it('calcula competência pela data de fechamento quando bill_competence estiver nula', () => {
    const competence = resolveExpenseBillCompetence(
      {
        credit_card_id: 'card-1',
        date: '2026-03-10',
        bill_competence: null,
      },
      () => 8,
    )

    expect(competence).toBe('2026-04')
  })

  it('respeita fechamento mensal customizado por competência do lançamento', () => {
    const competence = resolveExpenseBillCompetence(
      {
        credit_card_id: 'card-1',
        date: '2026-03-10',
        bill_competence: null,
      },
      (_cardId, month) => (month === '2026-03' ? 15 : 8),
    )

    expect(competence).toBe('2026-03')
  })
})
