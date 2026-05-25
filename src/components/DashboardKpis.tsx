import { TrendingUp, TrendingDown, PiggyBank, Scale } from 'lucide-react'
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
  const isBalancePositive = balance >= 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
      {/* Rendas KPI */}
      <Card 
        className="p-3 sm:p-5 flex flex-col justify-between border-l-4 h-full animate-stagger-item delay-50"
        style={{ borderLeftColor: 'var(--color-income)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-secondary tracking-wider uppercase whitespace-nowrap">Rendas</p>
            <p className="text-sm xs:text-base sm:text-2xl font-black text-primary mt-1 sm:mt-2 font-mono truncate">
              {formatCurrency(totalIncomes)}
            </p>
          </div>
          <TrendingUp
            className="flex-shrink-0 ml-3 text-income opacity-80"
            size={20}
          />
        </div>
      </Card>

      {/* Despesas KPI */}
      <Card 
        className="p-3 sm:p-5 flex flex-col justify-between border-l-4 h-full animate-stagger-item delay-100"
        style={{ borderLeftColor: 'var(--color-expense)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-secondary tracking-wider uppercase whitespace-nowrap">Despesas</p>
            <p className="text-sm xs:text-base sm:text-2xl font-black text-primary mt-1 sm:mt-2 font-mono truncate">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <TrendingDown
            className="flex-shrink-0 ml-3 text-expense opacity-80"
            size={20}
          />
        </div>
      </Card>

      {/* Investimentos KPI */}
      <Card 
        className="p-3 sm:p-5 flex flex-col justify-between border-l-4 h-full animate-stagger-item delay-150"
        style={{ borderLeftColor: 'var(--color-balance)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-secondary tracking-wider uppercase whitespace-nowrap">Investimentos</p>
            <p className="text-sm xs:text-base sm:text-2xl font-black text-primary mt-1 sm:mt-2 font-mono truncate">
              {formatCurrency(totalInvestments)}
            </p>
          </div>
          <PiggyBank
            className="flex-shrink-0 ml-3 text-balance opacity-80"
            size={20}
          />
        </div>
      </Card>

      {/* Saldo KPI */}
      <Card
        className="p-3 sm:p-5 flex flex-col justify-between border-l-4 h-full animate-stagger-item delay-200"
        style={{
          borderLeftColor: isBalancePositive ? 'var(--color-income)' : 'var(--color-expense)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-secondary tracking-wider uppercase whitespace-nowrap">Saldo Líquido</p>
            <p
              className={`text-sm xs:text-base sm:text-2xl font-black mt-1 sm:mt-2 font-mono truncate ${
                isBalancePositive ? 'text-income' : 'text-expense'
              }`}
            >
              {formatCurrency(balance)}
            </p>
          </div>
          <Scale
            className={`flex-shrink-0 ml-3 opacity-80 ${isBalancePositive ? 'text-income' : 'text-expense'}`}
            size={20}
          />
        </div>
      </Card>
    </div>
  )
}
