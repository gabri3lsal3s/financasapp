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
  overallYieldPct?: number
}

function formatSignedYieldPct(yieldsPercentage: number): string {
  const prefix = yieldsPercentage >= 0 ? '+' : ''
  return `${prefix}${formatNumberBR(yieldsPercentage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export default function ClientKpiCards({
  portfolioValue,
  shareValue,
  totalShares = 0,
  overallYieldPct,
}: ClientKpiCardsProps) {
  const yieldsPercentage = overallYieldPct !== undefined ? overallYieldPct : (shareValue - 1) * 100
  const hasYieldBasis = totalShares > 0
  const accumulatedAmount = hasYieldBasis ? portfolioValue - totalShares : 0
  const yieldPctClass = yieldsPercentage >= 0 ? 'text-emerald-500' : 'text-expense'

  const yieldLabel = 'Rentabilidade Total'

  const yieldPrimary = formatSignedYieldPct(yieldsPercentage)

  const yieldSecondary = hasYieldBasis ? (
    <span className="block sm:inline sm:ml-1.5 text-[9px] xs:text-[10px] sm:text-xs text-secondary font-medium font-sans">
      ({accumulatedAmount >= 0 ? '+' : ''}{formatCurrency(accumulatedAmount)})
    </span>
  ) : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <Card className="p-3 sm:p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-emerald-500 flex items-center justify-between shadow-sm transition-all hover:border-l-emerald-400">
        <div className="text-left">
          <span className="text-[9px] sm:text-[10px] font-semibold text-secondary uppercase tracking-wider block whitespace-nowrap">Patrimônio Líquido</span>
          <strong className="text-sm xs:text-base sm:text-xl font-black text-primary mt-1 block font-mono">
            {formatCurrency(portfolioValue)}
          </strong>
        </div>
        <div className="p-1.5 sm:p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0 flex items-center justify-center">
          <Wallet size={16} className="sm:w-5 sm:h-5 w-4 h-4" />
        </div>
      </Card>
 
      <Card className="p-3 sm:p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-purple-500 flex items-center justify-between shadow-sm transition-all hover:border-l-purple-400">
        <div className="text-left">
          <span className="text-[9px] sm:text-[10px] font-semibold text-secondary uppercase tracking-wider block whitespace-nowrap">{yieldLabel}</span>
          <strong className="text-sm xs:text-base sm:text-xl font-black text-primary mt-1 block font-mono">
            <span className={yieldPctClass}>{yieldPrimary}</span>
            {yieldSecondary}
          </strong>
        </div>
        <div className="p-1.5 sm:p-2 bg-purple-500/10 text-purple-500 rounded-lg shrink-0 flex items-center justify-center">
          <TrendingUp size={16} className="sm:w-5 sm:h-5 w-4 h-4" />
        </div>
      </Card>
    </div>
  )
}
