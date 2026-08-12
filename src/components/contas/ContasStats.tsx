import KpiCard from '@/components/KpiCard'
import { formatCurrency } from '@/utils/format'
import { Scale, TrendingUp, TrendingDown, CreditCard as CreditCardIcon } from 'lucide-react'

export interface ContasStatsData {
  totalFaturasAberto: number
  totalPagar: number
  totalReceber: number
  saldoLiquido: number
}

/**
 * ContasStats — grid de KPIs do topo da página Contas (extraído de
 * Contas.tsx). Faturas em aberto, contas a pagar/receber e saldo pendente.
 */
export default function ContasStats({ stats }: { stats: ContasStatsData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 text-left items-stretch">
      <KpiCard
        title="Faturas em Aberto"
        value={formatCurrency(stats.totalFaturasAberto)}
        icon={<CreditCardIcon size={16} />}
        glowColor="var(--color-primary)"
        showGlow={true}
        index={1}
      />
      <KpiCard
        title="Contas a Pagar"
        value={formatCurrency(stats.totalPagar)}
        icon={<TrendingDown size={16} />}
        glowColor="var(--color-expense)"
        showGlow={true}
        index={2}
      />
      <KpiCard
        title="Contas a Receber"
        value={formatCurrency(stats.totalReceber)}
        icon={<TrendingUp size={16} />}
        glowColor="var(--color-income)"
        showGlow={true}
        index={3}
      />
      <KpiCard
        title="Saldo Pendente"
        value={
          <span className={stats.saldoLiquido >= 0 ? 'text-income' : 'text-expense'}>
            {formatCurrency(stats.saldoLiquido)}
          </span>
        }
        icon={<Scale size={16} />}
        glowColor={stats.saldoLiquido >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
        showGlow={true}
        valueTooltip={formatCurrency(stats.saldoLiquido)}
        index={4}
      />
    </div>
  )
}
