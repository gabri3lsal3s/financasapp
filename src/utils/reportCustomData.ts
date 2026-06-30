/**
 * Funções puras de agregação para dados de período customizado dos relatórios.
 * Extraídas de Reports.tsx para serem testáveis e reutilizáveis.
 */
import { formatMonthShort } from '@/utils/format'
import { transactionInvestmentAmount } from '@/utils/portfolioMonthlyFlow'
import type { PortfolioTransaction } from '@/types'
import type { ExpenseCategorySummary, IncomeCategorySummary, DetailExpenseEntry, DetailIncomeEntry } from '@/types/reports'
import { logger } from '@/utils/logger'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface CustomMonthlySummary {
  month: string
  total_income: number
  total_expenses: number
  total_investments: number
  balance: number
}

export interface CustomDailySummary {
  date: string
  label: string
  total_income: number
  total_expenses: number
  total_investments: number
  balance: number
}

export interface CustomDailyFlowRow {
  day: string | number
  date?: string
  label: string
  Rendas: number
  Despesas: number
  Investimentos: number
  'Rendas (Mês Ant.)'?: number
  'Despesas (Mês Ant.)'?: number
  'Investimentos (Mês Ant.)'?: number
  [key: string]: string | number | boolean | undefined
}

interface ExpenseCategorySummaryItem {
  category_id: string
  category_name: string
  total: number
  color: string
}

interface IncomeCategorySummaryItem {
  income_category_id: string
  category_name: string
  total: number
  color: string
}

type PortfolioTxPick = Pick<
  PortfolioTransaction,
  'id' | 'cash_offset_source_id' | 'date' | 'operation_type' | 'quantity' | 'price'
>

// ─── Category Helpers ───────────────────────────────────────────────────────

function extractCategoryName(
  cat: { id?: string; name?: string; color?: string } | null,
): string {
  return cat?.name ?? 'Sem categoria'
}

function extractCategoryColor(
  cat: { id?: string; name?: string; color?: string } | null,
): string {
  return cat?.color ?? 'var(--category-fallback-neutral)'
}

// ─── Category Aggregation ───────────────────────────────────────────────────

/**
 * Agrupa despesas por categoria no período customizado.
 */
export function buildCustomCategoryExpenses(
  customExpenses: DetailExpenseEntry[],
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): ExpenseCategorySummary[] {
  const map = new Map<string, ExpenseCategorySummaryItem>()
  customExpenses.forEach((exp) => {
    const catId = exp.category_id
    const cat = exp.category as { id?: string; name?: string; color?: string } | null
    const total = getAmountByMode(exp)
    if (!map.has(catId)) {
      map.set(catId, {
        category_id: catId,
        category_name: extractCategoryName(cat),
        total: 0,
        color: extractCategoryColor(cat),
      })
    }
    const category = map.get(catId)
    if (category) {
      category.total += total
    } else {
      logger.warn(`Categoria de despesa não encontrada para agregação: ${catId}`)
    }
  })
  return Array.from(map.values()) as ExpenseCategorySummary[]
}

/**
 * Agrupa receitas por categoria no período customizado.
 */
export function buildCustomCategoryIncomes(
  customIncomes: DetailIncomeEntry[],
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): IncomeCategorySummary[] {
  const map = new Map<string, IncomeCategorySummaryItem>()
  customIncomes.forEach((inc) => {
    const catId = inc.income_category_id
    const cat = inc.income_category as { id?: string; name?: string; color?: string } | null
    const total = getAmountByMode(inc)
    if (!map.has(catId)) {
      map.set(catId, {
        income_category_id: catId,
        category_name: extractCategoryName(cat),
        total: 0,
        color: extractCategoryColor(cat),
      })
    }
    const existing = map.get(catId)
    if (existing) {
      existing.total += total
    } else {
      logger.warn(`Categoria de receita não encontrada para agregação: ${catId}`)
    }
  })
  return Array.from(map.values()) as IncomeCategorySummary[]
}

// ─── Monthly Summaries ──────────────────────────────────────────────────────

/**
 * Monta resumos mensais para o período customizado.
 */
export function buildCustomMonthlySummaries(
  customMonths: string[],
  customExpenses: DetailExpenseEntry[],
  customIncomes: DetailIncomeEntry[],
  customPortfolioTransactions: PortfolioTxPick[],
  debts: Array<{ due_date: string; type: string; status: string; amount: number }>,
  customStartDate: string,
  customEndDate: string,
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): CustomMonthlySummary[] {
  if (customMonths.length === 0) return []

  return customMonths.map((monthStr) => {
    const monthExpenses = customExpenses.filter(
      (exp) => exp.date.startsWith(monthStr) && exp.date >= customStartDate && exp.date <= customEndDate,
    )
    const monthIncomes = customIncomes.filter(
      (inc) => inc.date.startsWith(monthStr) && inc.date >= customStartDate && inc.date <= customEndDate,
    )
    const monthTxs = customPortfolioTransactions.filter(
      (tx) => tx.date.startsWith(monthStr) && tx.date >= customStartDate && tx.date <= customEndDate,
    )
    const monthDebts = debts.filter(
      (d) => d.due_date.startsWith(monthStr) && d.due_date >= customStartDate && d.due_date <= customEndDate,
    )

    const paidReceivables = monthDebts
      .filter((d) => d.type === 'receivable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)
    const paidPayables = monthDebts
      .filter((d) => d.type === 'payable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)

    const totalExpenses =
      monthExpenses.reduce((sum, exp) => sum + getAmountByMode(exp), 0) + paidPayables
    const totalIncomes =
      monthIncomes.reduce((sum, inc) => sum + getAmountByMode(inc), 0) + paidReceivables
    const totalInvestments = monthTxs.reduce((sum, tx) => {
      return sum + transactionInvestmentAmount(tx.operation_type, Number(tx.quantity), Number(tx.price))
    }, 0)

    return {
      month: monthStr,
      total_income: totalIncomes,
      total_expenses: totalExpenses,
      total_investments: totalInvestments,
      balance: totalIncomes - totalExpenses - totalInvestments,
    }
  })
}

// ─── Daily Summaries ────────────────────────────────────────────────────────

/**
 * Monta resumos diários para o período customizado (quando período <= 1 mês).
 */
export function buildCustomDailySummaries(
  customDays: string[],
  customExpenses: DetailExpenseEntry[],
  customIncomes: DetailIncomeEntry[],
  customPortfolioTransactions: PortfolioTxPick[],
  debts: Array<{ due_date: string; type: string; status: string; amount: number }>,
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): CustomDailySummary[] {
  if (customDays.length === 0) return []

  return customDays.map((dateStr) => {
    const dd = dateStr.slice(8, 10)
    const mm = dateStr.slice(5, 7)
    const label = `${dd}/${mm}`

    const dayExpenses = customExpenses.filter((exp) => exp.date === dateStr)
    const dayIncomes = customIncomes.filter((inc) => inc.date === dateStr)
    const dayTxs = customPortfolioTransactions.filter((tx) => tx.date === dateStr)

    const dayDebts = debts.filter((d) => d.due_date === dateStr)
    const paidReceivables = dayDebts
      .filter((d) => d.type === 'receivable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)
    const paidPayables = dayDebts
      .filter((d) => d.type === 'payable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)

    const totalExpenses =
      dayExpenses.reduce((sum, exp) => sum + getAmountByMode(exp), 0) + paidPayables
    const totalIncomes =
      dayIncomes.reduce((sum, inc) => sum + getAmountByMode(inc), 0) + paidReceivables
    const totalInvestments = dayTxs.reduce((sum, tx) => {
      return sum + transactionInvestmentAmount(tx.operation_type, Number(tx.quantity), Number(tx.price))
    }, 0)

    return {
      date: dateStr,
      label,
      total_income: totalIncomes,
      total_expenses: totalExpenses,
      total_investments: totalInvestments,
      balance: totalIncomes - totalExpenses - totalInvestments,
    }
  })
}

// ─── Monthly Category Expenses ──────────────────────────────────────────────

/**
 * Agrupa despesas por categoria e mês no período customizado.
 */
export function buildCustomMonthlyCategoryExpenses(
  customMonths: string[],
  customExpenses: DetailExpenseEntry[],
  customStartDate: string,
  customEndDate: string,
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): Record<string, ExpenseCategorySummary[]> {
  const map: Record<string, ExpenseCategorySummary[]> = {}

  customMonths.forEach((monthStr) => {
    const monthExpenses = customExpenses.filter(
      (exp) => exp.date.startsWith(monthStr) && exp.date >= customStartDate && exp.date <= customEndDate,
    )

    const categoryMap = new Map<string, ExpenseCategorySummaryItem>()
    monthExpenses.forEach((exp) => {
      const catId = exp.category_id
      const cat = exp.category as { id?: string; name?: string; color?: string } | null
      const total = getAmountByMode(exp)
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          category_id: catId,
          category_name: extractCategoryName(cat),
          total: 0,
          color: extractCategoryColor(cat),
        })
      }
      const entry = categoryMap.get(catId)
      if (entry) {
        entry.total += total
      } else {
        logger.warn(`Categoria não encontrada para agregação mensal: ${catId}`)
      }
    })
    map[monthStr] = Array.from(categoryMap.values()) as ExpenseCategorySummary[]
  })

  return map
}

// ─── Daily Category Expenses ────────────────────────────────────────────────

/**
 * Agrupa despesas por categoria e dia no período customizado (quando <= 1 mês).
 */
export function buildCustomDailyCategoryExpenses(
  customDays: string[],
  customExpenses: DetailExpenseEntry[],
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): Record<string, ExpenseCategorySummary[]> {
  const map: Record<string, ExpenseCategorySummary[]> = {}

  customDays.forEach((dateStr) => {
    const dayExpenses = customExpenses.filter((exp) => exp.date === dateStr)
    const categoryMap = new Map<string, ExpenseCategorySummaryItem>()

    dayExpenses.forEach((exp) => {
      const catId = exp.category_id
      const cat = exp.category as { id?: string; name?: string; color?: string } | null
      const total = getAmountByMode(exp)
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          category_id: catId,
          category_name: extractCategoryName(cat),
          total: 0,
          color: extractCategoryColor(cat),
        })
      }
      const entry = categoryMap.get(catId)
      if (entry) {
        entry.total += total
      } else {
        logger.warn(`Categoria não encontrada para agregação diária: ${catId}`)
      }
    })
    map[dateStr] = Array.from(categoryMap.values()) as ExpenseCategorySummary[]
  })

  return map
}

// ─── Monthly Income by Category ─────────────────────────────────────────────

/**
 * Agrupa receitas por categoria e mês no período customizado.
 */
export function buildCustomMonthlyIncomeByCategory(
  customMonths: string[],
  customIncomes: DetailIncomeEntry[],
  customStartDate: string,
  customEndDate: string,
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): Record<string, IncomeCategorySummary[]> {
  const map: Record<string, IncomeCategorySummary[]> = {}

  customMonths.forEach((monthStr) => {
    const monthIncomes = customIncomes.filter(
      (inc) => inc.date.startsWith(monthStr) && inc.date >= customStartDate && inc.date <= customEndDate,
    )

    const categoryMap = new Map<string, IncomeCategorySummaryItem>()
    monthIncomes.forEach((inc) => {
      const catId = inc.income_category_id
      const cat = inc.income_category as { id?: string; name?: string; color?: string } | null
      const total = getAmountByMode(inc)
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          income_category_id: catId,
          category_name: extractCategoryName(cat),
          total: 0,
          color: extractCategoryColor(cat),
        })
      }
      const entry = categoryMap.get(catId)
      if (entry) {
        entry.total += total
      } else {
        logger.warn(`Categoria de receita não encontrada para agregação mensal: ${catId}`)
      }
    })
    map[monthStr] = Array.from(categoryMap.values()) as IncomeCategorySummary[]
  })

  return map
}

// ─── Daily Income by Category ───────────────────────────────────────────────

/**
 * Agrupa receitas por categoria e dia no período customizado (quando <= 1 mês).
 */
export function buildCustomDailyIncomeByCategory(
  customDays: string[],
  customIncomes: DetailIncomeEntry[],
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): Record<string, IncomeCategorySummary[]> {
  const map: Record<string, IncomeCategorySummary[]> = {}

  customDays.forEach((dateStr) => {
    const dayIncomes = customIncomes.filter((inc) => inc.date === dateStr)
    const categoryMap = new Map<string, IncomeCategorySummaryItem>()

    dayIncomes.forEach((inc) => {
      const catId = inc.income_category_id
      const cat = inc.income_category as { id?: string; name?: string; color?: string } | null
      const total = getAmountByMode(inc)
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          income_category_id: catId,
          category_name: extractCategoryName(cat),
          total: 0,
          color: extractCategoryColor(cat),
        })
      }
      const entry = categoryMap.get(catId)
      if (entry) {
        entry.total += total
      } else {
        logger.warn(`Categoria de receita não encontrada para agregação diária: ${catId}`)
      }
    })
    map[dateStr] = Array.from(categoryMap.values()) as IncomeCategorySummary[]
  })

  return map
}

// ─── Cumulative Balance ─────────────────────────────────────────────────────

/**
 * Calcula saldo acumulado para o período customizado.
 */
export function buildCustomCumulativeBalance(
  isSingleMonth: boolean,
  customDailySummaries: CustomDailySummary[],
  customMonthlySummaries: CustomMonthlySummary[],
): Array<{ month: string; SaldoAcumulado: number }> {
  let cumulative = 0
  if (isSingleMonth) {
    return customDailySummaries.map((item) => {
      cumulative += item.balance
      return { month: item.label, SaldoAcumulado: cumulative }
    })
  }
  return customMonthlySummaries.map((item) => {
    cumulative += item.balance
    return { month: formatMonthShort(item.month), SaldoAcumulado: cumulative }
  })
}

// ─── Trend Data ─────────────────────────────────────────────────────────────

/**
 * Monta dados de tendência (expense/income) para o período customizado.
 */
export function buildCustomTrendData(
  isSingleMonth: boolean,
  customDailySummaries: CustomDailySummary[],
  customMonthlySummaries: CustomMonthlySummary[],
  categoryDataByDay: Record<string, any[]>,
  categoryDataByMonth: Record<string, any[]>,
  series: Array<{ key: string }>,
  getId: (item: any) => string,
): Array<Record<string, string | number>> {
  if (isSingleMonth) {
    return customDailySummaries.map((summary) => {
      const row: Record<string, string | number> = { month: summary.label }
      const dayCategories = categoryDataByDay[summary.date] ?? []
      series.forEach((s) => {
        const match = dayCategories.find((item) => getId(item) === s.key)
        row[s.key] = (match as any)?.total ?? 0
      })
      return row
    })
  }

  return customMonthlySummaries.map((summary) => {
    const row: Record<string, string | number> = { month: formatMonthShort(summary.month) }
    const monthCategories = categoryDataByMonth[summary.month] ?? []
    series.forEach((s) => {
      const match = monthCategories.find((item) => getId(item) === s.key)
      row[s.key] = (match as any)?.total ?? 0
    })
    return row
  })
}

// ─── Consolidated Summary ───────────────────────────────────────────────────

/**
 * Calcula valores consolidados (totais + balance) para o período customizado.
 */
export function buildCustomConsolidatedSummary(
  customExpenses: DetailExpenseEntry[],
  customIncomes: DetailIncomeEntry[],
  customPortfolioTransactions: PortfolioTxPick[],
  debts: Array<{ due_date: string; type: string; status: string; amount: number }>,
  customStartDate: string,
  customEndDate: string,
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): { total_income: number; total_expenses: number; total_investments: number; balance: number } {
  const rawExpenses = customExpenses.reduce((sum, exp) => sum + getAmountByMode(exp), 0)
  const paidPayables = debts
    .filter(
      (d) =>
        d.due_date >= customStartDate &&
        d.due_date <= customEndDate &&
        d.type === 'payable' &&
        d.status === 'paid',
    )
    .reduce((sum, d) => sum + d.amount, 0)
  const totalExpenses = rawExpenses + paidPayables

  const rawIncomes = customIncomes.reduce((sum, inc) => sum + getAmountByMode(inc), 0)
  const paidReceivables = debts
    .filter(
      (d) =>
        d.due_date >= customStartDate &&
        d.due_date <= customEndDate &&
        d.type === 'receivable' &&
        d.status === 'paid',
    )
    .reduce((sum, d) => sum + d.amount, 0)
  const totalIncomes = rawIncomes + paidReceivables

  const totalInvestments = customPortfolioTransactions.reduce((sum, tx) => {
    return sum + transactionInvestmentAmount(tx.operation_type, Number(tx.quantity), Number(tx.price))
  }, 0)

  const balance = totalIncomes - totalExpenses - totalInvestments

  return { total_income: totalIncomes, total_expenses: totalExpenses, total_investments: totalInvestments, balance }
}

// ─── Daily Consolidated Data ────────────────────────────────────────────────

/**
 * Monta fluxo diário consolidado para o período customizado.
 */
export function buildCustomDailyConsolidated(
  customStartDate: string,
  customEndDate: string,
  customExpenses: DetailExpenseEntry[],
  customIncomes: DetailIncomeEntry[],
  customPortfolioTransactions: PortfolioTxPick[],
  debts: Array<{ due_date: string; type: string; status: string; amount: number }>,
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): CustomDailyFlowRow[] {
  if (!customStartDate || !customEndDate) return []

  const start = new Date(`${customStartDate}T00:00:00`)
  const end = new Date(`${customEndDate}T00:00:00`)

  // Proteção de loop infinito para ranges gigantes
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays > 366) {
    end.setTime(start.getTime() + 366 * 24 * 60 * 60 * 1000)
  }

  const totalsByDay: CustomDailyFlowRow[] = []
  const current = new Date(start)

  while (current <= end) {
    const yyyy = current.getFullYear()
    const mm = String(current.getMonth() + 1).padStart(2, '0')
    const dd = String(current.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    const label = `${dd}/${mm}`
    totalsByDay.push({
      day: dateStr,
      date: dateStr,
      label,
      Rendas: 0,
      Despesas: 0,
      Investimentos: 0,
    })
    current.setDate(current.getDate() + 1)
  }

  customExpenses.forEach((expense) => {
    const match = totalsByDay.find((d) => d.date === expense.date)
    if (match) match.Despesas += getAmountByMode(expense)
  })

  customIncomes.forEach((income) => {
    const match = totalsByDay.find((d) => d.date === income.date)
    if (match) match.Rendas += getAmountByMode(income)
  })

  const customRangeDebts = debts.filter(
    (d) => d.due_date >= customStartDate && d.due_date <= customEndDate,
  )
  customRangeDebts.forEach((debt) => {
    if (debt.status !== 'paid') return
    const match = totalsByDay.find((d) => d.date === debt.due_date)
    if (match) {
      if (debt.type === 'payable') {
        match.Despesas += debt.amount
      } else {
        match.Rendas += debt.amount
      }
    }
  })

  customPortfolioTransactions.forEach((tx) => {
    const match = totalsByDay.find((d) => d.date === tx.date)
    if (match) {
      match.Investimentos += transactionInvestmentAmount(
        tx.operation_type,
        Number(tx.quantity),
        Number(tx.price),
      )
    }
  })

  return totalsByDay
}

// ─── Weekday Data ───────────────────────────────────────────────────────────

/**
 * Monta distribuição semanal para o período customizado.
 */
export function buildCustomWeekdayData(
  customExpenses: DetailExpenseEntry[],
  customIncomes: DetailIncomeEntry[],
  customPortfolioTransactions: PortfolioTxPick[],
  getAmountByMode: (entry: { amount: number; report_weight?: number | null }) => number,
): Array<{ dia: string; Despesas: number; Rendas: number; Investimentos: number }> {
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const totals = labels.map((label) => ({
    dia: label,
    Despesas: 0,
    Rendas: 0,
    Investimentos: 0,
  }))

  customExpenses.forEach((expense) => {
    const localDate = new Date(`${expense.date}T00:00:00`)
    if (Number.isNaN(localDate.getTime())) return
    const mondayFirstIndex = (localDate.getDay() + 6) % 7
    totals[mondayFirstIndex].Despesas += getAmountByMode(expense)
  })

  customIncomes.forEach((income) => {
    const localDate = new Date(`${income.date}T00:00:00`)
    if (Number.isNaN(localDate.getTime())) return
    const mondayFirstIndex = (localDate.getDay() + 6) % 7
    totals[mondayFirstIndex].Rendas += getAmountByMode(income)
  })

  customPortfolioTransactions.forEach((tx) => {
    const localDate = new Date(`${tx.date}T00:00:00`)
    if (Number.isNaN(localDate.getTime())) return
    const mondayFirstIndex = (localDate.getDay() + 6) % 7
    totals[mondayFirstIndex].Investimentos += transactionInvestmentAmount(
      tx.operation_type,
      Number(tx.quantity),
      Number(tx.price),
    )
  })

  return totals
}

// ─── Base Totals Maps ───────────────────────────────────────────────────────

/**
 * Constrói mapa de totais base por categoria (sem pesos).
 */
export function buildBaseTotalsMap<T extends { amount: number }>(
  items: T[],
  getKey: (item: T) => string,
): Map<string, number> {
  const map = new Map<string, number>()
  items.forEach((item) => {
    const key = getKey(item)
    map.set(key, (map.get(key) || 0) + item.amount)
  })
  return map
}
