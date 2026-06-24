import { describe, it, expect } from 'vitest'
import {
  listAvailableCashBalances,
  planCashOffsetForPurchase,
  computeCashOffsetPreview,
  excludeCashOffsetSells,
  generateBatchCashOffsetTransactions,
  type CashOffsetTransaction,
} from '@/utils/cashBalanceApplication'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'

const cashDefinition = (ticker: string): PortfolioAssetDefinition => ({
  id: '1',
  portfolio_id: 'p1',
  ticker,
  pricing_mode: 'cash',
  is_b3_linked: false,
  applied_amount: null,
  contract_rate: null,
  indexer: 'none',
  indexer_percent: 100,
  maturity_date: null,
  manual_current_value: null,
  manual_value_updated_at: null,
  tax_exempt: false,
  is_treasury: false,
  application_date: null,
  created_at: '',
  updated_at: '',
})

describe('cashBalanceApplication', () => {
  it('lista saldo em caixa disponível', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: '1',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 3000,
        date: '2025-01-01',
        created_at: '',
      },
    ]

    const slots = listAvailableCashBalances(transactions, [cashDefinition('CAIXA')])
    expect(slots).toHaveLength(1)
    expect(slots[0].balance).toBe(3000)
  })

  it('lista saldo em caixa com base na definicao (sem transacao)', () => {
    const definitions: PortfolioAssetDefinition[] = [
      {
        ...cashDefinition('SALDO EM CAIXA'),
        applied_amount: 368.24,
      },
    ]

    const slots = listAvailableCashBalances([], definitions)
    expect(slots).toHaveLength(1)
    expect(slots[0].ticker).toBe('SALDO EM CAIXA')
    expect(slots[0].balance).toBe(368.24)
  })

  it('aplica caixa parcialmente na compra', () => {
    const plan = planCashOffsetForPurchase(5000, [
      { ticker: 'CAIXA', balance: 3000, quantity: 1, averageUnit: 3000 },
    ])

    expect(plan.cashUsed).toBe(3000)
    expect(plan.netContribution).toBe(2000)
    expect(plan.sellTransactions).toHaveLength(1)
    expect(plan.sellTransactions[0].ticker).toBe('CAIXA')
  })

  it('não aplica caixa em compra de saldo em caixa', () => {
    const preview = computeCashOffsetPreview(
      1000,
      'buy',
      'cash',
      [],
      [cashDefinition('CAIXA')]
    )

    expect(preview.cashUsed).toBe(0)
    expect(preview.netContribution).toBe(1000)
  })

  it('usa múltiplos tickers de caixa em ordem alfabética', () => {
    const plan = planCashOffsetForPurchase(5000, [
      { ticker: 'CAIXA', balance: 2000, quantity: 1, averageUnit: 2000 },
      { ticker: 'RESERVA', balance: 4000, quantity: 1, averageUnit: 4000 },
    ])

    expect(plan.cashUsed).toBe(5000)
    expect(plan.netContribution).toBe(0)
    expect(plan.sellTransactions).toHaveLength(2)
    expect(plan.sellTransactions[0].ticker).toBe('CAIXA')
    expect(plan.sellTransactions[1].ticker).toBe('RESERVA')
  })

  it('exclui vendas de caixa vinculadas ao editar compra', () => {
    const buyId = 'buy-1'
    const transactions: PortfolioTransaction[] = [
      {
        id: 'cash-buy',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 5000,
        date: '2025-01-01',
        created_at: '',
      },
      {
        id: 'auto-sell',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'sell',
        quantity: 1,
        price: 3000,
        date: '2025-02-01',
        created_at: '',
        cash_offset_source_id: buyId,
      },
    ]

    const cleaned = excludeCashOffsetSells(transactions, buyId)
    expect(cleaned).toHaveLength(1)
    expect(cleaned[0].id).toBe('cash-buy')

    const preview = computeCashOffsetPreview(
      4000,
      'buy',
      'market',
      cleaned,
      [cashDefinition('CAIXA')]
    )

    expect(preview.availableCash).toBe(5000)
    expect(preview.cashUsed).toBe(4000)
  })

  it('não consome caixa depositado no futuro', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 'cash-dep-future',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 5000,
        date: '2025-02-01',
        created_at: '',
      },
    ]

    const buyDate = '2025-01-01'
    const filteredTxs = transactions.filter((t) => t.date <= buyDate)
    expect(filteredTxs).toHaveLength(0)

    const preview = computeCashOffsetPreview(
      4000,
      'buy',
      'market',
      filteredTxs,
      [cashDefinition('CAIXA')]
    )

    expect(preview.availableCash).toBe(0)
    expect(preview.cashUsed).toBe(0)
    expect(preview.netContribution).toBe(4000)
  })
})

describe('generateBatchCashOffsetTransactions', () => {
  const portfolioId = 'portfolio-123'
  const sourceTransactionId = 'source-tx-1'
  const baseDefs: PortfolioAssetDefinition[] = [
    {
      id: 'def-1',
      portfolio_id: portfolioId,
      ticker: 'CAIXA',
      pricing_mode: 'cash',
      is_b3_linked: false,
      applied_amount: null,
      contract_rate: null,
      indexer: 'none',
      indexer_percent: 100,
      maturity_date: null,
      manual_current_value: null,
      manual_value_updated_at: null,
      tax_exempt: false,
      is_treasury: false,
      application_date: null,
      created_at: '',
      updated_at: '',
    },
  ]
  const baseTxs: PortfolioTransaction[] = [
    {
      id: 'cash-1',
      portfolio_id: portfolioId,
      ticker: 'CAIXA',
      operation_type: 'buy',
      quantity: 1,
      price: 5000,
      date: '2025-01-10',
      created_at: '',
    },
  ]

  it('gera vendas de caixa para compra com saldo disponível', () => {
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'buy',
      pricingMode: 'market',
      amount: 3000,
      date: '2025-02-01',
      localTransactions: baseTxs,
      localDefinitions: baseDefs,
    })

    expect(offsets).toHaveLength(1)
    expect(offsets[0].operation_type).toBe('sell')
    expect(offsets[0].ticker).toBe('CAIXA')
    expect(offsets[0].cash_offset_source_id).toBe(sourceTransactionId)
    expect(offsets[0].portfolio_id).toBe(portfolioId)
  })

  it('não gera offsets para compra sem saldo disponível', () => {
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'buy',
      pricingMode: 'market',
      amount: 3000,
      date: '2025-02-01',
      localTransactions: [],
      localDefinitions: [],
    })

    expect(offsets).toHaveLength(0)
  })

  it('não gera offsets para compra de ativo cash', () => {
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'buy',
      pricingMode: 'cash',
      amount: 3000,
      date: '2025-02-01',
      localTransactions: baseTxs,
      localDefinitions: baseDefs,
    })

    expect(offsets).toHaveLength(0)
  })

  it('gera entrada de caixa para venda', () => {
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'sell',
      pricingMode: 'market',
      amount: 5000,
      date: '2025-02-01',
      localTransactions: baseTxs,
      localDefinitions: baseDefs,
    })

    expect(offsets).toHaveLength(1)
    expect(offsets[0].operation_type).toBe('buy')
    expect(offsets[0].ticker).toBe('CAIXA')
    expect(offsets[0].price).toBe(5000)
  })

  it('gera entrada de caixa para proventos (dividendo)', () => {
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'dividend',
      pricingMode: 'market',
      amount: 150,
      date: '2025-02-01',
      localTransactions: baseTxs,
      localDefinitions: baseDefs,
    })

    expect(offsets).toHaveLength(1)
    expect(offsets[0].operation_type).toBe('buy')
    expect(offsets[0].price).toBe(150)
  })

  it('gera múltiplas vendas quando necessário (caixa distribuído em vários tickers)', () => {
    const multiCashDefs: PortfolioAssetDefinition[] = [
      { ...baseDefs[0], ticker: 'CAIXA' },
      {
        ...baseDefs[0],
        ticker: 'RESERVA',
        applied_amount: 3000,
      },
    ]
    const multiCashTxs: PortfolioTransaction[] = [
      {
        id: 'cash-1',
        portfolio_id: portfolioId,
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 5000,
        date: '2025-01-10',
        created_at: '',
      },
      {
        id: 'cash-2',
        portfolio_id: portfolioId,
        ticker: 'RESERVA',
        operation_type: 'buy',
        quantity: 1,
        price: 3000,
        date: '2025-01-15',
        created_at: '',
      },
    ]

    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'buy',
      pricingMode: 'market',
      amount: 7000,
      date: '2025-02-01',
      localTransactions: multiCashTxs,
      localDefinitions: multiCashDefs,
    })

    expect(offsets).toHaveLength(2)
    expect(offsets[0].ticker).toBe('CAIXA')
    expect(offsets[1].ticker).toBe('RESERVA')
    // Both should be sells
    expect(offsets.every(o => o.operation_type === 'sell')).toBe(true)
  })

  it('filtra caixa disponível apenas até a data da transação', () => {
    const laterCashTxs: PortfolioTransaction[] = [
      ...baseTxs,
      {
        id: 'cash-future',
        portfolio_id: portfolioId,
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 10000,
        date: '2025-03-01',
        created_at: '',
      },
    ]

    // Compra em fevereiro só deve consumir caixa de janeiro (5000), não o de março
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'buy',
      pricingMode: 'market',
      amount: 12000,
      date: '2025-02-15',
      localTransactions: laterCashTxs,
      localDefinitions: baseDefs,
    })

    // Only 5000 available, so offset should consume all 5000
    expect(offsets).toHaveLength(1)
    expect(offsets[0].price).toBeLessThanOrEqual(5000)
  })

  it('retorna array vazio para subscription com cash pricing', () => {
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'subscription',
      pricingMode: 'cash',
      amount: 1000,
      date: '2025-02-01',
      localTransactions: baseTxs,
      localDefinitions: baseDefs,
    })

    expect(offsets).toHaveLength(0)
  })

  it('gera entry de caixa para JCP', () => {
    const offsets = generateBatchCashOffsetTransactions({
      portfolioId,
      sourceTransactionId,
      operationType: 'jcp',
      pricingMode: 'market',
      amount: 200,
      date: '2025-02-01',
      localTransactions: baseTxs,
      localDefinitions: baseDefs,
    })

    expect(offsets).toHaveLength(1)
    expect(offsets[0].operation_type).toBe('buy')
    expect(offsets[0].price).toBe(200)
  })
})
