import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import Card from '@/components/Card'
import { formatCurrency } from '@/utils/format'

interface DashboardKpisProps {
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
  balance: number
}

export default function DashboardKpis({
  totalIncomes,
  totalExpenses,
  totalInvestments,
  balance,
}: DashboardKpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
      {/* Rendas KPI */}
      <Card className="h-full animate-stagger-item delay-50">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-secondary">Rendas</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-income)' }}>
              {formatCurrency(totalIncomes)}
            </p>
          </div>
          <TrendingUp
            className="flex-shrink-0 ml-2"
            size={24}
            style={{ color: 'var(--color-income)' }}
          />
        </div>
      </Card>

      {/* Despesas KPI */}
      <Card className="h-full animate-stagger-item delay-100">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-secondary">Despesas</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-expense)' }}>
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <TrendingDown
            className="flex-shrink-0 ml-2"
            size={24}
            style={{ color: 'var(--color-expense)' }}
          />
        </div>
      </Card>

      {/* Investimentos KPI */}
      <Card className="h-full animate-stagger-item delay-150">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-secondary">Investimentos</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-balance)' }}>
              {formatCurrency(totalInvestments)}
            </p>
          </div>
          <PiggyBank
            className="flex-shrink-0 ml-2"
            size={24}
            style={{ color: 'var(--color-balance)' }}
          />
        </div>
      </Card>

      {/* Saldo KPI */}
      <Card className="h-full animate-stagger-item delay-200">
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
  )
}
