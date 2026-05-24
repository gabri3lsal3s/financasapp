import Card from '@/components/Card'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { Wallet, TrendingUp } from 'lucide-react'

export type ClientKpiYieldVariant = 'share' | 'accumulated'

interface ClientKpiCardsProps {
  portfolioValue: number
  shareValue: number
  /** Cotas emitidas (base de aportes) — necessário para rentabilidade em R$ no painel do cliente */
  totalShares?: number
  /** `share`: valor da cota (consultor). `accumulated`: ganho acumulado em R$ + % (cliente) */
  yieldVariant?: ClientKpiYieldVariant
}

function formatSignedYieldPct(yieldsPercentage: number): string {
  const prefix = yieldsPercentage >= 0 ? '+' : ''
  return `${prefix}${formatNumberBR(yieldsPercentage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export default function ClientKpiCards({
  portfolioValue,
  shareValue,
  totalShares = 0,
  yieldVariant = 'share',
}: ClientKpiCardsProps) {
  const yieldsPercentage = (shareValue - 1) * 100
  const hasYieldBasis = totalShares > 0
  const accumulatedAmount = hasYieldBasis ? portfolioValue - totalShares : 0
  const yieldPctClass = yieldsPercentage >= 0 ? 'text-emerald-500' : 'text-expense'

  const yieldLabel =
    yieldVariant === 'accumulated' ? 'Rentabilidade Acumulada' : 'Valor da Cota (Rentabilidade)'

  const yieldPrimary =
    yieldVariant === 'accumulated' ? (
      hasYieldBasis ? (
        formatCurrency(accumulatedAmount)
      ) : (
        <span className="text-secondary">—</span>
      )
    ) : (
      formatNumberBR(shareValue, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    )

  const yieldSecondary =
    hasYieldBasis || yieldVariant === 'share' ? (
      <span className={`text-xs font-bold ml-1.5 ${yieldPctClass}`}>
        {formatSignedYieldPct(yieldsPercentage)}
      </span>
    ) : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-emerald-500 flex items-center justify-between shadow-sm transition-all hover:border-l-emerald-400">
        <div className="text-left">
          <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">Patrimônio Líquido</span>
          <strong className="text-xl font-black text-primary mt-1 block">
            {formatCurrency(portfolioValue)}
          </strong>
        </div>
        <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
          <Wallet size={20} />
        </div>
      </Card>

      <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-purple-500 flex items-center justify-between shadow-sm transition-all hover:border-l-purple-400">
        <div className="text-left">
          <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">{yieldLabel}</span>
          <strong className="text-xl font-black text-primary mt-1 block">
            {yieldPrimary}
            {yieldSecondary}
          </strong>
        </div>
        <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-lg shrink-0">
          <TrendingUp size={20} />
        </div>
      </Card>
    </div>
  )
}
