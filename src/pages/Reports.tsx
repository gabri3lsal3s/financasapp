import { useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import { PAGE_HEADERS } from '@/constants/pages'
import { useReports } from '@/hooks/useReports'
import { useIncomeReports } from '@/hooks/useIncomeReports'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useInvestments } from '@/hooks/useInvestments'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { formatCurrency, formatMonth, formatMonthShort, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'

const startYear = 2025
type ViewMode = 'year' | 'month'

type MonthlySummary = {
  month: string
  total_income: number
  total_expenses: number
  total_investments: number
  balance: number
}

type ExpenseCategorySummary = {
  category_id: string
  category_name: string
  total: number
  color: string
}

type IncomeCategorySummary = {
  income_category_id: string
  category_name: string
  total: number
  color: string
}

type PieDatum = {
  name: string
  value: number
  color: string
}

function ChartTooltip({ active, payload, formatValue = formatCurrency }: { active?: boolean; payload?: any[]; formatValue?: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="text-sm font-medium">
          {entry.name}: {formatValue(Number(entry.value))}
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload

  return (
    <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
      <p className="text-sm font-medium text-primary">{point.name}</p>
      <p className="text-sm text-secondary">{formatCurrency(point.value)}</p>
    </div>
  )
}

export default function Reports() {
  const currentYear = new Date().getFullYear()
  const currentMonth = getCurrentMonthString()
  const years = Array.from(
    { length: Math.max(1, currentYear - startYear + 1) },
    (_, i) => startYear + i
  )

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [viewMode, setViewMode] = useState<ViewMode>('year')

  const { colorPalette } = usePaletteColors()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { monthlySummaries, categoryExpenses, monthlyCategoryExpenses, loading } = useReports(selectedYear)
  const { incomeByCategory, monthlyIncomeByCategory, loading: loadingIncomes } = useIncomeReports(selectedYear)
  const { expenses: monthExpenses, loading: loadingMonthExpenses } = useExpenses(selectedMonth)
  const { incomes: monthIncomes, loading: loadingMonthIncomes } = useIncomes(selectedMonth)
  const { investments: monthInvestments, loading: loadingMonthInvestments } = useInvestments(selectedMonth)

  const expenseCategoryIdToColor = useMemo(() => {
    const assigned = assignUniquePaletteColors(categories, colorPalette)
    const map: Record<string, string> = {}
    categories.forEach((c, i) => {
      if (c?.id) map[c.id] = assigned[i] ?? getCategoryColorForPalette(c.color, colorPalette)
    })
    return map
  }, [categories, colorPalette])

  const incomeCategoryIdToColor = useMemo(() => {
    const assigned = assignUniquePaletteColors(incomeCategories, colorPalette)
    const map: Record<string, string> = {}
    incomeCategories.forEach((c, i) => {
      if (c?.id) map[c.id] = assigned[i] ?? getCategoryColorForPalette(c.color, colorPalette)
    })
    return map
  }, [incomeCategories, colorPalette])

  const getExpenseColor = (categoryId: string, fallback: string) =>
    expenseCategoryIdToColor[categoryId] ?? fallback
  const getIncomeColor = (categoryId: string, fallback: string) =>
    incomeCategoryIdToColor[categoryId] ?? fallback

  const monthlyData = useMemo(
    () =>
      monthlySummaries.map((s: MonthlySummary) => ({
        month: formatMonthShort(s.month),
        Rendas: s.total_income,
        Despesas: s.total_expenses,
        Investimentos: s.total_investments,
        Saldo: s.balance,
      })),
    [monthlySummaries]
  )

  const annualPieExpenses = useMemo(
    () =>
      categoryExpenses.map((cat: ExpenseCategorySummary) => ({
        name: cat.category_name,
        value: cat.total,
        color: getExpenseColor(cat.category_id, cat.color),
      })),
    [categoryExpenses, expenseCategoryIdToColor]
  )

  const annualPieIncomes = useMemo(
    () =>
      incomeByCategory.map((cat) => ({
        name: cat.category_name,
        value: cat.total,
        color: getIncomeColor(cat.income_category_id, cat.color),
      })),
    [incomeByCategory, incomeCategoryIdToColor]
  )

  const cumulativeBalanceData = useMemo(() => {
    let cumulative = 0
    return monthlySummaries.map((item: MonthlySummary) => {
      cumulative += item.balance
      return {
        month: formatMonthShort(item.month),
        SaldoAcumulado: cumulative,
      }
    })
  }, [monthlySummaries])

  const annualTotals = useMemo(() => {
    return monthlySummaries.reduce(
      (acc: { income: number; expenses: number; investments: number; balance: number }, month: MonthlySummary) => ({
        income: acc.income + month.total_income,
        expenses: acc.expenses + month.total_expenses,
        investments: acc.investments + month.total_investments,
        balance: acc.balance + month.balance,
      }),
      { income: 0, expenses: 0, investments: 0, balance: 0 }
    )
  }, [monthlySummaries])

  const monthSummary = monthlySummaries.find((s) => s.month === selectedMonth)
  const monthExpenseCategories = selectedMonth ? (monthlyCategoryExpenses[selectedMonth] ?? []) : []
  const monthIncomeCategories = selectedMonth ? (monthlyIncomeByCategory[selectedMonth] ?? []) : []
  const monthPieExpenses = monthExpenseCategories.map((cat: ExpenseCategorySummary) => ({
    name: cat.category_name,
    value: cat.total,
    color: getExpenseColor(cat.category_id, cat.color),
  }))
  const monthPieIncomes = monthIncomeCategories.map((cat: IncomeCategorySummary) => ({
    name: cat.category_name,
    value: cat.total,
    color: getIncomeColor(cat.income_category_id, cat.color),
  }))

  const monthQuickData = useMemo(() => {
    if (!monthSummary) {
      return []
    }

    return [
      {
        month: formatMonthShort(selectedMonth),
        Rendas: monthSummary.total_income,
        Despesas: monthSummary.total_expenses,
        Investimentos: monthSummary.total_investments,
      },
    ]
  }, [monthSummary, selectedMonth])

  const dailyConsolidatedData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)

    if (!year || !month) {
      return []
    }

    const daysInMonth = new Date(year, month, 0).getDate()
    const totalsByDay = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      label: String(index + 1).padStart(2, '0'),
      Rendas: 0,
      Despesas: 0,
      Investimentos: 0,
    }))

    monthExpenses.forEach((expense) => {
      if (!expense.date?.startsWith(selectedMonth)) {
        return
      }

      const day = Number(expense.date.slice(8, 10))
      if (day >= 1 && day <= daysInMonth) {
        totalsByDay[day - 1].Despesas += expense.amount
      }
    })

    monthIncomes.forEach((income) => {
      if (!income.date?.startsWith(selectedMonth)) {
        return
      }

      const day = Number(income.date.slice(8, 10))
      if (day >= 1 && day <= daysInMonth) {
        totalsByDay[day - 1].Rendas += income.amount
      }
    })

    monthInvestments.forEach((investment) => {
      if (!investment.created_at) {
        return
      }

      const createdDate = new Date(investment.created_at)
      if (Number.isNaN(createdDate.getTime())) {
        return
      }

      const yearPart = createdDate.getFullYear()
      const monthPart = createdDate.getMonth() + 1

      if (yearPart !== year || monthPart !== month) {
        return
      }

      const day = createdDate.getDate()
      if (day >= 1 && day <= daysInMonth) {
        totalsByDay[day - 1].Investimentos += investment.amount
      }
    })

    return totalsByDay
  }, [monthExpenses, monthIncomes, monthInvestments, selectedMonth])

  const weekdayExpenseData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const totals = labels.map((label) => ({
      dia: label,
      Despesas: 0,
    }))

    monthExpenses.forEach((expense) => {
      if (!expense.date?.startsWith(selectedMonth)) {
        return
      }

      const localDate = new Date(`${expense.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) {
        return
      }

      const dayOfWeek = localDate.getDay()
      const mondayFirstIndex = (dayOfWeek + 6) % 7
      totals[mondayFirstIndex].Despesas += expense.amount
    })

    return totals
  }, [monthExpenses, selectedMonth])

  const topWeekdayExpense = useMemo(() => {
    if (weekdayExpenseData.length === 0) {
      return null
    }

    return weekdayExpenseData.reduce((highest, current) =>
      current.Despesas > highest.Despesas ? current : highest
    )
  }, [weekdayExpenseData])

  const monthExpenseTotal = useMemo(
    () => monthExpenseCategories.reduce((sum, cat) => sum + cat.total, 0),
    [monthExpenseCategories]
  )

  const monthIncomeTotal = useMemo(
    () => monthIncomeCategories.reduce((sum, cat) => sum + cat.total, 0),
    [monthIncomeCategories]
  )

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      return { value: `${selectedYear}-${m}`, label: formatMonthShort(`${selectedYear}-${m}`) }
    })
  }, [selectedYear])

  const loadingState = loading || loadingIncomes || loadingMonthExpenses || loadingMonthIncomes || loadingMonthInvestments
  const savingsRate = monthSummary && monthSummary.total_income > 0
    ? ((monthSummary.balance / monthSummary.total_income) * 100)
    : 0

  const controlButtonClasses = (mode: ViewMode) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      viewMode === mode
        ? 'bg-tertiary accent-primary border border-primary'
        : 'text-primary hover:bg-tertiary border border-primary'
    }`

  const selectClasses = 'w-full px-4 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'

  const renderPieCard = (title: string, data: PieDatum[]) => (
    <Card className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-primary mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-secondary">Sem dados para exibir.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={86}
                labelLine={false}
                label={false}
                fill="var(--color-primary)"
              >
                {data.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2 mt-3">
            {data
              .slice()
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map((item) => {
                const total = data.reduce((sum, current) => sum + current.value, 0)
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'

                return (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-primary truncate">{item.name}</span>
                    </div>
                    <span className="text-secondary flex-shrink-0">{pct}%</span>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </Card>
  )

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.reports.title} subtitle={PAGE_HEADERS.reports.description} />

      <div className="p-4 lg:p-6 space-y-6">
        <Card>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">Visualização</label>
              <div className="flex items-center gap-2">
                <button type="button" className={controlButtonClasses('year')} onClick={() => setViewMode('year')}>
                  Ano
                </button>
                <button type="button" className={controlButtonClasses('month')} onClick={() => setViewMode('month')}>
                  Mês
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Ano</label>
              <select
                value={selectedYear}
                onChange={(event) => {
                  const year = parseInt(event.target.value)
                  setSelectedYear(year)
                  const fallbackMonth = `${year}-01`
                  setSelectedMonth(year === currentYear ? currentMonth : fallbackMonth)
                }}
                className={selectClasses}
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Mês</label>
              <select
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value)
                  setViewMode('month')
                }}
                className={selectClasses}
              >
                {yearMonths.map((monthOption) => (
                  <option key={monthOption.value} value={monthOption.value}>{monthOption.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {loadingState ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : (
          <>
            {viewMode === 'year' ? (
              <div className="space-y-4 lg:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Rendas no ano</p>
                    <p className="text-2xl font-bold mt-2 text-income">{formatCurrency(annualTotals.income)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Despesas no ano</p>
                    <p className="text-2xl font-bold mt-2 text-expense">{formatCurrency(annualTotals.expenses)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Investimentos no ano</p>
                    <p className="text-2xl font-bold mt-2 text-balance">{formatCurrency(annualTotals.investments)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Saldo anual</p>
                    <p className="text-2xl font-bold mt-2" style={{ color: annualTotals.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                      {formatCurrency(annualTotals.balance)}
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <Card className="h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-primary mb-4">Fluxo mensal ({selectedYear})</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                        <YAxis
                          stroke="var(--color-text-secondary)"
                          fontSize={12}
                          tick={{ fill: 'var(--color-text-secondary)' }}
                          tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-primary mb-4">Saldo acumulado ({selectedYear})</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={cumulativeBalanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                        <YAxis
                          stroke="var(--color-text-secondary)"
                          fontSize={12}
                          tick={{ fill: 'var(--color-text-secondary)' }}
                          tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="SaldoAcumulado" stroke="var(--color-primary)" fill="var(--color-hover)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                  {renderPieCard(`Despesas por categoria (${selectedYear})`, annualPieExpenses)}
                  {renderPieCard(`Rendas por categoria (${selectedYear})`, annualPieIncomes)}
                </div>

              </div>
            ) : monthSummary ? (
              <div className="space-y-4 lg:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Rendas de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-income">{formatCurrency(monthSummary.total_income)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Despesas de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-expense">{formatCurrency(monthSummary.total_expenses)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Investimentos de {formatMonth(selectedMonth)}</p>
                    <p className="text-2xl font-bold mt-2 text-balance">{formatCurrency(monthSummary.total_investments)}</p>
                  </Card>
                  <Card className="h-full">
                    <p className="text-sm text-secondary">Taxa de saldo do mês</p>
                    <p className="text-2xl font-bold mt-2" style={{ color: savingsRate >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
                      {`${savingsRate.toFixed(1)}%`}
                    </p>
                  </Card>
                </div>

                <Card>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-primary">Fluxo diário consolidado ({formatMonth(selectedMonth)})</h3>
                    <span className="text-sm text-secondary">Rendas, despesas e investimentos por dia</span>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyConsolidatedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        minTickGap={12}
                      />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <Card className="h-full flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-primary lg:whitespace-nowrap">Composição do mês</h3>
                      <div className="text-sm text-secondary">
                        <span>Saldo do mês: </span>
                        <span
                          className="font-bold"
                          style={{ color: monthSummary.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
                        >
                          {formatCurrency(monthSummary.balance)}
                        </span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthQuickData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                        <YAxis
                          stroke="var(--color-text-secondary)"
                          fontSize={12}
                          tick={{ fill: 'var(--color-text-secondary)' }}
                          tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Bar dataKey="Rendas" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Despesas" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Investimentos" fill="var(--color-balance)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="h-full flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-primary lg:whitespace-nowrap">Gastos por dia da semana</h3>
                      <div className="text-sm text-secondary">
                        {topWeekdayExpense && topWeekdayExpense.Despesas > 0
                          ? `Maior gasto: ${topWeekdayExpense.dia} (${formatCurrency(topWeekdayExpense.Despesas)})`
                          : `Distribuição semanal de despesas em ${formatMonth(selectedMonth)}`}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={weekdayExpenseData}>
                        <PolarGrid stroke="var(--color-border)" />
                        <PolarAngleAxis dataKey="dia" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Radar
                          name="Despesas"
                          dataKey="Despesas"
                          stroke="var(--color-expense)"
                          fill="var(--color-expense)"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                  {renderPieCard(`Despesas por categoria (${formatMonth(selectedMonth)})`, monthPieExpenses)}
                  {renderPieCard(`Rendas por categoria (${formatMonth(selectedMonth)})`, monthPieIncomes)}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                  <Card className="h-full">
                    <h3 className="text-lg font-semibold text-primary mb-4">Detalhamento despesas</h3>
                    <div className="space-y-3">
                      {[...monthExpenseCategories]
                        .sort((a, b) => b.total - a.total)
                        .map((category) => {
                          const color = getExpenseColor(category.category_id, category.color)
                          const pct = monthExpenseTotal > 0 ? (category.total / monthExpenseTotal) * 100 : 0

                          return (
                            <div key={category.category_id}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-primary truncate">{category.category_name}</span>
                                </div>
                                <span className="text-primary font-semibold flex-shrink-0">{formatCurrency(category.total)}</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-secondary">
                                <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <p className="text-xs text-secondary mt-1">{pct.toFixed(1)}% do total</p>
                            </div>
                          )
                        })}
                    </div>
                  </Card>

                  <Card className="h-full">
                    <h3 className="text-lg font-semibold text-primary mb-4">Detalhamento rendas</h3>
                    <div className="space-y-3">
                      {[...monthIncomeCategories]
                        .sort((a, b) => b.total - a.total)
                        .map((category) => {
                          const color = getIncomeColor(category.income_category_id, category.color)
                          const pct = monthIncomeTotal > 0 ? (category.total / monthIncomeTotal) * 100 : 0

                          return (
                            <div key={category.income_category_id}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-primary truncate">{category.category_name}</span>
                                </div>
                                <span className="text-primary font-semibold flex-shrink-0">{formatCurrency(category.total)}</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-secondary">
                                <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <p className="text-xs text-secondary mt-1">{pct.toFixed(1)}% do total</p>
                            </div>
                          )
                        })}
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <p className="text-secondary">Sem dados para o mês selecionado.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
