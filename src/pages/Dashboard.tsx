import { useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useInvestments } from '@/hooks/useInvestments'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { formatCurrency, getCurrentMonthString } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, RefreshCw, Plus, Wallet, WalletCards } from 'lucide-react'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type QuickAddType = 'expense' | 'income' | 'investment'

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [quickAddType, setQuickAddType] = useState<QuickAddType>('expense')
  const [formData, setFormData] = useState({
    amount: '',
    date: `${getCurrentMonthString()}-01`,
    month: getCurrentMonthString(),
    category_id: '',
    income_category_id: '',
    description: '',
  })
  const { colorPalette } = usePaletteColors()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { investments, loading: investmentsLoading, refreshInvestments, createInvestment } = useInvestments(currentMonth)

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const totalIncomes = incomes.reduce((sum, inc) => sum + inc.amount, 0)
  const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0)
  const balance = totalIncomes - totalExpenses - totalInvestments
  const loading = expensesLoading || incomesLoading || investmentsLoading

  const monthlyOverviewData = useMemo(
    () => [
      { name: 'Rendas', value: totalIncomes, color: 'var(--color-income)' },
      { name: 'Despesas', value: totalExpenses, color: 'var(--color-expense)' },
      { name: 'Investimentos', value: totalInvestments, color: 'var(--color-balance)' },
    ],
    [totalExpenses, totalIncomes, totalInvestments]
  )

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number }>()

    expenses.forEach((expense) => {
      const name = expense.category?.name || 'Sem categoria'
      const key = expense.category?.id || name
      const color = getCategoryColorForPalette(expense.category?.color || 'var(--color-primary)', colorPalette)
      const current = map.get(key)

      if (current) {
        current.value += expense.amount
      } else {
        map.set(key, { name, color, value: expense.amount })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [expenses, colorPalette])

  const expenseCategoriesPieData = useMemo(() => {
    if (expenseByCategory.length <= 5) return expenseByCategory

    const top = expenseByCategory.slice(0, 5)
    const othersValue = expenseByCategory.slice(5).reduce((sum, item) => sum + item.value, 0)

    return [...top, { name: 'Outras', color: 'var(--color-text-secondary)', value: othersValue }]
  }, [expenseByCategory])

  const expenseAttentionCategories = useMemo(() => {
    if (totalExpenses <= 0) return []

    return expenseByCategory.slice(0, 5).map((item) => {
      const percentage = (item.value / totalExpenses) * 100
      const level = percentage >= 35 ? 'Alta' : percentage >= 20 ? 'Média' : 'Baixa'
      return { ...item, percentage, level }
    })
  }, [expenseByCategory, totalExpenses])

  const dailyFlowData = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const series = Array.from({ length: daysInMonth }, (_, index) => ({
      day: String(index + 1).padStart(2, '0'),
      Rendas: 0,
      Despesas: 0,
      Investimentos: 0,
    }))

    incomes.forEach((income) => {
      const day = new Date(`${income.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) series[day - 1].Rendas += income.amount
    })

    expenses.forEach((expense) => {
      const day = new Date(`${expense.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) series[day - 1].Despesas += expense.amount
    })

    investments.forEach((investment) => {
      const investmentDay = 1
      if (investmentDay >= 1 && investmentDay <= daysInMonth) {
        series[investmentDay - 1].Investimentos += investment.amount
      }
    })

    return series
  }, [currentMonth, incomes, expenses, investments])

  const chartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null

    return (
      <div className="rounded-lg border border-primary bg-primary px-3 py-2 shadow-sm">
        {label && <p className="text-xs text-secondary mb-1">Dia {label}</p>}
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <p key={`${entry.name}-${index}`} className="text-sm text-primary">
              {entry.name}: {formatCurrency(Number(entry.value || 0))}
            </p>
          ))}
        </div>
      </div>
    )
  }

  const openQuickAdd = (type: QuickAddType) => {
    setQuickAddType(type)
    setFormData({
      amount: '',
      date: `${currentMonth}-01`,
      month: currentMonth,
      category_id: categories[0]?.id || '',
      income_category_id: incomeCategories[0]?.id || '',
      description: '',
    })
    setIsQuickAddOpen(true)
  }

  const closeQuickAdd = () => {
    setIsQuickAddOpen(false)
  }

  const quickAddTitle = quickAddType === 'expense'
    ? 'Nova despesa'
    : quickAddType === 'income'
      ? 'Nova renda'
      : 'Novo investimento'

  const handleQuickAddSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const amount = Number(formData.amount)
    if (!amount || amount <= 0) {
      alert('Insira um valor válido maior que zero.')
      return
    }

    if (quickAddType === 'expense') {
      if (!formData.category_id) {
        alert('Selecione uma categoria de despesa.')
        return
      }

      const { error } = await createExpense({
        amount,
        date: formData.date,
        category_id: formData.category_id,
        ...(formData.description && { description: formData.description }),
      })

      if (error) {
        alert(`Erro ao criar despesa: ${error}`)
        return
      }
    }

    if (quickAddType === 'income') {
      if (!formData.income_category_id) {
        alert('Selecione uma categoria de renda.')
        return
      }

      const { error } = await createIncome({
        amount,
        date: formData.date,
        income_category_id: formData.income_category_id,
        ...(formData.description && { description: formData.description }),
      })

      if (error) {
        alert(`Erro ao criar renda: ${error}`)
        return
      }
    }

    if (quickAddType === 'investment') {
      const { error } = await createInvestment({
        amount,
        month: formData.month,
        ...(formData.description && { description: formData.description }),
      })

      if (error) {
        alert(`Erro ao criar investimento: ${error}`)
        return
      }
    }

    closeQuickAdd()
    refreshExpenses()
    refreshIncomes()
    refreshInvestments()
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.dashboard.title}
        subtitle={PAGE_HEADERS.dashboard.description}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refreshExpenses()
              refreshIncomes()
              refreshInvestments()
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Atualizar
          </Button>
        }
      />
      
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />

        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-primary">Inclusão rápida</h3>
              <p className="text-sm text-secondary">Acesse o formulário já preparado para lançar no mês selecionado.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="justify-start sm:justify-center"
                onClick={() => openQuickAdd('expense')}
                disabled={categories.length === 0}
              >
                <Plus size={15} />
                Despesa
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start sm:justify-center"
                onClick={() => openQuickAdd('income')}
                disabled={incomeCategories.length === 0}
              >
                <Wallet size={15} />
                Renda
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start sm:justify-center"
                onClick={() => openQuickAdd('investment')}
              >
                <WalletCards size={15} />
                Investimento
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Rendas</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-income)' }}>
                      {formatCurrency(totalIncomes)}
                    </p>
                  </div>
                  <TrendingUp className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-income)' }} />
                </div>
              </Card>

              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Despesas</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-expense)' }}>
                      {formatCurrency(totalExpenses)}
                    </p>
                  </div>
                  <TrendingDown className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-expense)' }} />
                </div>
              </Card>

              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Investimentos</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-balance)' }}>
                      {formatCurrency(totalInvestments)}
                    </p>
                  </div>
                  <PiggyBank className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-balance)' }} />
                </div>
              </Card>

              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Saldo</p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{
                        color: balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
              <Card className="h-full flex flex-col">
                <h3 className="text-lg font-semibold text-primary mb-4">Panorama do mês</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyOverviewData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                    <YAxis
                      stroke="var(--color-text-secondary)"
                      fontSize={12}
                      tick={{ fill: 'var(--color-text-secondary)' }}
                      tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                    />
                    <Tooltip content={chartTooltip} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {monthlyOverviewData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="h-full flex flex-col">
                <h3 className="text-lg font-semibold text-primary mb-4">Fluxo diário (mês)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} minTickGap={14} />
                    <YAxis
                      stroke="var(--color-text-secondary)"
                      fontSize={12}
                      tick={{ fill: 'var(--color-text-secondary)' }}
                      tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                    />
                    <Tooltip content={chartTooltip} />
                    <Legend />
                    <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
              <Card className="h-full flex flex-col">
                <h3 className="text-lg font-semibold text-primary mb-4">Despesas por categoria</h3>
                {expenseCategoriesPieData.length === 0 ? (
                  <p className="text-sm text-secondary">Sem despesas no mês selecionado.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={expenseCategoriesPieData} dataKey="value" nameKey="name" outerRadius={86} labelLine={false} label={false}>
                          {expenseCategoriesPieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={chartTooltip} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="space-y-2 mt-3">
                      {expenseCategoriesPieData.map((item) => {
                        const percentage = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0
                        return (
                          <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-primary truncate">{item.name}</span>
                            </div>
                            <span className="text-secondary flex-shrink-0">{percentage.toFixed(1)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </Card>

              <Card className="h-full">
                <h3 className="text-lg font-semibold text-primary mb-4">Categorias para atenção</h3>
                {expenseAttentionCategories.length === 0 ? (
                  <p className="text-sm text-secondary">Sem dados de despesas para priorização neste mês.</p>
                ) : (
                  <div className="space-y-3">
                    {expenseAttentionCategories.map((item) => (
                      <div key={item.name}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-primary truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-secondary">{item.level}</span>
                            <span className="text-sm font-medium text-primary">{item.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-secondary">
                          <div className="h-2 rounded-full" style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color }} />
                        </div>
                        <p className="text-xs text-secondary mt-1">{formatCurrency(item.value)} no mês</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>

      <Modal isOpen={isQuickAddOpen} onClose={closeQuickAdd} title={quickAddTitle}>
        <form onSubmit={handleQuickAddSubmit} className="w-full max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Tipo de lançamento</label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                variant={quickAddType === 'expense' ? 'primary' : 'outline'}
                onClick={() => setQuickAddType('expense')}
                disabled={categories.length === 0}
              >
                Despesa
              </Button>
              <Button
                type="button"
                size="sm"
                variant={quickAddType === 'income' ? 'primary' : 'outline'}
                onClick={() => setQuickAddType('income')}
                disabled={incomeCategories.length === 0}
              >
                Renda
              </Button>
              <Button
                type="button"
                size="sm"
                variant={quickAddType === 'investment' ? 'primary' : 'outline'}
                onClick={() => setQuickAddType('investment')}
              >
                Invest.
              </Button>
            </div>
          </div>
          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="0,00"
            required
          />

          {quickAddType === 'investment' ? (
            <Input
              label="Mês"
              type="month"
              value={formData.month}
              onChange={(event) => setFormData((prev) => ({ ...prev, month: event.target.value }))}
              required
            />
          ) : (
            <Input
              label="Data"
              type="date"
              value={formData.date}
              onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          )}

          {quickAddType === 'expense' && (
            <Select
              label="Categoria"
              value={formData.category_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, category_id: event.target.value }))}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              required
            />
          )}

          {quickAddType === 'income' && (
            <Select
              label="Categoria de renda"
              value={formData.income_category_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, income_category_id: event.target.value }))}
              options={incomeCategories.map((category) => ({ value: category.id, label: category.name }))}
              required
            />
          )}

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Ex: mercado, salário, reserva..."
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={closeQuickAdd}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

