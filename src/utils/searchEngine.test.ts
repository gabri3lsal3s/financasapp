import { describe, it, expect } from 'vitest'
import { searchAll, type SearchableData } from './searchEngine'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeExpense(overrides: Partial<{
  id: string; amount: number; description: string; date: string; category_id: string; category_name: string
}> = {}) {
  return {
    id: overrides.id ?? 'exp-test',
    amount: overrides.amount ?? 100,
    description: overrides.description ?? 'Teste',
    date: overrides.date ?? '2026-06-15',
    category_id: overrides.category_id ?? 'cat-1',
    category: { id: overrides.category_id ?? 'cat-1', name: overrides.category_name ?? 'Teste', color: '#000' },
    created_at: '2026-06-15T10:00:00Z',
  }
}

function makeMockData(overrides?: Partial<SearchableData>): SearchableData {
  return {
    expenses: [
      makeExpense({ id: 'exp-1', amount: 150.5, description: 'Supermercado', date: '2026-06-15', category_name: 'Alimentação' }),
      makeExpense({ id: 'exp-2', amount: 89.9, description: 'Gasolina', date: '2026-06-10', category_name: 'Transporte' }),
      makeExpense({ id: 'exp-3', amount: 45.0, description: 'Uber', date: '2026-06-05', category_name: 'Transporte' }),
      makeExpense({ id: 'exp-4', amount: 3200.0, description: 'Aluguel', date: '2026-06-01', category_name: 'Moradia' }),
    ],
    incomes: [
      { id: 'inc-1', amount: 15000.0, description: 'Salário', date: '2026-06-05', income_category_id: 'icat-1', income_category: { id: 'icat-1', name: 'Salário', color: '#10b981' }, type: 'transfer', created_at: '2026-06-05T10:00:00Z' },
      { id: 'inc-2', amount: 500.0, description: 'Freela', date: '2026-06-20', income_category_id: 'icat-2', income_category: { id: 'icat-2', name: 'Freelance', color: '#8b5cf6' }, type: 'pix', created_at: '2026-06-20T10:00:00Z' },
    ],
    debts: [
      { id: 'debt-1', name: 'Aluguel', amount: 1200.0, due_date: '2026-07-10', type: 'payable', status: 'pending', created_at: '2026-06-01T10:00:00Z' },
      { id: 'debt-2', name: 'Netflix', amount: 55.9, due_date: '2026-07-15', type: 'payable', status: 'pending', created_at: '2026-06-01T10:00:00Z' },
    ],
    creditCards: [
      { id: 'cc-1', name: 'Nubank', brand: 'Mastercard', closing_day: 5, due_day: 12, created_at: '2026-01-01T10:00:00Z' },
      { id: 'cc-2', name: 'Inter', brand: 'Visa', closing_day: 10, due_day: 18, created_at: '2026-01-01T10:00:00Z' },
    ],
    categories: [
      { id: 'cat-1', name: 'Alimentação', color: '#10b981', created_at: '2026-01-01T10:00:00Z' },
      { id: 'cat-2', name: 'Transporte', color: '#3b82f6', created_at: '2026-01-01T10:00:00Z' },
      { id: 'cat-3', name: 'Moradia', color: '#f59e0b', created_at: '2026-01-01T10:00:00Z' },
    ],
    incomeCategories: [
      { id: 'icat-1', name: 'Salário', color: '#10b981', created_at: '2026-01-01T10:00:00Z' },
      { id: 'icat-2', name: 'Freelance', color: '#8b5cf6', created_at: '2026-01-01T10:00:00Z' },
    ],
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('searchEngine', () => {

  describe('searchAll', () => {
    it('retorna array vazio para query vazia', () => {
      const data = makeMockData()
      expect(searchAll('', data)).toEqual([])
      expect(searchAll('   ', data)).toEqual([])
    })

    it('retorna array vazio para query com menos de 2 caracteres', () => {
      const data = makeMockData()
      expect(searchAll('a', data)).toEqual([])
      expect(searchAll('ç', data)).toEqual([])
    })

    it('encontra despesas por descrição', () => {
      const data = makeMockData()
      const results = searchAll('supermercado', data)
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].type).toBe('expense')
      expect(results[0].title).toBe('Supermercado')
    })

    it('encontra despesas por substring da descrição', () => {
      const data = makeMockData()
      const results = searchAll('super', data)
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some(r => r.type === 'expense')).toBe(true)
    })

    it('encontra despesas por nome da categoria', () => {
      const data = makeMockData()
      const results = searchAll('transporte', data)
      // 'Transporte' também é nome de uma categoria -> retorna expense e category
      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results.filter(r => r.type === 'expense').length).toBeGreaterThanOrEqual(2) // Gasolina + Uber
    })

    it('encontra despesas por valor (parcial)', () => {
      const data = makeMockData()
      const results = searchAll('150', data)
      expect(results.some(r => r.type === 'expense' && r.value === 150.5)).toBe(true)
    })

    it('encontra rendas por descrição', () => {
      const data = makeMockData()
      const results = searchAll('salário', data)
      expect(results.some(r => r.type === 'income' && r.title === 'Salário')).toBe(true)
    })

    it('encontra rendas por nome da categoria', () => {
      const data = makeMockData()
      const results = searchAll('freelance', data)
      expect(results.some(r => r.type === 'income')).toBe(true)
    })

    it('encontra dívidas por nome', () => {
      const data = makeMockData()
      const results = searchAll('aluguel', data)
      expect(results.some(r => r.type === 'debt' && r.title === 'Aluguel')).toBe(true)
    })

    it('encontra cartões por nome', () => {
      const data = makeMockData()
      const results = searchAll('nubank', data)
      expect(results.some(r => r.type === 'credit_card')).toBe(true)
    })

    it('encontra cartões por bandeira', () => {
      const data = makeMockData()
      const results = searchAll('mastercard', data)
      expect(results.some(r => r.type === 'credit_card')).toBe(true)
    })

    it('encontra categorias por nome', () => {
      const data = makeMockData()
      const results = searchAll('moradia', data)
      expect(results.some(r => r.type === 'category')).toBe(true)
    })

    it('encontra categorias de renda por nome', () => {
      const data = makeMockData()
      const results = searchAll('salário', data)
      expect(results.some(r => r.type === 'income_category')).toBe(true)
    })

    it('faz matching case-insensitive', () => {
      const data = makeMockData()
      const upper = searchAll('SUPERMERCADO', data)
      const lower = searchAll('supermercado', data)
      expect(upper.length).toBe(lower.length)
    })

    it('faz matching com acentos (normalização)', () => {
      const data = makeMockData()
      const results = searchAll('alimentacao', data) // sem acento
      expect(results.some(r => r.subtitle.includes('Alimentação') || r.title === 'Alimentação')).toBe(true)
    })

    it('limita a 12 resultados no total', () => {
      // 20 despesas com descrições que matchem \"teste\"
      const manyExpenses = Array.from({ length: 20 }, (_, i) => ({
        id: `exp-many-${i}`,
        amount: 100 + i,
        description: `teste item ${i}`,
        date: '2026-06-01',
        category_id: 'cat-1',
        category: { id: 'cat-1', name: 'Categoria', color: '#000' },
        created_at: '2026-06-01T10:00:00Z',
      }))
      const data = makeMockData({ expenses: manyExpenses as any })
      const results = searchAll('teste', data)
      expect(results.length).toBeLessThanOrEqual(12)
    })

    it('retorna resultados ordenados por score (decrescente)', () => {
      const data = makeMockData()
      // 'super' encontra 'Supermercado' (prefix match = 85) e Uber não matchea
      // Mas outras entradas podem ter scores diferentes
      const results = searchAll('gasolina', data)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })

    it('dá preferência para resultados mais recentes com mesmo match', () => {
      const data = makeMockData({
        expenses: [
          { id: 'exp-old', amount: 100, description: 'Supermercado', date: '2025-01-15', category_name: 'Alimentação' },
          { id: 'exp-new', amount: 200, description: 'Supermercado', date: '2026-06-15', category_name: 'Alimentação' },
        ],
        incomes: [],
        debts: [],
        creditCards: [],
        categories: [],
        incomeCategories: [],
      })
      const results = searchAll('supermercado', data)
      // Ambos têm match exato (100), mas o mais recente ganha bônus de recência
      expect(results.length).toBe(2)
      expect(results[0].id).toBe('exp-new')
      expect(results[0].score).toBeGreaterThan(results[1].score)
    })

    it('inclui valor formatado nos resultados de despesa', () => {
      const data = makeMockData()
      const results = searchAll('supermercado', data)
      expect(results[0].value).toBe(150.5)
    })

    it('inclui data nos resultados de dívida', () => {
      const data = makeMockData()
      const results = searchAll('aluguel', data)
      expect(results[0].date).toBe('2026-07-10')
    })

    it('não encontra itens que não existem', () => {
      const data = makeMockData()
      const results = searchAll('zzzzzzzzzz', data)
      expect(results).toEqual([])
    })
  })

  describe('integração com múltiplos tipos', () => {
    it('retorna resultados de múltiplas entidades quando aplicável', () => {
      const data = makeMockData()
      // 'Alimentação' aparece como categoria E poderia aparecer em despesas via categoria
      // Mas 'super' só aparece em despesas
      const results = searchAll('super', data)
      const types = new Set(results.map(r => r.type))
      expect(types.has('expense')).toBe(true)
    })

    it('resultados incluem path de navegação', () => {
      const data = makeMockData()
      const results = searchAll('gasolina', data)
      expect(results[0].path).toBe('/expenses?highlight=exp-2')
    })
  })
})
