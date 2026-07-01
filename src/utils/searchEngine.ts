import type { Expense, Income, Debt, CreditCard, Category, IncomeCategory } from '@/types'
import { formatDate } from './format'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  id: string
  type: 'expense' | 'income' | 'debt' | 'credit_card' | 'category' | 'income_category' | 'page'
  title: string
  subtitle: string
  value?: number
  date?: string
  iconName: string
  iconColor: string
  bgColor: string
  path: string
  score: number
}

export interface SearchableData {
  expenses: Expense[]
  incomes: Income[]
  debts: Debt[]
  creditCards: CreditCard[]
  categories: Category[]
  incomeCategories: IncomeCategory[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Máximo de itens processados por tipo para evitar travamentos */
const MAX_ITEMS_PER_TYPE = 2000

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Remove acentos e converte para lowercase. */
function normalize(str: string): string {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Pontua quão bem a query corresponde a um texto. */
function scoreMatch(query: string, text: string): number {
  const nq = normalize(query)
  const nt = normalize(text)
  if (!nq || !nt) return 0
  if (nt === nq) return 100
  if (nt.startsWith(nq)) return 85
  if (nt.includes(nq)) return 60
  return 0
}

/** Calcula quantos meses atrás uma data está (mínimo 0). */
function monthsAgo(dateStr: string): number {
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return 999
    const now = new Date()
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  } catch {
    return 999
  }
}

/**
 * Bônus de recência com decaimento logarítmico por mês.
 * Quanto mais recente, maior o bônus — mas registros antigos ainda
 * podem aparecer se tiverem um bom score de match.
 *
 *   Mês atual     → +25
 *   1-2 meses     → +20
 *   3-4 meses     → +15
 *   5-6 meses     → +10
 *   7-12 meses    → +5
 *   12+ meses     → +0
 */
function recencyBonus(dateStr: string): number {
  const months = monthsAgo(dateStr)
  if (months <= 0) return 25
  if (months <= 2) return 20
  if (months <= 4) return 15
  if (months <= 6) return 10
  if (months <= 12) return 5
  return 0
}

/* ------------------------------------------------------------------ */
/*  Per-entity searchers                                               */
/* ------------------------------------------------------------------ */

function searchExpenses(query: string, expenses: Expense[]): SearchResult[] {
  const out: SearchResult[] = []
  const nq = normalize(query)
  const slice = expenses.slice(0, MAX_ITEMS_PER_TYPE)

  for (const e of slice) {
    let best = 0

    if (e.description) best = Math.max(best, scoreMatch(query, e.description))
    if (e.category?.name) best = Math.max(best, scoreMatch(query, e.category.name))

    // match numérico
    if (nq.length >= 2 && String(Math.floor(Math.abs(e.amount))).includes(nq)) best = Math.max(best, 30)

    if (best > 0) {
      out.push({
        id: e.id,
        type: 'expense',
        title: e.description || 'Despesa',
        subtitle: e.category?.name
          ? `${e.category.name} • ${formatDate(e.date)}`
          : formatDate(e.date),
        value: e.amount,
        date: e.date,
        iconName: 'TrendingDown',
        iconColor: 'var(--color-expense-text)',
        bgColor: 'var(--color-expense)',
        path: `/expenses?highlight=${e.id}`,
        score: best + recencyBonus(e.date),
      })
    }
  }
  return out
}

function searchIncomes(query: string, incomes: Income[]): SearchResult[] {
  const out: SearchResult[] = []
  const nq = normalize(query)
  const slice = incomes.slice(0, MAX_ITEMS_PER_TYPE)

  for (const inc of slice) {
    let best = 0

    if (inc.description) best = Math.max(best, scoreMatch(query, inc.description))
    if (inc.income_category?.name) best = Math.max(best, scoreMatch(query, inc.income_category.name))
    if (nq.length >= 2 && String(Math.floor(Math.abs(inc.amount))).includes(nq)) best = Math.max(best, 30)

    if (best > 0) {
      out.push({
        id: inc.id,
        type: 'income',
        title: inc.description || 'Renda',
        subtitle: inc.income_category?.name
          ? `${inc.income_category.name} • ${formatDate(inc.date)}`
          : formatDate(inc.date),
        value: inc.amount,
        date: inc.date,
        iconName: 'TrendingUp',
        iconColor: 'var(--color-income-text)',
        bgColor: 'var(--color-income)',
        path: `/incomes?highlight=${inc.id}`,
        score: best + recencyBonus(inc.date),
      })
    }
  }
  return out
}

function searchDebts(query: string, debts: Debt[]): SearchResult[] {
  const out: SearchResult[] = []
  const nq = normalize(query)
  const slice = debts.slice(0, MAX_ITEMS_PER_TYPE)

  for (const d of slice) {
    let best = 0

    if (d.name) best = Math.max(best, scoreMatch(query, d.name))
    if (d.description) best = Math.max(best, scoreMatch(query, d.description))
    if (nq.length >= 2 && String(Math.floor(Math.abs(d.amount))).includes(nq)) best = Math.max(best, 30)

    // match por status
    if (normalize(d.status).includes(nq)) best = Math.max(best, 40)

    if (best > 0) {
      const statusLabel = d.status === 'paid' ? 'pago' : 'pendente'
      out.push({
        id: d.id,
        type: 'debt',
        title: d.name,
        subtitle: `${d.type === 'payable' ? 'A pagar' : 'A receber'} (${statusLabel}) • ${formatDate(d.due_date)}`,
        value: d.amount,
        date: d.due_date,
        iconName: 'Receipt',
        iconColor: 'var(--color-warning)',
        bgColor: 'var(--color-warning)',
        path: `/contas?highlight=${d.id}`,
        score: best + recencyBonus(d.due_date),
      })
    }
  }
  return out
}

function searchCreditCards(query: string, cards: CreditCard[]): SearchResult[] {
  const out: SearchResult[] = []

  for (const c of cards) {
    let best = 0

    if (c.name) best = Math.max(best, scoreMatch(query, c.name))
    if (c.brand) best = Math.max(best, scoreMatch(query, c.brand))

    if (best > 0) {
      out.push({
        id: c.id,
        type: 'credit_card',
        title: c.name,
        subtitle: c.brand || 'Cartão de crédito',
        iconName: 'CreditCard',
        iconColor: 'var(--color-primary)',
        bgColor: 'var(--color-primary)',
        path: `/contas?card=${c.id}`,
        score: best,
      })
    }
  }
  return out
}

function searchCategories(query: string, cats: Category[]): SearchResult[] {
  const out: SearchResult[] = []

  for (const c of cats) {
    const best = scoreMatch(query, c.name)
    if (best > 0) {
      out.push({
        id: c.id,
        type: 'category',
        title: c.name,
        subtitle: 'Categoria de despesa',
        iconName: 'Tags',
        iconColor: 'var(--color-text-secondary)',
        bgColor: 'var(--color-text-secondary)',
        path: `/categories?highlight=${c.id}`,
        score: best,
      })
    }
  }
  return out
}

function searchIncomeCategories(query: string, cats: IncomeCategory[]): SearchResult[] {
  const out: SearchResult[] = []

  for (const c of cats) {
    const best = scoreMatch(query, c.name)
    if (best > 0) {
      out.push({
        id: c.id,
        type: 'income_category',
        title: c.name,
        subtitle: 'Categoria de renda',
        iconName: 'Tags',
        iconColor: 'var(--color-text-secondary)',
        bgColor: 'var(--color-text-secondary)',
        path: `/categories?highlight=${c.id}`,
        score: best,
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/*  Aggregator                                                        */
/* ------------------------------------------------------------------ */

const MAX_PER_SECTION = 5
const MAX_TOTAL = 12

/**
 * Pesquisa global em todos os dados financeiros disponíveis.
 * Resultados são ordenados por score (decrescente) e limitados.
 */
export function searchAll(query: string, data: SearchableData): SearchResult[] {
  if (!query.trim() || query.trim().length < 2) return []

  const all = [
    ...searchExpenses(query, data.expenses),
    ...searchIncomes(query, data.incomes),
    ...searchDebts(query, data.debts),
    ...searchCreditCards(query, data.creditCards),
    ...searchCategories(query, data.categories),
    ...searchIncomeCategories(query, data.incomeCategories),
  ]

  // Agrupar por tipo, limitar por seção, ordenar globalmente
  const grouped = new Map<string, SearchResult[]>()
  for (const r of all) {
    const g = grouped.get(r.type) ?? []
    if (g.length < MAX_PER_SECTION) {
      g.push(r)
      grouped.set(r.type, g)
    }
  }

  const limited = [...grouped.values()].flat()
  limited.sort((a, b) => b.score - a.score)
  return limited.slice(0, MAX_TOTAL)
}
