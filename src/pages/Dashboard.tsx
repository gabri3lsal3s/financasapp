import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useInvestments } from '@/hooks/useInvestments'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { formatCurrency, getCurrentMonthString } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, RefreshCw } from 'lucide-react'
import Button from '@/components/Button'

export default function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const { colorPalette } = usePaletteColors()
  const { expenses, loading: expensesLoading, refreshExpenses } = useExpenses(currentMonth)
  const { incomes, loading: incomesLoading, refreshIncomes } = useIncomes(currentMonth)
  const { investments, loading: investmentsLoading, refreshInvestments } = useInvestments(currentMonth)

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const totalIncomes = incomes.reduce((sum, inc) => sum + inc.amount, 0)
  const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0)
  const balance = totalIncomes - totalExpenses - totalInvestments
  const loading = expensesLoading || incomesLoading || investmentsLoading

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
      
      <div className="p-4 lg:p-6 space-y-4">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : (
          <>
            {/* Resumo Financeiro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Rendas</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-income)' }}>
                      {formatCurrency(totalIncomes)}
                    </p>
                  </div>
                  <TrendingUp className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-income)' }} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Despesas</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-expense)' }}>
                      {formatCurrency(totalExpenses)}
                    </p>
                  </div>
                  <TrendingDown className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-expense)' }} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Investimentos</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-balance)' }}>
                      {formatCurrency(totalInvestments)}
                    </p>
                  </div>
                  <PiggyBank className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-balance)' }} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Saldo</p>
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

            {/* Top 5 Despesas */}
            {expenses.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-primary mb-3">
                  Maiores Despesas
                </h3>
                <div className="space-y-2">
                  {expenses
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 5)
                    .map((expense) => (
                      <Card key={expense.id} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className="w-1 h-8 flex-shrink-0 rounded-sm"
                              style={{
                                backgroundColor: getCategoryColorForPalette(
                                  expense.category?.color || 'var(--color-primary)',
                                  colorPalette
                                ),
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-primary truncate">
                                {expense.description || expense.category?.name || 'Sem descrição'}
                              </p>
                              <p className="text-sm text-secondary">
                                {expense.category?.name}
                              </p>
                            </div>
                          </div>
                          <p className="text-lg font-semibold text-primary flex-shrink-0">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

