import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import { useReports } from '@/hooks/useReports'
import { useIncomeReports } from '@/hooks/useIncomeReports'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { formatCurrency, formatMonthShort } from '@/utils/format'
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

export default function Reports() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const { monthlySummaries, categoryExpenses, loading } = useReports(selectedYear)
  const { incomeByCategory, loading: loadingIncomes } = useIncomeReports(selectedYear)
  const { colorPalette } = usePaletteColors()

  const years = Array.from({ length: Math.max(0, new Date().getFullYear() - 2025) }, (_, i) => 2026 + i)

  // Preparar dados para gráficos
  const monthlyData = monthlySummaries.map((summary) => ({
    month: formatMonthShort(summary.month),
    Rendas: summary.total_income,
    Despesas: summary.total_expenses,
    Investimentos: summary.total_investments,
    Saldo: summary.balance,
  }))

  // Assign unique colors for expense categories based on selected palette
  const assignedExpenseColors = assignUniquePaletteColors(categoryExpenses, colorPalette)
  const pieData = categoryExpenses.map((cat, idx) => ({
    name: cat.category_name,
    value: cat.total,
    color: assignedExpenseColors[idx] || getCategoryColorForPalette(cat.color, colorPalette),
  }))

  const COLORS = pieData.map((item) => item.color)
  const assignedIncomeColors = assignUniquePaletteColors(incomeByCategory, colorPalette)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Visão mensal e por categoria" />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Seletor de Ano */}
        <Card>
          <label className="block text-sm font-medium text-primary mb-2">
            Ano
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </Card>

        {loading || loadingIncomes ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : (
          <>
            {/* Gráfico de Linha - Evolução Mensal */}
            <Card>
              <h3 className="text-lg font-semibold text-primary mb-4">
                Evolução Mensal
              </h3>
              <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                <div className="min-w-full px-4 lg:px-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="month"
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                      />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(value) => {
                          if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`
                          return `R$ ${value}`
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Rendas"
                        stroke="var(--color-income)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Despesas"
                        stroke="var(--color-expense)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Investimentos"
                        stroke="var(--color-balance)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Gráfico de Barras - Comparação Mensal */}
            <Card>
              <h3 className="text-lg font-semibold text-primary mb-4">
                Comparação Mensal
              </h3>
              <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                <div className="min-w-full px-4 lg:px-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="month"
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                      />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(value) => {
                          if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`
                          return `R$ ${value}`
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="Rendas" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Investimentos" fill="var(--color-balance)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Gráfico de Pizza - Gastos por Categoria */}
            {pieData.length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-primary mb-4">
                  Gastos por Categoria
                </h3>
                <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                  <div className="min-w-full px-4 lg:px-0">
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index]} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              return (
                                <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
                                  <p className="text-sm font-medium text-primary">
                                    {payload[0].payload.name}
                                  </p>
                                  <p className="text-sm text-secondary">
                                    {formatCurrency(payload[0].value as number)}
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend 
                          layout="vertical" 
                          align="right" 
                          verticalAlign="middle"
                          wrapperStyle={{ paddingLeft: '20px' }}
                          formatter={(value, entry: any) => {
                            if (entry.index === undefined || !pieData[entry.index]) {
                              return value
                            }
                            const item = pieData[entry.index]
                            const percent = ((item.value / pieData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(0)
                            return `${value} (${percent}%)`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* Lista de Categorias */}
            {categoryExpenses.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-primary mb-3">
                  Detalhamento por Categoria
                </h3>
                <div className="space-y-2">
                  {/** build map from category id to assigned color to keep colors unique even after sorting */}
                  {/* eslint-disable-next-line no-unused-vars */}
                  {
                    (() => {
                      const expenseColorMap: Record<string, string> = {}
                      categoryExpenses.forEach((c, i) => {
                        expenseColorMap[c.category_id] = assignedExpenseColors[i] || getCategoryColorForPalette(c.color, colorPalette)
                      })
                      return null
                    })()
                  }
                  {categoryExpenses
                    .sort((a, b) => b.total - a.total)
                    .map((category) => {
                      const totalExpenses = categoryExpenses.reduce(
                        (sum, cat) => sum + cat.total,
                        0
                      )
                      const percentage = (category.total / totalExpenses) * 100

                      return (
                        <Card key={category.category_id} className="py-3">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-4 h-4 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: (category && (assignedExpenseColors[categoryExpenses.findIndex(c=>c.category_id===category.category_id)])) || category.color }}
                              />
                              <span className="font-medium text-primary truncate">
                                {category.category_name}
                              </span>
                            </div>
                            <span className="font-semibold text-primary flex-shrink-0">
                              {formatCurrency(category.total)}
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: (category && (assignedExpenseColors[categoryExpenses.findIndex(c=>c.category_id===category.category_id)])) || category.color,
                              }}
                            />
                          </div>
                          <p className="text-xs text-secondary mt-1">
                            {percentage.toFixed(1)}% do total
                          </p>
                        </Card>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Gráfico de Pizza - Rendas por Categoria */}
            {incomeByCategory.length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-primary mb-4">
                  Rendas por Categoria
                </h3>
                <div className="w-full overflow-x-auto -mx-4 lg:mx-0">
                  <div className="min-w-full px-4 lg:px-0">
                    {(() => {
                      const assignedIncomeColors = assignUniquePaletteColors(incomeByCategory, colorPalette)
                      const incomePieData = incomeByCategory.map((cat, i) => ({
                        name: cat.category_name,
                        value: cat.total,
                        color: assignedIncomeColors[i] || getCategoryColorForPalette(cat.color, colorPalette),
                      }))

                      return (
                        <ResponsiveContainer width="100%" height={400}>
                          <PieChart>
                            <Pie
                              data={incomePieData}
                              cx="50%"
                              cy="45%"
                              labelLine={false}
                              label={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {incomePieData.map((_, index) => (
                                <Cell
                                  key={`income-cell-${index}`}
                                  fill={incomePieData[index].color}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload[0]) {
                                  return (
                                    <div className="bg-primary p-3 border border-primary rounded-lg shadow-lg">
                                      <p className="text-sm font-medium text-primary">
                                        {payload[0].payload.name}
                                      </p>
                                      <p className="text-sm text-secondary">
                                        {formatCurrency(payload[0].value as number)}
                                      </p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Legend 
                              layout="vertical" 
                              align="right" 
                              verticalAlign="middle"
                              wrapperStyle={{ paddingLeft: '20px' }}
                              formatter={(value, entry: any) => {
                                if (entry.index === undefined || !incomePieData[entry.index]) {
                                  return value
                                }
                                const total = incomePieData.reduce((sum, d) => sum + d.value, 0)
                                const item = incomePieData[entry.index]
                                const percent = ((item.value / total) * 100).toFixed(0)
                                return `${value} (${percent}%)`
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </div>
                </div>
              </Card>
            )}

            {/* Lista de Categorias de Rendas */}
            {incomeByCategory.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-primary mb-3">
                  Detalhamento por Categoria de Renda
                </h3>
                <div className="space-y-2">
                  {incomeByCategory
                    .sort((a, b) => b.total - a.total)
                    .map((category) => {
                      const totalIncome = incomeByCategory.reduce(
                        (sum, cat) => sum + cat.total,
                        0
                      )
                      const percentage = (category.total / totalIncome) * 100

                      return (
                        <Card key={category.income_category_id} className="py-3">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-4 h-4 flex-shrink-0 rounded-full"
                                style={{
                                  backgroundColor: assignedIncomeColors[incomeByCategory.findIndex(c => c.income_category_id === category.income_category_id)] || getCategoryColorForPalette(category.color, colorPalette),
                                }}
                              />
                              <span className="font-medium text-primary truncate">
                                {category.category_name}
                              </span>
                            </div>
                            <span className="font-semibold text-primary flex-shrink-0">
                              {formatCurrency(category.total)}
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: assignedIncomeColors[incomeByCategory.findIndex(c => c.income_category_id === category.income_category_id)] || getCategoryColorForPalette(category.color, colorPalette),
                              }}
                            />
                          </div>
                          <p className="text-xs text-secondary mt-1">
                            {percentage.toFixed(1)}% do total
                          </p>
                        </Card>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Resumo Anual */}
            <Card>
              <h3 className="text-lg font-semibold text-primary mb-4">
                Resumo Anual {selectedYear}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-secondary">Total de Rendas</span>
                  <span className="font-semibold" style={{ color: 'var(--color-income)' }}>
                    {formatCurrency(
                      monthlySummaries.reduce(
                        (sum, s) => sum + s.total_income,
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-secondary">Total de Despesas</span>
                  <span className="font-semibold" style={{ color: 'var(--color-expense)' }}>
                    {formatCurrency(
                      monthlySummaries.reduce(
                        (sum, s) => sum + s.total_expenses,
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-secondary">Total de Investimentos</span>
                  <span className="font-semibold" style={{ color: 'var(--color-balance)' }}>
                    {formatCurrency(
                      monthlySummaries.reduce(
                        (sum, s) => sum + s.total_investments,
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="border-t border-primary pt-3 mt-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-primary">Saldo Anual</span>
                    <span
                      className="font-bold text-lg"
                      style={{
                        color:
                          monthlySummaries.reduce(
                            (sum, s) => sum + s.balance,
                            0
                          ) >= 0
                            ? 'var(--color-income)'
                            : 'var(--color-expense)',
                      }}
                    >
                      {formatCurrency(
                        monthlySummaries.reduce((sum, s) => sum + s.balance, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

