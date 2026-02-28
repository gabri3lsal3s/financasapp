import { useState, useMemo } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import { PAGE_HEADERS } from '@/constants/pages'
import { useReports } from '@/hooks/useReports'
import { useIncomeReports } from '@/hooks/useIncomeReports'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useInvestments } from '@/hooks/useInvestments'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { formatCurrency, formatMonth, formatMonthShort, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import {
  BarChart,
  Bar,
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
} from 'recharts'

const startYear = 2025

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

export default function Reports() {
  const currentYear = new Date().getFullYear()
  const currentMonth = getCurrentMonthString()
  const years = Array.from(
    { length: Math.max(1, currentYear - startYear + 1) },
    (_, i) => startYear + i
  )

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const { colorPalette } = usePaletteColors()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { monthlySummaries, categoryExpenses, monthlyCategoryExpenses, loading } = useReports(selectedYear)
  const { incomeByCategory, monthlyIncomeByCategory, loading: loadingIncomes } = useIncomeReports(selectedYear)
  const { investments: monthInvestments } = useInvestments(selectedMonth)

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
      monthlySummaries.map((s: { month: string; total_income: number; total_expenses: number; total_investments: number; balance: number }) => ({
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
      categoryExpenses.map((cat: { category_id: string; category_name: string; total: number; color: string }) => ({
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

  const monthSummary = monthlySummaries.find((s) => s.month === selectedMonth)
  const monthExpenseCategories = selectedMonth ? (monthlyCategoryExpenses[selectedMonth] ?? []) : []
  const monthIncomeCategories = selectedMonth ? (monthlyIncomeByCategory[selectedMonth] ?? []) : []
  const monthPieExpenses = monthExpenseCategories.map((cat) => ({
    name: cat.category_name,
    value: cat.total,
    color: getExpenseColor(cat.category_id, cat.color),
  }))
  const monthPieIncomes = monthIncomeCategories.map((cat) => ({
    name: cat.category_name,
    value: cat.total,
    color: getIncomeColor(cat.income_category_id, cat.color),
  }))

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      return { value: `${selectedYear}-${m}`, label: formatMonthShort(`${selectedYear}-${m}`) }
    })
  }, [selectedYear])

  const loadingState = loading || loadingIncomes

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.reports.title} subtitle={PAGE_HEADERS.reports.description} />

      <div className="p-4 lg:p-6 space-y-6">
        <Card>
          <label className="block text-sm font-medium text-primary mb-2">Ano</label>
          <select
            value={selectedYear}
            onChange={(e) => {
              const y = parseInt(e.target.value)
              setSelectedYear(y)
              const firstMonth = `${y}-01`
              setSelectedMonth(y === currentYear ? currentMonth : firstMonth)
            }}
            className="w-full px-4 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </Card>

        {loadingState ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : (
          <>
            {/* Visão geral do ano */}
            <Card>
              <h3 className="text-lg font-semibold text-primary mb-4">Evolução mensal</h3>
              <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                <div className="min-w-full px-4 lg:px-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-primary mb-4">Comparação mensal</h3>
              <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                <div className="min-w-full px-4 lg:px-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Bar dataKey="Rendas" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Investimentos" fill="var(--color-balance)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-primary mb-4">Resumo anual {selectedYear}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-secondary">Total de Rendas</span>
                  <span className="font-semibold" style={{ color: 'var(--color-income)' }}>
                    {formatCurrency(monthlySummaries.reduce((s, m) => s + m.total_income, 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-secondary">Total de Despesas</span>
                  <span className="font-semibold" style={{ color: 'var(--color-expense)' }}>
                    {formatCurrency(monthlySummaries.reduce((s, m) => s + m.total_expenses, 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-secondary">Total de Investimentos</span>
                  <span className="font-semibold" style={{ color: 'var(--color-balance)' }}>
                    {formatCurrency(monthlySummaries.reduce((s: number, m: { total_investments: number }) => s + m.total_investments, 0))}
                  </span>
                </div>
                <div className="border-t border-primary pt-3 mt-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-primary">Saldo anual</span>
                    <span
                      className="font-bold text-lg"
                      style={{
                        color:
                          monthlySummaries.reduce((s: number, m: { balance: number }) => s + m.balance, 0) >= 0
                            ? 'var(--color-income)'
                            : 'var(--color-expense)',
                      }}
                    >
                      {formatCurrency(monthlySummaries.reduce((s: number, m: { balance: number }) => s + m.balance, 0))}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Detalhamento por mês */}
            <Card>
              <h3 className="text-lg font-semibold text-primary mb-2">Detalhamento do mês</h3>
              <label className="block text-sm font-medium text-secondary mb-2">Mês</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {yearMonths.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Card>

            {monthSummary && (
              <>
                <Card>
                  <h3 className="text-lg font-semibold text-primary mb-4">Resumo de {formatMonth(selectedMonth)}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-secondary">Rendas</span>
                      <span className="font-semibold" style={{ color: 'var(--color-income)' }}>
                        {formatCurrency(monthSummary.total_income)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-secondary">Despesas</span>
                      <span className="font-semibold" style={{ color: 'var(--color-expense)' }}>
                        {formatCurrency(monthSummary.total_expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-secondary">Investimentos</span>
                      <span className="font-semibold" style={{ color: 'var(--color-balance)' }}>
                        {formatCurrency(monthSummary.total_investments)}
                      </span>
                    </div>
                    <div className="border-t border-primary pt-3 mt-3">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-primary">Saldo do mês</span>
                        <span
                          className="font-bold text-lg"
                          style={{
                            color: monthSummary.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                          }}
                        >
                          {formatCurrency(monthSummary.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {monthPieExpenses.length > 0 && (
                  <Card>
                    <h3 className="text-lg font-semibold text-primary mb-4">Despesas por categoria</h3>
                    <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                      <div className="min-w-full px-4 lg:px-0">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={monthPieExpenses}
                              cx="50%"
                              cy="45%"
                              labelLine={false}
                              label={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {monthPieExpenses.map((_item: { name: string; value: number; color: string }, i: number) => (
                                <Cell key={`e-${i}`} fill={monthPieExpenses[i].color} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null
                                const p = payload[0].payload
                                return (
                                  <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
                                    <p className="text-sm font-medium text-primary">{p.name}</p>
                                    <p className="text-sm text-secondary">{formatCurrency(p.value)}</p>
                                  </div>
                                )
                              }}
                            />
                            <Legend
                              layout="vertical"
                              align="right"
                              verticalAlign="middle"
                              wrapperStyle={{ paddingLeft: '20px' }}
                              formatter={(value, entry: any) => {
                                const item = monthPieExpenses[entry.index]
                                if (!item) return value
                                const total = monthPieExpenses.reduce((s: number, d: { value: number }) => s + d.value, 0)
                                const pct = total ? ((item.value / total) * 100).toFixed(0) : '0'
                                return `${value} (${pct}%)`
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Card>
                )}

                {monthExpenseCategories.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-primary mb-3">Detalhamento despesas por categoria</h3>
                    <div className="space-y-2">
                      {[...monthExpenseCategories].sort((a, b) => b.total - a.total).map((cat: { category_id: string; category_name: string; total: number; color: string }) => {
                        const total = monthExpenseCategories.reduce((s: number, c: { total: number }) => s + c.total, 0)
                        const pct = total ? (cat.total / total) * 100 : 0
                        const color = getExpenseColor(cat.category_id, cat.color)
                        return (
                          <Card key={cat.category_id} className="py-3">
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-4 h-4 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-medium text-primary truncate">{cat.category_name}</span>
                              </div>
                              <span className="font-semibold text-primary flex-shrink-0">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                            <p className="text-xs text-secondary mt-1">{pct.toFixed(1)}% do total</p>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {monthPieIncomes.length > 0 && (
                  <Card>
                    <h3 className="text-lg font-semibold text-primary mb-4">Rendas por categoria</h3>
                    <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                      <div className="min-w-full px-4 lg:px-0">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={monthPieIncomes}
                              cx="50%"
                              cy="45%"
                              labelLine={false}
                              label={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {monthPieIncomes.map((_item: { name: string; value: number; color: string }, i: number) => (
                                <Cell key={`i-${i}`} fill={monthPieIncomes[i].color} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null
                                const p = payload[0].payload
                                return (
                                  <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
                                    <p className="text-sm font-medium text-primary">{p.name}</p>
                                    <p className="text-sm text-secondary">{formatCurrency(p.value)}</p>
                                  </div>
                                )
                              }}
                            />
                            <Legend
                              layout="vertical"
                              align="right"
                              verticalAlign="middle"
                              wrapperStyle={{ paddingLeft: '20px' }}
                              formatter={(value, entry: any) => {
                                const item = monthPieIncomes[entry.index]
                                if (!item) return value
                                const total = monthPieIncomes.reduce((s: number, d: { value: number }) => s + d.value, 0)
                                const pct = total ? ((item.value / total) * 100).toFixed(0) : '0'
                                return `${value} (${pct}%)`
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Card>
                )}

                {monthIncomeCategories.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-primary mb-3">Detalhamento rendas por categoria</h3>
                    <div className="space-y-2">
                      {[...monthIncomeCategories].sort((a, b) => b.total - a.total).map((cat: { income_category_id: string; category_name: string; total: number; color: string }) => {
                        const total = monthIncomeCategories.reduce((s: number, c: { total: number }) => s + c.total, 0)
                        const pct = total ? (cat.total / total) * 100 : 0
                        const color = getIncomeColor(cat.income_category_id, cat.color)
                        return (
                          <Card key={cat.income_category_id} className="py-3">
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-4 h-4 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-medium text-primary truncate">{cat.category_name}</span>
                              </div>
                              <span className="font-semibold text-primary flex-shrink-0">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                            <p className="text-xs text-secondary mt-1">{pct.toFixed(1)}% do total</p>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Card>
                  <h3 className="text-lg font-semibold text-primary mb-4">Investimentos em {formatMonth(selectedMonth)}</h3>
                  <p className="text-secondary text-sm mb-2">
                    Total: <span className="font-semibold" style={{ color: 'var(--color-balance)' }}>{formatCurrency(monthSummary.total_investments)}</span>
                  </p>
                  {monthInvestments.length === 0 ? (
                    <p className="text-secondary text-sm">Nenhum investimento registrado neste mês.</p>
                  ) : (
                    <ul className="space-y-2">
                      {monthInvestments.map((inv) => (
                        <li key={inv.id} className="flex justify-between items-center text-primary">
                          <span className="truncate">{inv.description || 'Investimento'}</span>
                          <span className="font-medium flex-shrink-0 ml-2">{formatCurrency(inv.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            )}

            {/* Gráficos anuais por categoria (opcional, mantidos no fim) */}
            {annualPieExpenses.length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-primary mb-4">Gastos por categoria (ano {selectedYear})</h3>
                <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                  <div className="min-w-full px-4 lg:px-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={annualPieExpenses}
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {annualPieExpenses.map((_item: { name: string; value: number; color: string }, i: number) => (
                            <Cell key={`ae-${i}`} fill={annualPieExpenses[i].color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const p = payload[0].payload
                            return (
                              <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
                                <p className="text-sm font-medium text-primary">{p.name}</p>
                                <p className="text-sm text-secondary">{formatCurrency(p.value)}</p>
                              </div>
                            )
                          }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{ paddingLeft: '20px' }}
                          formatter={(value, entry: any) => {
                            const item = annualPieExpenses[entry.index]
                            if (!item) return value
                            const total = annualPieExpenses.reduce((s: number, d: { value: number }) => s + d.value, 0)
                            const pct = total ? ((item.value / total) * 100).toFixed(0) : '0'
                            return `${value} (${pct}%)`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {annualPieIncomes.length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-primary mb-4">Rendas por categoria (ano {selectedYear})</h3>
                <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                  <div className="min-w-full px-4 lg:px-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={annualPieIncomes}
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {annualPieIncomes.map((_item: { name: string; value: number; color: string }, i: number) => (
                            <Cell key={`ai-${i}`} fill={annualPieIncomes[i].color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const p = payload[0].payload
                            return (
                              <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
                                <p className="text-sm font-medium text-primary">{p.name}</p>
                                <p className="text-sm text-secondary">{formatCurrency(p.value)}</p>
                              </div>
                            )
                          }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{ paddingLeft: '20px' }}
                          formatter={(value, entry: any) => {
                            const item = annualPieIncomes[entry.index]
                            if (!item) return value
                            const total = annualPieIncomes.reduce((s: number, d: { value: number }) => s + d.value, 0)
                            const pct = total ? ((item.value / total) * 100).toFixed(0) : '0'
                            return `${value} (${pct}%)`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
