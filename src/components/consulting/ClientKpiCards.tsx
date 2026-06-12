import KpiCard from '@/components/KpiCard'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { Wallet, TrendingUp } from 'lucide-react'

export type ClientKpiYieldVariant = 'share' | 'accumulated'
export type ClientKpiYieldBasis = 'gross' | 'net'

interface ClientKpiCardsProps {
  investedValue: number
  cashValue?: number
  totalValue: number
  shareValue: number
  totalShares?: number
  yieldVariant?: ClientKpiYieldVariant
  overallYieldPct?: number
  yieldBasis?: ClientKpiYieldBasis
  netShareValue?: number
}

function formatSignedYieldPct(yieldsPercentage: number): string {
  const prefix = yieldsPercentage >= 0 ? '+' : ''
  return `${prefix}${formatNumberBR(yieldsPercentage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export default function ClientKpiCards({
  investedValue,
  cashValue = 0,
  totalValue,
  shareValue,
  totalShares = 0,
  overallYieldPct,
  yieldBasis = 'gross',
  netShareValue,
}: ClientKpiCardsProps) {
  const effectiveShare =
    yieldBasis === 'net' && netShareValue != null && netShareValue > 0 ? netShareValue : shareValue
  const yieldsPercentage =
    overallYieldPct !== undefined ? overallYieldPct : (effectiveShare - 1) * 100
  const hasYieldBasis = totalShares > 0
  const accumulatedAmount = hasYieldBasis ? totalValue - totalShares : 0
  const yieldPctClass = yieldsPercentage >= 0 ? 'text-income' : 'text-expense'

  const yieldLabel = 'Rentabilidade Total'

  const yieldPrimary = formatSignedYieldPct(yieldsPercentage)



  const yieldSecondary = hasYieldBasis ? (
    <span className="block sm:inline sm:ml-1.5 text-[9px] xs:text-[10px] sm:text-xs text-secondary font-medium font-sans">
      ({accumulatedAmount >= 0 ? '+' : ''}{formatCurrency(accumulatedAmount)})
    </span>
  ) : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch">
      <KpiCard
        title="Patrimônio Total"
        value={formatCurrency(totalValue)}
        subtext={cashValue > 0 ? `Investido ${formatCurrency(investedValue)} · Caixa ${formatCurrency(cashValue)}` : undefined}
        icon={<Wallet size={16} className="w-4 h-4" />}
        glowColor="var(--color-balance)"
        showGlow={true}
        index={1}
      />

      <KpiCard
        title={yieldLabel}
        value={
          <strong className="text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl font-extrabold font-mono text-primary mt-1.5 block truncate" title={`${yieldPrimary} ${hasYieldBasis ? `(${accumulatedAmount >= 0 ? '+' : ''}${formatCurrency(accumulatedAmount)})` : ''}`}>
            <span className={yieldPctClass}>{yieldPrimary}</span>
            {yieldSecondary}
          </strong>
        }
        icon={<TrendingUp size={16} className="w-4 h-4" />}
        glowColor="var(--color-income)"
        showGlow={true}
        isTrendPositive={yieldsPercentage >= 0}
        index={2}
      />
    </div>
  )
}
