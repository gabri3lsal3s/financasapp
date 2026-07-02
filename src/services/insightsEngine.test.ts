import { describe, it, expect } from 'vitest'
import {
  computeStructuredInsights,
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
    category: { id: 'cat-1', name: 'Categoria Teste', color: '#ff0000', created_at: '' },
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
        makeExpense({ description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: '#000', created_at: '' } }),
      ]
      const previousExpenses = [
        makeExpense({ id: 'exp-2', description: 'Netflix', amount: 39.90, category_id: 'cat-str', category: { id: 'cat-str', name: 'Streaming', color: '#000', created_at: '' }, created_at: '2026-06-15T00:00:00.000Z' }),
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
})
