/**
 * Funções puras de agregação para relatórios financeiros.
 * Extraídas de Reports.tsx para serem testáveis e reutilizáveis.
 */
import type { Debt, MonthlySummary, PortfolioTransaction } from '@/types'
import type { ExpenseCategorySummary, IncomeCategorySummary, PieDatum, TrendSeriesMeta, DetailType } from '@/types/reports'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS } from '@/types/reports'
import { formatMonthShort } from '@/utils/format'
import { transactionInvestmentAmount } from '@/utils/portfolioMonthlyFlow'
import {
  getCategoryColorForPalette,
  assignUniquePaletteColors,
  type ColorPalette,
} from '@/utils/categoryColors'

/**
 * Mescla summaries mensais com dívidas pagas (recebíveis e pagáveis).
 */
export function mergeSummariesWithDebts(
  summaries: MonthlySummary[],
  debts: Debt[],
): MonthlySummary[] {
  return summaries.map((s) => {
    const monthDebts = debts.filter((d) => d.due_date.startsWith(s.month))

    const paidReceivables = monthDebts
      .filter((d) => d.type === 'receivable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)

    const paidPayables = monthDebts
      .filter((d) => d.type === 'payable' && d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0)

    const total_income = s.total_income + paidReceivables
    const total_expenses = s.total_expenses + paidPayables
    const balance = total_income - total_expenses - s.total_investments

    return { ...s, total_income, total_expenses, balance }
  })
}

/**
 * Mapa de cores por categoria de despesa.
 */
export function buildExpenseCategoryColorMap(
  categories: Array<{ id: string; color: string }>,
  palette: ColorPalette,
): Record<string, string> {
  const assigned = assignUniquePaletteColors(categories, palette)
  const map: Record<string, string> = {}
  categories.forEach((c, i) => {
    if (c?.id) map[c.id] = assigned[i] ?? getCategoryColorForPalette(c.color, palette)
  })
  return map
}

/**
 * Mapa de cores por categoria de renda.
 */
export function buildIncomeCategoryColorMap(
  incomeCategories: Array<{ id: string; color: string }>,
  palette: ColorPalette,
): Record<string, string> {
  const assigned = assignUniquePaletteColors(incomeCategories, palette)
  const map: Record<string, string> = {}
  incomeCategories.forEach((c, i) => {
    if (c?.id) map[c.id] = assigned[i] ?? getCategoryColorForPalette(c.color, palette)
  })
  return map
}

/**
 * Filtra e soma dívidas pagas (recebíveis ou pagáveis) que começam com um prefixo de data.
 */
export function computePaidDebtsTotals(
  debts: Debt[],
  datePrefix: string,
): { paidReceivables: number; paidPayables: number } {
  const filtered = debts.filter((d) => d.due_date.startsWith(datePrefix) && d.status === 'paid')
  const paidReceivables = filtered
    .filter((d) => d.type === 'receivable')
    .reduce((sum, d) => sum + d.amount, 0)
  const paidPayables = filtered
    .filter((d) => d.type === 'payable')
    .reduce((sum, d) => sum + d.amount, 0)
  return { paidReceivables, paidPayables }
}

/**
 * Filtra e soma dívidas pagas em um intervalo de datas.
 */
export function computePaidDeptsInRange(
  debts: Debt[],
  startDate: string,
  endDate: string,
): { paidReceivables: number; paidPayables: number } {
  const filtered = debts.filter(
    (d) => d.due_date >= startDate && d.due_date <= endDate && d.status === 'paid',
  )
  const paidReceivables = filtered
    .filter((d) => d.type === 'receivable')
    .reduce((sum, d) => sum + d.amount, 0)
  const paidPayables = filtered
    .filter((d) => d.type === 'payable')
    .reduce((sum, d) => sum + d.amount, 0)
  return { paidReceivables, paidPayables }
}

/**
 * Constrói a série de dados mensais para gráfico de fluxo anual.
 */
export function buildMonthlyFlowData(
  summaries: MonthlySummary[],
  prevSummaries: MonthlySummary[],
  compareWithPrevious: boolean,
): Array<{
  month: string
  Rendas: number
  Despesas: number
  Investimentos: number
  Saldo: number
  'Rendas (Ano Ant.)'?: number
  'Despesas (Ano Ant.)'?: number
  'Investimentos (Ano Ant.)'?: number
}> {
  return summaries.map((s: MonthlySummary, idx) => {
    const prev = prevSummaries[idx]
    return {
      month: formatMonthShort(s.month),
      Rendas: s.total_income,
      Despesas: s.total_expenses,
      Investimentos: s.total_investments,
      Saldo: s.balance,
      ...(compareWithPrevious && prev
        ? {
            'Rendas (Ano Ant.)': prev.total_income,
            'Despesas (Ano Ant.)': prev.total_expenses,
            'Investimentos (Ano Ant.)': prev.total_investments,
          }
        : {}),
    }
  })
}

/**
 * Constrói dados de saldo acumulado.
 */
export function buildCumulativeBalanceData(
  summaries: MonthlySummary[],
  prevSummaries: MonthlySummary[],
  compareWithPrevious: boolean,
): Array<{
  month: string
  SaldoAcumulado: number
  'Saldo Acumulado (Ano Ant.)'?: number
}> {
  let cumulative = 0
  let prevCumulative = 0
  return summaries.map((item: MonthlySummary, idx) => {
    cumulative += item.balance
    const prevItem = prevSummaries[idx]
    if (prevItem) prevCumulative += prevItem.balance
    return {
      month: formatMonthShort(item.month),
      SaldoAcumulado: cumulative,
      ...(compareWithPrevious && prevItem
        ? { 'Saldo Acumulado (Ano Ant.)': prevCumulative }
        : {}),
    }
  })
}

/**
 * Totais anuais (income, expenses, investments, balance).
 */
export function computeAnnualTotals(summaries: MonthlySummary[]): {
  income: number
  expenses: number
  investments: number
  balance: number
} {
  return summaries.reduce(
    (acc, month) => ({
      income: acc.income + month.total_income,
      expenses: acc.expenses + month.total_expenses,
      investments: acc.investments + month.total_investments,
      balance: acc.balance + month.balance,
    }),
    { income: 0, expenses: 0, investments: 0, balance: 0 },
  )
}

/**
 * Cria séries de tendência (TrendSeriesMeta) a partir de categorias.
 */
export function buildTrendSeries<T extends { color: string }>(
  items: T[],
  getKey: (item: T) => string,
  getName: (item: T) => string,
  getColor: (item: T) => string,
  sortByTotal?: (items: T[]) => T[],
): TrendSeriesMeta[] {
  const sorted = sortByTotal ? sortByTotal([...items]) : items
  return sorted.map((item) => ({
    key: getKey(item),
    name: getName(item),
    color: getColor(item),
  }))
}

/**
 * Filtra dados de tendência removendo linhas onde todas as séries estão zeradas.
 */
export function filterVisibleTrendData(
  data: Array<Record<string, string | number>>,
  series: TrendSeriesMeta[],
): Array<Record<string, string | number>> {
  if (series.length === 0) return []
  return data.filter((row) =>
    series.some((s) => Number(row[s.key] ?? 0) > 0),
  )
}

/**
 * Constrói breakdown de meios de pagamento (métodos + cartões).
 */
export function buildPaymentMethodsBreakdown(
  expenses: Array<{ payment_method?: string | null; credit_card_id?: string | null; amount: number }>,
  creditCards: Array<{ id: string; name?: string | null; color?: string | null }>,
  getAmount: (entry: { amount: number }) => number,
): PieDatum[] {
  const methodsMap = new Map<string, number>()
  const cardsMap = new Map<string, number>()

  expenses.forEach((exp) => {
    const amount = getAmount(exp)
    if (exp.payment_method === 'credit_card' && exp.credit_card_id) {
      cardsMap.set(exp.credit_card_id, (cardsMap.get(exp.credit_card_id) || 0) + amount)
    } else {
      const method = exp.payment_method || 'other'
      methodsMap.set(method, (methodsMap.get(method) || 0) + amount)
    }
  })

  const results: PieDatum[] = []

  Array.from(methodsMap.entries())
    .filter(([method]) => method !== 'credit_card')
    .forEach(([method, total]) => {
      results.push({
        name: PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.other,
        value: total,
        color: PAYMENT_METHOD_COLORS[method] || PAYMENT_METHOD_COLORS.other,
        categoryId: method,
        detailType: 'payment_method' as DetailType,
        detailPeriod: 'month' as const,
      })
    })

  Array.from(cardsMap.entries()).forEach(([cardId, total]) => {
    const card = creditCards.find((c) => c.id === cardId)
    results.push({
      name: card?.name ? `Cartão ${card.name}` : 'Cartão Desconhecido',
      value: total,
      color: card?.color || 'var(--payment-method-credit-card)',
      categoryId: cardId,
      detailType: 'credit_card' as const,
      detailPeriod: 'month' as const,
    })
  })

  return results
}

/**
 * Constrói dados de distribuição semanal (dia da semana).
 */
export function buildWeekdayTotals(
  expenses: Array<{ date: string; amount: number }>,
  incomes: Array<{ date: string; amount: number }>,
  transactions: Array<{ date: string; operation_type: string; quantity: number; price: number }>,
  getAmount: (entry: { amount: number }) => number,
): Array<{ dia: string; Despesas: number; Rendas: number; Investimentos: number }> {
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const totals = labels.map((label) => ({
    dia: label,
    Despesas: 0,
    Rendas: 0,
    Investimentos: 0,
  }))

  expenses.forEach((expense) => {
    const localDate = new Date(`${expense.date}T00:00:00`)
    if (Number.isNaN(localDate.getTime())) return
    const mondayFirstIndex = (localDate.getDay() + 6) % 7
    totals[mondayFirstIndex].Despesas += getAmount(expense)
  })

  incomes.forEach((income) => {
    const localDate = new Date(`${income.date}T00:00:00`)
    if (Number.isNaN(localDate.getTime())) return
    const mondayFirstIndex = (localDate.getDay() + 6) % 7
    totals[mondayFirstIndex].Rendas += getAmount(income)
  })

  transactions.forEach((tx) => {
    const localDate = new Date(`${tx.date}T00:00:00`)
    if (Number.isNaN(localDate.getTime())) return
    const mondayFirstIndex = (localDate.getDay() + 6) % 7
    totals[mondayFirstIndex].Investimentos += transactionInvestmentAmount(
      tx.operation_type as PortfolioTransaction['operation_type'],
      tx.quantity,
      tx.price,
    )
  })

  return totals
}

/**
 * Calcula summary consolidado (totais + balance) para um período customizado.
 */
export function computeConsolidatedSummary(
  totalExpenses: number,
  totalIncomes: number,
  totalInvestments: number,
): { total_income: number; total_expenses: number; total_investments: number; balance: number } {
  const balance = totalIncomes - totalExpenses - totalInvestments
  return {
    total_income: totalIncomes,
    total_expenses: totalExpenses,
    total_investments: totalInvestments,
    balance,
  }
}

/**
 * Gera lista de meses entre duas datas (inclusive).
 */
export function generateMonthsRange(
  startDate: string,
  endDate: string,
): string[] {
  const startYear = parseInt(startDate.slice(0, 4))
  const startMonth = parseInt(startDate.slice(5, 7))
  const endYear = parseInt(endDate.slice(0, 4))
  const endMonth = parseInt(endDate.slice(5, 7))

  const monthsList: string[] = []
  let currYear = startYear
  let currMonth = startMonth

  while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
    monthsList.push(`${currYear}-${String(currMonth).padStart(2, '0')}`)
    currMonth++
    if (currMonth > 12) {
      currMonth = 1
      currYear++
    }
  }
  return monthsList
}

/**
 * Gera lista de dias entre duas datas (inclusive), com safety limit de 366 dias.
 */
export function generateDaysRange(
  startDate: string,
  endDate: string,
): string[] {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays > 366) return []

  const daysList: string[] = []
  const current = new Date(start)
  while (current <= end) {
    const yyyy = current.getFullYear()
    const mm = String(current.getMonth() + 1).padStart(2, '0')
    const dd = String(current.getDate()).padStart(2, '0')
    daysList.push(`${yyyy}-${mm}-${dd}`)
    current.setDate(current.getDate() + 1)
  }
  return daysList
}

/**
 * Cria um PieDatum a partir de uma categoria de despesa.
 */
export function toExpensePieDatum(
  cat: ExpenseCategorySummary,
  categories: Array<{ id: string; color: string }>,
  baseTotalsMap: Map<string, number>,
  getColor: (id: string, fallback: string) => string,
  detailPeriod: 'month' | 'year' = 'month',
): PieDatum {
  const matched = categories.find((c) => c.id === cat.category_id)
  const [_, iconName] = (matched?.color || cat.color || '').split('|')
  return {
    categoryId: cat.category_id,
    name: cat.category_name,
    value: cat.total,
    baseValue: baseTotalsMap.get(cat.category_id) ?? cat.total,
    detailType: 'expense' as DetailType,
    detailPeriod,
    color: getColor(cat.category_id, cat.color),
    iconName,
  }
}

/**
 * Cria um PieDatum a partir de uma categoria de renda.
 */
export function toIncomePieDatum(
  cat: IncomeCategorySummary,
  incomeCategories: Array<{ id: string; color: string }>,
  baseTotalsMap: Map<string, number>,
  getColor: (id: string, fallback: string) => string,
  detailPeriod: 'month' | 'year' = 'month',
): PieDatum {
  const matched = incomeCategories.find((c) => c.id === cat.income_category_id)
  const [_, iconName] = (matched?.color || cat.color || '').split('|')
  return {
    categoryId: cat.income_category_id,
    name: cat.category_name,
    value: cat.total,
    baseValue: baseTotalsMap.get(cat.income_category_id) ?? cat.total,
    detailType: 'income' as DetailType,
    detailPeriod,
    color: getColor(cat.income_category_id, cat.color),
    iconName,
  }
}

/**
 * Calcula pendências do período (dívidas pendentes).
 */
export function computePeriodPending(
  debts: Debt[],
  period: string,
): { payables: number; receivables: number; balanceProj: number; count: number } {
  const filtered = debts.filter((d) => d.due_date.startsWith(period) && d.status === 'pending')
  const payables = filtered
    .filter((d) => d.type === 'payable')
    .reduce((sum, d) => sum + d.amount, 0)
  const receivables = filtered
    .filter((d) => d.type === 'receivable')
    .reduce((sum, d) => sum + d.amount, 0)
  return {
    payables,
    receivables,
    balanceProj: receivables - payables,
    count: filtered.length,
  }
}

/**
 * Calcula pendências em um intervalo de datas.
 */
export function computePeriodPendingInRange(
  debts: Debt[],
  startDate: string,
  endDate: string,
): { payables: number; receivables: number; balanceProj: number; count: number } {
  const filtered = debts.filter(
    (d) => d.due_date >= startDate && d.due_date <= endDate && d.status === 'pending',
  )
  const payables = filtered
    .filter((d) => d.type === 'payable')
    .reduce((sum, d) => sum + d.amount, 0)
  const receivables = filtered
    .filter((d) => d.type === 'receivable')
    .reduce((sum, d) => sum + d.amount, 0)
  return {
    payables,
    receivables,
    balanceProj: receivables - payables,
    count: filtered.length,
  }
}
