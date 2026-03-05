/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  parseCreditCardInvoiceCsv,
  reconcileCreditCardBill,
} from '@/utils/creditCardCsvReconciliation'

describe('creditCardCsvReconciliation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('rejeita CSV fora do contexto de fatura de cartão', () => {
    const csv = [
      'Data;Descrição;Valor',
      '05/03/2026;Receita recorrente;1200,00',
      '06/03/2026;Transferência empresa;800,00',
    ].join('\n')

    const result = parseCreditCardInvoiceCsv(csv, 'auto')

    expect(result.supported).toBe(false)
    expect(result.reason).toContain('contexto de fatura')
  })

  it('identifica compras parceladas e número da parcela', () => {
    const csv = [
      'Data;Descrição;Valor',
      '05/03/2026;Compra Loja X Parcela 3/10;199,90',
      '10/03/2026;Mercado bairro;89,20',
    ].join('\n')

    const result = parseCreditCardInvoiceCsv(csv, 'generic')

    expect(result.supported).toBe(true)
    expect(result.items[0]?.installmentNumber).toBe(3)
    expect(result.items[0]?.installmentTotal).toBe(10)
  })

  it('sugere conflito com atualização quando valor/descritivo divergem', () => {
    const csv = [
      'Data;Descrição;Valor',
      '05/03/2026;Compra Loja X Parcela 3/10;199,90',
      '10/03/2026;Mercado bairro;89,20',
    ].join('\n')

    const parsed = parseCreditCardInvoiceCsv(csv, 'generic')
    if (!parsed.supported) throw new Error('CSV deveria ser suportado no teste')

    const reconciliation = reconcileCreditCardBill(parsed.items, [
      {
        id: 'exp-1',
        credit_card_id: 'card-1',
        amount: 199.8,
        base_amount: 199.8,
        date: '2026-03-05',
        description: 'Loja X',
      },
      {
        id: 'exp-2',
        credit_card_id: 'card-1',
        amount: 89.2,
        base_amount: 89.2,
        date: '2026-03-10',
        description: 'Mercado bairro',
      },
    ])

    expect(reconciliation.conflicts).toHaveLength(1)
    expect(reconciliation.conflicts[0]?.suggestedUpdate.needsUpdate).toBe(true)
    expect(reconciliation.conflicts[0]?.suggestedUpdate.installmentLabel).toBe('3/10')
  })

  it('considera incluída automaticamente quando data e valor batem, mesmo com descrição diferente', () => {
    const csv = [
      'Data;Descrição;Valor',
      '05/03/2026;Mercado Central Parcela 1/3;120,00',
    ].join('\n')

    const parsed = parseCreditCardInvoiceCsv(csv, 'generic')
    if (!parsed.supported) throw new Error('CSV deveria ser suportado no teste')

    const reconciliation = reconcileCreditCardBill(parsed.items, [
      {
        id: 'exp-10',
        credit_card_id: 'card-1',
        amount: 120,
        base_amount: 120,
        date: '2026-03-05',
        description: 'LANÇAMENTO CARTÃO 001',
      },
    ])

    expect(reconciliation.matched).toHaveLength(1)
    expect(reconciliation.conflicts).toHaveLength(0)
    expect(reconciliation.missing).toHaveLength(0)
  })

  it('ignora linhas de pagamento de fatura no CSV oficial', () => {
    const csv = [
      'Data;Descrição;Valor',
      '15/02/2026;Pagamento de fatura; -1612,73',
      '16/02/2026;Compra mercado;89,90',
    ].join('\n')

    const parsed = parseCreditCardInvoiceCsv(csv, 'auto')

    expect(parsed.supported).toBe(true)
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]?.description).toContain('Compra mercado')
  })

  it('ignora pagamento de fatura mesmo com coluna adicional e formato monetário brasileiro', () => {
    const csv = [
      'Data;Descrição;Favorecido;Valor',
      '15/02/2026;Pagamento de fatura;GABRIEL I S SALES;-R$1.612,73',
      '16/02/2026;SUPERMERCADO ALFA;LOJA 01;R$ 212,45',
    ].join('\n')

    const parsed = parseCreditCardInvoiceCsv(csv, 'auto')

    expect(parsed.supported).toBe(true)
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]?.amount).toBe(212.45)
  })

  it('especifica estornos no resultado parseado', () => {
    const csv = [
      'Data;Descrição;Valor',
      '20/02/2026;Estorno compra loja X;-49,90',
    ].join('\n')

    const parsed = parseCreditCardInvoiceCsv(csv, 'auto')

    expect(parsed.supported).toBe(true)
    expect(parsed.items[0]?.isRefund).toBe(true)
    expect(parsed.items[0]?.kind).toBe('refund')
  })

  it('aceita fatura com descrições de estabelecimento sem palavras explícitas de fatura', () => {
    const csv = [
      'Data;Descrição;Valor',
      '01/03/2026;POSTO AVENIDA LTDA;120,45',
      '02/03/2026;FARMACIA CENTRO 247;89,90',
      '03/03/2026;PADARIA SAO JOAO;23,10',
    ].join('\n')

    const parsed = parseCreditCardInvoiceCsv(csv, 'auto')

    expect(parsed.supported).toBe(true)
    expect(parsed.items).toHaveLength(3)
  })

  it('deduplica linhas repetidas no arquivo oficial', () => {
    const csv = [
      'Data;Descrição;Valor',
      '03/03/2026;PADARIA SAO JOAO;23,10',
      '03/03/2026;PADARIA SAO JOAO;23,10',
      '04/03/2026;FARMACIA CENTRAL;57,40',
    ].join('\n')

    const parsed = parseCreditCardInvoiceCsv(csv, 'auto')

    expect(parsed.supported).toBe(true)
    expect(parsed.items).toHaveLength(2)
  })

  it('mantém total líquido esperado para a fatura exemplo (ignora pagamento e considera estorno)', () => {
    const filePath = join(process.cwd(), 'Fatura2026-03-15.csv')
    const csv = readFileSync(filePath, 'utf-8')

    const parsed = parseCreditCardInvoiceCsv(csv, 'auto')

    expect(parsed.supported).toBe(true)

    const hasPaymentLine = parsed.items.some((item) => /pagamento de fatura/i.test(item.description))
    expect(hasPaymentLine).toBe(false)

    const total = parsed.items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    expect(Number(total.toFixed(2))).toBe(2240.36)
  })
})
