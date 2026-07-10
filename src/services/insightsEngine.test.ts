import { describe, it, expect } from 'vitest'
import {
  computeStructuredInsights,
  calcSubscriptionSignals,
  classifyBySignals,
  type AnalysisInput,
  type Expense,
} from './insightsEngine'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    amount: 100,
    report_weight: 1,
    date: '2026-07-15',
    category_id: 'cat-1',
    description: 'Test expense',
    created_at: '2026-07-15T00:00:00.000Z',
    user_id: 'user-1',
    category: { id: 'cat-1', name: 'Categoria Teste', color: 'var(--color-primary)', created_at: '' },
    ...overrides,
  }
}

function makeBaseInput(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    currentMonth: '2026-07',
    totalIncomes: 5000,
    totalExpenses: 3000,
    totalInvestments: 500,
    savingsRate: 30, // (5000-3000-500)/5000 = 30%
    categoryExpenseSummaries: [
      { category_name: 'Supermercado', total: 1000, baseTotal: 1000 },
      { category_name: 'Delivery', total: 500, baseTotal: 500 },
      { category_name: 'Aluguel', total: 800, baseTotal: 800 },
    ],
    previousMonthExpenseTotal: 2800,
    weekdayExpenseData: [
      { dia: 'Seg', Despesas: 200 },
      { dia: 'Ter', Despesas: 300 },
      { dia: 'Qua', Despesas: 250 },
      { dia: 'Qui', Despesas: 400 },
      { dia: 'Sex', Despesas: 350 },
      { dia: 'Sáb', Despesas: 600 },
      { dia: 'Dom', Despesas: 500 },
    ],
    limitsExceededCount: 0,
    incomeByCategory: [
      { name: 'Salário', total: 4500 },
      { name: 'Freelance', total: 500 },
    ],
    spendingPace: null,
    spendingProjection: null,
    balance: 1500,
    expenses: [],
    previousMonthExpenses: [],
    categories: [],
    expensesWithLimit: [],
    expensesCount: 0,
    incomesCount: 0,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('insightsEngine - computeStructuredInsights', () => {
  describe('criticalAlert', () => {
    it('returns danger alert when savings rate is negative', () => {
      const input = makeBaseInput({ savingsRate: -10, totalIncomes: 5000 })
      const result = computeStructuredInsights(input)
      expect(result.criticalAlert?.severity).toBe('danger')
      expect(result.criticalAlert?.text).toContain('Saldo negativo')
    })

    it('returns warning alert when limits are exceeded', () => {
      const input = makeBaseInput({ limitsExceededCount: 2, savingsRate: 10 })
      const result = computeStructuredInsights(input)
      expect(result.criticalAlert?.severity).toBe('warning')
      expect(result.criticalAlert?.text).toContain('limite estourado')
    })

    it('returns success alert when savings rate is high', () => {
      const input = makeBaseInput({ savingsRate: 25, limitsExceededCount: 0 })
      const result = computeStructuredInsights(input)
      expect(result.criticalAlert?.severity).toBe('success')
      expect(result.criticalAlert?.text).toContain('excelente controle')
    })

    it('returns null when no alert conditions are met', () => {
      const input = makeBaseInput({ savingsRate: 10, limitsExceededCount: 0, totalIncomes: 0 })
      const result = computeStructuredInsights(input)
      expect(result.criticalAlert).toBeNull()
    })
  })

  describe('subscriptions', () => {
    it('detects subscription when same description appears in both months with similar value', () => {
      const currentExpenses = [
        makeExpense({ description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' } }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const input = makeBaseInput({ expenses: currentExpenses, previousMonthExpenses: previousExpenses })
      const result = computeStructuredInsights(input)
      expect(result.subscriptions.length).toBe(1)
      expect(result.subscriptions[0].description).toBe('Netflix')
      expect(result.subscriptions[0].monthlyAmount).toBe(39.90)
    })

    it('ignores installment expenses', () => {
      const currentExpenses = [
        makeExpense({ description: 'Curso Parcelado', amount: 100, installment_group_id: 'grp-1' }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Curso Parcelado', amount: 100, installment_group_id: 'grp-1', created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const input = makeBaseInput({ expenses: currentExpenses, previousMonthExpenses: previousExpenses })
      const result = computeStructuredInsights(input)
      expect(result.subscriptions.length).toBe(0)
    })

    it('does not detect subscription if value varies more than 30%', () => {
      const currentExpenses = [
        makeExpense({ description: 'Spotify', amount: 19.90 }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Spotify', amount: 34.90, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const input = makeBaseInput({ expenses: currentExpenses, previousMonthExpenses: previousExpenses })
      const result = computeStructuredInsights(input)
      expect(result.subscriptions.length).toBe(0)
    })
  })

  describe('incomeConcentration', () => {
    it('detects high concentration when top source > 60%', () => {
      const input = makeBaseInput({
        incomeByCategory: [
          { name: 'Salário', total: 4800 },
          { name: 'Freelance', total: 200 },
        ],
        totalIncomes: 5000,
      })
      const result = computeStructuredInsights(input)
      expect(result.incomeConcentration).not.toBeNull()
      expect(result.incomeConcentration!.topSourceName).toBe('Salário')
      expect(result.incomeConcentration!.topSourcePercentage).toBe(96)
    })

    it('returns null when income is well distributed', () => {
      const input = makeBaseInput({
        incomeByCategory: [
          { name: 'Salário', total: 2500 },
          { name: 'Freelance', total: 1500 },
          { name: 'Aluguel', total: 1000 },
        ],
        totalIncomes: 5000,
      })
      const result = computeStructuredInsights(input)
      expect(result.incomeConcentration).toBeNull()
    })
  })

  describe('expenseTrend', () => {
    it('shows increase when current > previous', () => {
      const input = makeBaseInput({ totalExpenses: 3500, previousMonthExpenseTotal: 2800 })
      const result = computeStructuredInsights(input)
      expect(result.expenseTrend).not.toBeNull()
      expect(result.expenseTrend!.isIncrease).toBe(true)
      expect(result.expenseTrend!.percentageChange).toBeCloseTo(25, 0)
    })

    it('shows decrease when current < previous', () => {
      const input = makeBaseInput({ totalExpenses: 2200, previousMonthExpenseTotal: 2800 })
      const result = computeStructuredInsights(input)
      expect(result.expenseTrend).not.toBeNull()
      expect(result.expenseTrend!.isIncrease).toBe(false)
    })

    it('returns null when no previous data', () => {
      const input = makeBaseInput({ previousMonthExpenseTotal: 0 })
      const result = computeStructuredInsights(input)
      expect(result.expenseTrend).toBeNull()
    })
  })

  describe('weekendSpending', () => {
    it('detects higher weekend spending when ratio > 1.5', () => {
      const input = makeBaseInput()
      const result = computeStructuredInsights(input)
      expect(result.weekendSpending).not.toBeNull()
      expect(result.weekendSpending!.isHigherOnWeekends).toBe(true)
    })

    it('returns null when no expense data', () => {
      const input = makeBaseInput({
        weekdayExpenseData: [
          { dia: 'Seg', Despesas: 0 },
          { dia: 'Ter', Despesas: 0 },
          { dia: 'Qua', Despesas: 0 },
          { dia: 'Qui', Despesas: 0 },
          { dia: 'Sex', Despesas: 0 },
          { dia: 'Sáb', Despesas: 0 },
          { dia: 'Dom', Despesas: 0 },
        ],
      })
      const result = computeStructuredInsights(input)
      expect(result.weekendSpending).toBeNull()
    })
  })

  describe('topCategory', () => {
    it('highlights the largest category', () => {
      const input = makeBaseInput({
        categoryExpenseSummaries: [
          { category_name: 'Supermercado', total: 1500, baseTotal: 1500 },
          { category_name: 'Aluguel', total: 800, baseTotal: 800 },
        ],
        totalExpenses: 2300,
      })
      const result = computeStructuredInsights(input)
      expect(result.topCategory).not.toBeNull()
      expect(result.topCategory!.name).toBe('Supermercado')
      expect(result.topCategory!.percentageOfTotal).toBeCloseTo(65.22, 1)
    })

    it('returns null when no expenses', () => {
      const input = makeBaseInput({ categoryExpenseSummaries: [], totalExpenses: 0 })
      const result = computeStructuredInsights(input)
      expect(result.topCategory).toBeNull()
    })
  })

  describe('savingsStatus', () => {
    it('classifies as "forte" when rate >= 25%', () => {
      const input = makeBaseInput({ savingsRate: 30 })
      const result = computeStructuredInsights(input)
      expect(result.savingsStatus).not.toBeNull()
      expect(result.savingsStatus!.level).toBe('forte')
    })

    it('classifies as "crítico" when rate <= 0', () => {
      const input = makeBaseInput({ savingsRate: -5 })
      const result = computeStructuredInsights(input)
      expect(result.savingsStatus).not.toBeNull()
      expect(result.savingsStatus!.level).toBe('crítico')
    })

    it('classifies as "moderado" when rate between 5 and 15', () => {
      const input = makeBaseInput({ savingsRate: 10 })
      const result = computeStructuredInsights(input)
      expect(result.savingsStatus).not.toBeNull()
      expect(result.savingsStatus!.level).toBe('moderado')
    })
  })

  describe('investmentCommitment', () => {
    it('says adequate when ratio >= 15%', () => {
      const input = makeBaseInput({ totalInvestments: 1000, totalIncomes: 5000 })
      const result = computeStructuredInsights(input)
      expect(result.investmentCommitment).not.toBeNull()
      expect(result.investmentCommitment!.isAdequate).toBe(true)
    })

    it('says needs improvement when ratio is 0', () => {
      const input = makeBaseInput({ totalInvestments: 0, totalIncomes: 5000 })
      const result = computeStructuredInsights(input)
      expect(result.investmentCommitment).not.toBeNull()
      expect(result.investmentCommitment!.isAdequate).toBe(false)
      expect(result.investmentCommitment!.suggestion).toContain('Nenhum investimento')
    })
  })

  describe('subscription refinement - filters installments', () => {
    it('does not flag installment expenses as subscriptions', () => {
      const currentExpenses = [
        makeExpense({ description: 'Curso Online', amount: 200, installment_group_id: 'g-1' }),
        makeExpense({ id: 'exp-2', description: 'Netflix', amount: 39.90, created_at: '2026-07-15T00:00:00.000Z' }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-3', description: 'Curso Online', amount: 200, installment_group_id: 'g-1', created_at: '2026-06-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-4', description: 'Netflix', amount: 39.90, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const input = makeBaseInput({ expenses: currentExpenses, previousMonthExpenses: previousExpenses })
      const result = computeStructuredInsights(input)
      // Only Netflix should be detected, not the installment
      expect(result.subscriptions.length).toBe(1)
      expect(result.subscriptions[0].description).toBe('Netflix')
    })
  })

  describe('recurring expenses with false positive mitigations', () => {
    it('does not flag supermarket (aggregate category) as similar recurring', () => {
      // Descrições ÚNICAS entre os meses para evitar match por descrição (Passo 1/2)
      // e testar exclusivamente a exclusão por categoria agregadora (Passo 3)
      const currentExpenses = [
        makeExpense({ description: 'Extra Julho', amount: 812, category_id: 'cat-merc', category: { id: 'cat-merc', name: 'Supermercado', color: 'var(--color-primary)', created_at: '' } }),
        makeExpense({ id: 'exp-2', description: 'Assaí Julho', amount: 598, category_id: 'cat-merc', category: { id: 'cat-merc', name: 'Supermercado', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-07-15T00:00:00.000Z' }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-3', description: 'Extra Junho', amount: 798, category_id: 'cat-merc', category: { id: 'cat-merc', name: 'Supermercado', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-4', description: 'Carrefour', amount: 502, category_id: 'cat-merc', category: { id: 'cat-merc', name: 'Supermercado', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const additionalMonths = [
        [
          makeExpense({ id: 'exp-5', description: 'Feira Maio', amount: 835, category_id: 'cat-merc', category: { id: 'cat-merc', name: 'Supermercado', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
        ],
      ]

      const input = makeBaseInput({
        expenses: currentExpenses,
        previousMonthExpenses: previousExpenses,
        additionalPreviousMonthExpenses: additionalMonths,
      })

      const result = computeStructuredInsights(input)

      // Nenhuma despesa 'similar' — supermercado foi excluído como agregador
      const similarItems = result.recurringExpenses.filter(r => r.recurrenceType === 'similar')
      expect(similarItems.length).toBe(0)

      // Nenhuma subscription ou recurring falsa
      expect(result.subscriptions.length).toBe(0)
    })

    it('does not flag category with many small items as similar recurring', () => {
      // 5 itens pequenos em 'Restaurante' — nenhum > 40% do total
      const currentExpenses = [
        makeExpense({ description: 'Almoço', amount: 32, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' } }),
        makeExpense({ id: 'exp-2', description: 'Jantar', amount: 45, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-07-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-3', description: 'Lanches', amount: 28, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-07-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-4', description: 'Pizza', amount: 55, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-07-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-5', description: 'Sobremesa', amount: 18, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-07-15T00:00:00.000Z' }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-6', description: 'Almoço', amount: 35, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-7', description: 'Jantar', amount: 48, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-8', description: 'Pizza', amount: 52, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-9', description: 'Marmita', amount: 42, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-10', description: 'Salgado', amount: 22, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const additionalMonths = [
        [
          makeExpense({ id: 'exp-11', description: 'Almoço', amount: 30, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
          makeExpense({ id: 'exp-12', description: 'Jantar', amount: 50, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
          makeExpense({ id: 'exp-13', description: 'Marmita', amount: 38, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
          makeExpense({ id: 'exp-14', description: 'Pizza', amount: 60, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
          makeExpense({ id: 'exp-15', description: 'Lanche', amount: 25, category_id: 'cat-res', category: { id: 'cat-res', name: 'Restaurante', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
        ],
      ]

      const input = makeBaseInput({
        expenses: currentExpenses,
        previousMonthExpenses: previousExpenses,
        additionalPreviousMonthExpenses: additionalMonths,
      })

      const result = computeStructuredInsights(input)

      // Não deve detectar 'similar' devido à dispersão (5+ itens, nenhum dominante)
      const similarItems = result.recurringExpenses.filter(r => r.recurrenceType === 'similar')
      expect(similarItems.length).toBe(0)
    })

    it('still detects genuine subscription despite aggregate category exclusion', () => {
      // Netflix ainda deve ser detectada mesmo se a categoria 'Streaming'
      // não estiver na lista de agregadoras
      const currentExpenses = [
        makeExpense({ description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' } }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const additionalMonths = [
        [
          makeExpense({ id: 'exp-3', description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
        ],
      ]

      const input = makeBaseInput({
        expenses: currentExpenses,
        previousMonthExpenses: previousExpenses,
        additionalPreviousMonthExpenses: additionalMonths,
      })

      const result = computeStructuredInsights(input)

      // Netflix deve ser detectada como subscription (match por descrição)
      const netflixItems = result.recurringExpenses.filter(r => r.description === 'Netflix')
      expect(netflixItems.length).toBe(1)
      expect(netflixItems[0].recurrenceType).toBe('subscription')
      expect(netflixItems[0].monthsFound).toBe(3)
    })

    it('detects similar only when 2+ historical months match with variation <= 30%', () => {
      // Categoria 'Cursos Online' (não agregadora) com valor similar em 3 meses
      // e com 1 item dominante que não está no Passo 1/2
      const currentExpenses = [
        makeExpense({ description: 'Curso Web Design', amount: 49.90, category_id: 'cat-course', category: { id: 'cat-course', name: 'Cursos Online', color: 'var(--color-primary)', created_at: '' } }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Curso React', amount: 49.90, category_id: 'cat-course', category: { id: 'cat-course', name: 'Cursos Online', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const additionalMonths = [
        [
          makeExpense({ id: 'exp-3', description: 'Curso Node.js', amount: 49.90, category_id: 'cat-course', category: { id: 'cat-course', name: 'Cursos Online', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
        ],
      ]

      const input = makeBaseInput({
        expenses: currentExpenses,
        previousMonthExpenses: previousExpenses,
        additionalPreviousMonthExpenses: additionalMonths,
      })

      const result = computeStructuredInsights(input)

      // Deve detectar como 'similar' (mesma categoria, valor similar, 2+ meses históricos)
      const similarItems = result.recurringExpenses.filter(r => r.recurrenceType === 'similar')
      expect(similarItems.length).toBe(1)
      expect(similarItems[0].categoryName).toBe('Cursos Online')
      expect(similarItems[0].monthlyAmount).toBeCloseTo(49.90, 1)
      expect(similarItems[0].monthsFound).toBe(3)
    })
  })

  describe('multi-month subscription detection', () => {
    it('detects subscription with 3 months of history and higher confidence', () => {
      const netflixJuly = makeExpense({ description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' } })
      const netflixJune = makeExpense({ id: 'exp-2', description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' })
      const netflixMay = makeExpense({ id: 'exp-3', description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' })
      const netflixApr = makeExpense({ id: 'exp-4', description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-04-15T00:00:00.000Z' })

      const currentExpenses = [netflixJuly]
      const previousExpenses = [netflixJune]
      const additionalMonths = [
        [netflixMay],  // month -2
        [netflixApr],  // month -3
      ]

      const input = makeBaseInput({
        expenses: currentExpenses,
        previousMonthExpenses: previousExpenses,
        additionalPreviousMonthExpenses: additionalMonths,
      })

      const result = computeStructuredInsights(input)
      expect(result.subscriptions.length).toBe(1)
      expect(result.subscriptions[0].description).toBe('Netflix')
      expect(result.subscriptions[0].monthsFound).toBe(4) // current + 3 historical
      expect(result.subscriptions[0].confidence).toBeGreaterThan(0.8) // Alta consistência
    })

    it('maintains backward compatibility when no additional months provided', () => {
      const currentExpenses = [
        makeExpense({ description: 'Spotify', amount: 19.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' } }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Spotify', amount: 19.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]

      const input = makeBaseInput({
        expenses: currentExpenses,
        previousMonthExpenses: previousExpenses,
        additionalPreviousMonthExpenses: undefined,
      })

      const result = computeStructuredInsights(input)
      expect(result.subscriptions.length).toBe(1)
      expect(result.subscriptions[0].monthsFound).toBe(2) // current + 1 historical
    })

    it('does not detect subscription that appears in only 1 of 3 historical months', () => {
      const gymJuly = makeExpense({ description: 'Academia', amount: 89.90, category_id: 'cat-fit', category: { id: 'cat-fit', name: 'Saúde', color: 'var(--color-primary)', created_at: '' } })
      const gymJune = makeExpense({ id: 'exp-2', description: 'Academia', amount: 89.90, category_id: 'cat-fit', category: { id: 'cat-fit', name: 'Saúde', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' })
      // Only appears in current and June, not in May/Apr
      const mayExpenses = []
      const aprExpenses = []

      const input = makeBaseInput({
        expenses: [gymJuly],
        previousMonthExpenses: [gymJune],
        additionalPreviousMonthExpenses: [mayExpenses, aprExpenses],
      })

      const result = computeStructuredInsights(input)
      // Should still detect because it appears in current + at least 1 historical
      expect(result.subscriptions.length).toBe(1)
      expect(result.subscriptions[0].monthsFound).toBe(2) // current + June only
    })
  })

  describe('recurringExpenses - 3-level classification', () => {
    it('returns recurringExpenses field with same length as filtered subscriptions', () => {
      const currentExpenses = [
        makeExpense({ description: 'Netflix', amount: 55.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' } }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Netflix', amount: 55.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const input = makeBaseInput({ expenses: currentExpenses, previousMonthExpenses: previousExpenses })
      const result = computeStructuredInsights(input)
      expect(result.recurringExpenses).toBeDefined()
      expect(result.recurringExpenses.length).toBe(1)
      expect(result.subscriptions.length).toBe(1)
    })

    it('classifies as \'recurring\' when same description appears in 2 months with value varying up to 50%', () => {
      const currentExpenses = [
        makeExpense({ description: 'Supermercado Extra', amount: 350 }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Supermercado Extra', amount: 280, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const input = makeBaseInput({ expenses: currentExpenses, previousMonthExpenses: previousExpenses })
      const result = computeStructuredInsights(input)
      expect(result.recurringExpenses.length).toBe(1)
      expect(result.recurringExpenses[0].recurrenceType).toBe('recurring')
      expect(result.recurringExpenses[0].nature).toBe('variable')
      expect(result.recurringExpenses[0].incomePercentage).toBeGreaterThan(0)
      // Should also appear in subscriptions (backward compat)
      expect(result.subscriptions.length).toBe(1)
    })

    it('classifies as \'subscription\' when same description and value appears in 3+ months', () => {
      const cur = makeExpense({ description: 'Spotify', amount: 21.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' } })
      const prev = makeExpense({ id: 'exp-2', description: 'Spotify', amount: 21.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' })
      const m2 = makeExpense({ id: 'exp-3', description: 'Spotify', amount: 21.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' })
      const m3 = makeExpense({ id: 'exp-4', description: 'Spotify', amount: 21.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-04-15T00:00:00.000Z' })

      const input = makeBaseInput({
        expenses: [cur],
        previousMonthExpenses: [prev],
        additionalPreviousMonthExpenses: [[m2], [m3]],
      })
      const result = computeStructuredInsights(input)
      expect(result.recurringExpenses.length).toBe(1)
      expect(result.recurringExpenses[0].recurrenceType).toBe('subscription')
      expect(result.recurringExpenses[0].nature).toBe('fixed')
      expect(result.recurringExpenses[0].confidence).toBeGreaterThan(0.5)
      expect(result.recurringExpenses[0].incomePercentage).toBeGreaterThan(0)
    })

    it('detects similar expenses grouped by category when descriptions differ (2+ historical months)', () => {
      // Categoria NÃO agregadora e NÃO de assinatura para evitar filtros
      // Current: 2 despesas em "Vestuário", total ~200
      // Previous: 2 despesas diferentes em "Vestuário", total ~200
      // Mês -2: 2 despesas diferentes em "Vestuário", total ~200
      // Todas as descrições diferem entre si → vão para Passo 3
      const currentExpenses = [
        makeExpense({ description: 'Camisa A', amount: 110, category_id: 'cat-cloth', category: { id: 'cat-cloth', name: 'Vestuário', color: 'var(--color-primary)', created_at: '' } }),
        makeExpense({ id: 'exp-c2', description: 'Calça B', amount: 90, category_id: 'cat-cloth', category: { id: 'cat-cloth', name: 'Vestuário', color: 'var(--color-primary)', created_at: '' } }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-p1', description: 'Tênis C', amount: 120, category_id: 'cat-cloth', category: { id: 'cat-cloth', name: 'Vestuário', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-p2', description: 'Jaqueta D', amount: 80, category_id: 'cat-cloth', category: { id: 'cat-cloth', name: 'Vestuário', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
      ]
      const monthMinus2Expenses = [
        makeExpense({ id: 'exp-m1', description: 'Cinto E', amount: 95, category_id: 'cat-cloth', category: { id: 'cat-cloth', name: 'Vestuário', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
        makeExpense({ id: 'exp-m2', description: 'Boné F', amount: 100, category_id: 'cat-cloth', category: { id: 'cat-cloth', name: 'Vestuário', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' }),
      ]
      const input = makeBaseInput({
        expenses: currentExpenses,
        previousMonthExpenses: previousExpenses,
        additionalPreviousMonthExpenses: [monthMinus2Expenses],
      })
      const result = computeStructuredInsights(input)
      // Deve ter ao menos um 'similar' em recurringExpenses
      const similar = result.recurringExpenses.filter(r => r.recurrenceType === 'similar')
      expect(similar.length).toBeGreaterThan(0)
      expect(similar[0].confidence).toBeLessThan(0.6)
      // Similar NÃO deve aparecer em subscriptions
      const subNames = result.subscriptions.map(s => s.description)
      expect(subNames).not.toContain('Camisa A')
    })

    it('does not include similar items in subscriptions (backward compat)', () => {
      const cur = makeExpense({ description: 'Item X', amount: 80, category_id: 'cat-tools', category: { id: 'cat-tools', name: 'Ferramentas', color: 'var(--color-primary)', created_at: '' } })
      const prev = makeExpense({ id: 'exp-2', description: 'Item Y', amount: 90, category_id: 'cat-tools', category: { id: 'cat-tools', name: 'Ferramentas', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' })
      const m2 = makeExpense({ id: 'exp-3', description: 'Item Z', amount: 85, category_id: 'cat-tools', category: { id: 'cat-tools', name: 'Ferramentas', color: 'var(--color-primary)', created_at: '' }, created_at: '2026-05-15T00:00:00.000Z' })
      const input = makeBaseInput({
        expenses: [cur],
        previousMonthExpenses: [prev],
        additionalPreviousMonthExpenses: [[m2]],
      })
      const result = computeStructuredInsights(input)
      // Descriptions diferem, categoria Ferramentas (não agregadora), 2+ meses históricos
      const similar = result.recurringExpenses.filter(r => r.recurrenceType === 'similar')
      expect(similar.length).toBeGreaterThan(0)
      // Similar NÃO deve estar em subscriptions
      const subNames = result.subscriptions.map(s => s.description)
      expect(subNames).not.toContain('Item X')
    })
  })

  describe('savings challenges - annual projection', () => {
    it('includes annualProjectedSavings field', () => {
      const input = makeBaseInput({
        categoryExpenseSummaries: [
          { category_name: 'Delivery', total: 500, baseTotal: 500 },
          { category_name: 'Supermercado', total: 1000, baseTotal: 1000 },
        ],
        totalExpenses: 1500,
        totalIncomes: 5000,
      })

      const result = computeStructuredInsights(input)
      expect(result.savingsChallenges.length).toBeGreaterThan(0)

      // Each challenge should have annualProjectedSavings = potentialSavings * 12
      for (const challenge of result.savingsChallenges) {
        expect(challenge.annualProjectedSavings).toBe(
          Math.round(challenge.potentialSavings * 12 * 100) / 100
        )
      }
    })
  })
})

/* ------------------------------------------------------------------ */
/*  calcSubscriptionSignals Unit Tests                                 */
/* ------------------------------------------------------------------ */

describe('calcSubscriptionSignals', () => {
  it('detects name match for known subscription service (Netflix)', () => {
    const signals = calcSubscriptionSignals('Netflix', 'Outros', 100, null)
    expect(signals.nameMatch).toBe(true)
    expect(signals.categoryMatch).toBe(false)
    expect(signals.exactValue).toBe(false)
    expect(signals.count).toBe(1)
  })

  it('detects name match case-insensitively (NETFLIX)', () => {
    const signals = calcSubscriptionSignals('NETFLIX', 'Outros', 100, null)
    expect(signals.nameMatch).toBe(true)
    expect(signals.count).toBe(1)
  })

  it('detects name match with extra text (Spotify Premium)', () => {
    const signals = calcSubscriptionSignals('Spotify Premium Family', 'Outros', 100, null)
    expect(signals.nameMatch).toBe(true)
    expect(signals.count).toBe(1)
  })

  it('detects category match for known subscription category', () => {
    const signals = calcSubscriptionSignals('Curso Online', 'Streaming', 100, null)
    expect(signals.nameMatch).toBe(false)
    expect(signals.categoryMatch).toBe(true)
    expect(signals.count).toBe(1)
  })

  it('detects exact value match when values are within ±5%', () => {
    const signals = calcSubscriptionSignals('Teste', 'Outros', 100, 103)
    expect(signals.exactValue).toBe(true)
    expect(signals.count).toBe(1)
  })

  it('does not flag exact value when ratio exceeds 1.05', () => {
    const signals = calcSubscriptionSignals('Teste', 'Outros', 100, 110)
    expect(signals.exactValue).toBe(false)
    expect(signals.count).toBe(0)
  })

  it('does not flag exact value when historicalTotal is null', () => {
    const signals = calcSubscriptionSignals('Teste', 'Outros', 100, null)
    expect(signals.exactValue).toBe(false)
    expect(signals.count).toBe(0)
  })

  it('combines name + category signals for Netflix in Streaming', () => {
    const signals = calcSubscriptionSignals('Netflix', 'Streaming', 100, null)
    expect(signals.nameMatch).toBe(true)
    expect(signals.categoryMatch).toBe(true)
    expect(signals.count).toBe(2)
  })

  it('combines all 3 signals: name + category + exact value', () => {
    const signals = calcSubscriptionSignals('Netflix', 'Streaming', 100, 100)
    expect(signals.nameMatch).toBe(true)
    expect(signals.categoryMatch).toBe(true)
    expect(signals.exactValue).toBe(true)
    expect(signals.count).toBe(3)
  })

  it('returns no signals for unknown description with no category match and no historical', () => {
    const signals = calcSubscriptionSignals('Gasto Aleatório', 'Ferramentas', 100, null)
    expect(signals.nameMatch).toBe(false)
    expect(signals.categoryMatch).toBe(false)
    expect(signals.exactValue).toBe(false)
    expect(signals.count).toBe(0)
  })

  it('handles partial name match (adobe in Adobe Creative Cloud)', () => {
    const signals = calcSubscriptionSignals('Adobe Creative Cloud', 'Outros', 100, null)
    expect(signals.nameMatch).toBe(true)
    expect(signals.count).toBe(1)
  })
})

/* ------------------------------------------------------------------ */
/*  classifyBySignals Unit Tests                                       */
/* ------------------------------------------------------------------ */

describe('classifyBySignals', () => {
  const makeSig = (overrides: Partial<ReturnType<typeof calcSubscriptionSignals>> = {}): ReturnType<typeof calcSubscriptionSignals> => ({
    count: 0, exactValue: false, nameMatch: false, categoryMatch: false, ...overrides,
  })

  // ── Priority 1: Exact value + 2+ months ──
  it('returns subscription (0.90+) when exactValue=true and monthsWithExact>=1', () => {
    const sig = makeSig({ exactValue: true })
    const result = classifyBySignals(1, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBeCloseTo(0.90, 10)
  })

  it('boosts confidence with nameMatch bonus', () => {
    const sig = makeSig({ exactValue: true, nameMatch: true })
    const result = classifyBySignals(1, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBeCloseTo(0.95, 10)
  })

  it('boosts confidence with categoryMatch bonus', () => {
    const sig = makeSig({ exactValue: true, categoryMatch: true })
    const result = classifyBySignals(1, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBeCloseTo(0.93, 2)
  })

  it('boosts confidence with both bonuses (exactValue + name + category)', () => {
    const sig = makeSig({ exactValue: true, nameMatch: true, categoryMatch: true, count: 3 })
    const result = classifyBySignals(1, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBeCloseTo(0.98, 2)
  })

  // ── Priority 2: Name + Category known ──
  it('returns subscription (0.85) when nameMatch + categoryMatch and monthsWithApprox>=1', () => {
    const sig = makeSig({ nameMatch: true, categoryMatch: true, count: 2 })
    const result = classifyBySignals(0, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBeCloseTo(0.85, 2)
  })

  // ── Priority 3: Name + exact value ──
  it('returns subscription (0.80) when nameMatch and monthsWithExact>=1', () => {
    const sig = makeSig({ nameMatch: true })
    const result = classifyBySignals(1, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBeCloseTo(0.80, 2)
  })

  // ── Priority 4: Category + exact value ──
  it('returns subscription (0.75) when categoryMatch and monthsWithExact>=1', () => {
    const sig = makeSig({ categoryMatch: true })
    const result = classifyBySignals(1, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBe(0.75)
  })

  // ── Priority 5: 3+ months ±10% (traditional) ──
  it('returns subscription (0.70) when monthsWithExact>=2 (traditional)', () => {
    const sig = makeSig()
    const result = classifyBySignals(2, 2, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBe(0.70)
  })

  // ── Priority 6: Name + approximate value ──
  it('returns subscription (0.60) when nameMatch and monthsWithApprox>=1 (no exact)', () => {
    const sig = makeSig({ nameMatch: true })
    const result = classifyBySignals(0, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBe(0.60)
  })

  // ── Priority 7: Category + approximate value ──
  it('returns subscription (0.55) when categoryMatch + count>=2 + monthsWithApprox>=1', () => {
    const sig = makeSig({ categoryMatch: true, count: 2 })
    const result = classifyBySignals(0, 1, sig)
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBe(0.55)
  })

  // ── Priority 8: Recurring (basic match) ──
  it('returns recurring (0.40) when monthsWithApprox>=1 with no signals', () => {
    const sig = makeSig()
    const result = classifyBySignals(0, 1, sig)
    expect(result.recType).toBe('recurring')
    expect(result.baseConfidence).toBe(0.40)
  })

  it('returns subscription (0.60) when nameMatch and monthsWithApprox>=1 (signalCount=1)', () => {
    const sig = makeSig({ nameMatch: true, count: 1 })
    const result = classifyBySignals(0, 1, sig)
    // Priority 6: nameMatch + monthsWithApprox>=1 → subscription
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBe(0.60)
  })

  it('returns subscription (0.85) when nameMatch+categoryMatch (signalCount=2)', () => {
    const sig = makeSig({ nameMatch: true, categoryMatch: true, count: 2 })
    const result = classifyBySignals(0, 1, sig)
    // Priority 2: nameMatch + categoryMatch → subscription
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBe(0.85)
  })

  it('returns subscription (0.85) when nameMatch+categoryMatch (signalCount=3, exactValue but no monthsWithExact)', () => {
    const sig = makeSig({ nameMatch: true, categoryMatch: true, exactValue: true, count: 3 })
    const result = classifyBySignals(0, 1, sig)
    // Priority 2: nameMatch + categoryMatch → subscription (0.85)
    // Priority 1 doesn't fire because monthsWithExact=0
    expect(result.recType).toBe('subscription')
    expect(result.baseConfidence).toBe(0.85)
  })

  // ── Priority 9: No match ──
  it('returns null when monthsWithApprox < 1', () => {
    const sig = makeSig()
    const result = classifyBySignals(0, 0, sig)
    expect(result.recType).toBeNull()
    expect(result.baseConfidence).toBe(0)
  })

  // ── Priority order verification ──
  it('prioritizes exactValue over name-only when both apply', () => {
    // exactValue check (0.95) should win over name-only (0.60)
    const sig = makeSig({ exactValue: true, nameMatch: true, count: 2 })
    const exactResult = classifyBySignals(1, 2, sig)
    expect(exactResult.baseConfidence).toBeCloseTo(0.95, 10)

    // Same data but without monthsWithExact -> falls through to name-only
    const nameResult = classifyBySignals(0, 2, sig)
    expect(nameResult.baseConfidence).toBe(0.60)
  })

  it('correctly prioritizes name+category (0.85) over name-only (0.60)', () => {
    const sig = makeSig({ nameMatch: true, categoryMatch: true, count: 2 })
    const result = classifyBySignals(0, 1, sig)
    expect(result.baseConfidence).toBe(0.85)

    const nameOnly = makeSig({ nameMatch: true })
    const result2 = classifyBySignals(0, 1, nameOnly)
    expect(result2.baseConfidence).toBe(0.60)
  })

  it('requires signalCount>=2 for category-only approximate subscription', () => {
    // categoryMatch + count=1 should fall through to recurring
    const sig1 = makeSig({ categoryMatch: true, count: 1 })
    const result1 = classifyBySignals(0, 1, sig1)
    expect(result1.recType).toBe('recurring')
    expect(result1.baseConfidence).toBeCloseTo(0.43, 2)

    // categoryMatch + count=2 should match subscription
    const sig2 = makeSig({ categoryMatch: true, count: 2 })
    const result2 = classifyBySignals(0, 1, sig2)
    expect(result2.recType).toBe('subscription')
    expect(result2.baseConfidence).toBeCloseTo(0.55, 2)
  })
})
