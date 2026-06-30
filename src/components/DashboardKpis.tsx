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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch xl:grid-cols-4">
      {/* Rendas KPI */}
      <Card 
        className="flex h-full flex-col justify-between border-l-[var(--color-income)] border-l-4 p-3 sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-fluid-xs font-bold text-secondary tracking-wider uppercase truncate">Rendas</p>
            <p className="mt-1 font-mono text-sm font-black tabular-nums text-primary sm:text-base lg:text-lg xl:text-xl">
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
        className="flex h-full flex-col justify-between border-l-[var(--color-expense)] border-l-4 p-3 sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-fluid-xs font-bold text-secondary tracking-wider uppercase truncate">Despesas</p>
            <p className="mt-1 font-mono text-sm font-black tabular-nums text-primary sm:text-base lg:text-lg xl:text-xl">
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
        className="flex h-full flex-col justify-between border-l-[var(--color-balance)] border-l-4 p-3 sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-fluid-xs font-bold text-secondary tracking-wider uppercase truncate">Investimentos</p>
            <p className="mt-1 font-mono text-sm font-black tabular-nums text-primary sm:text-base lg:text-lg xl:text-xl">
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
        className={`flex h-full flex-col justify-between border-l-4 p-3 sm:p-5 ${
          isBalancePositive ? 'border-l-[var(--color-income)]' : 'border-l-[var(--color-expense)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-fluid-xs font-bold text-secondary tracking-wider uppercase truncate">Saldo Líquido</p>
            <p
              className={`mt-1 font-mono text-sm font-black tabular-nums sm:text-base lg:text-lg xl:text-xl ${
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
