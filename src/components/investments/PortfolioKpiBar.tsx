import KpiCard from '@/components/KpiCard'
import { Briefcase, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatSignedPercentBR } from '@/utils/format'
import { nonCashPortfolioPerformance } from '@/utils/portfolioDisplayMetrics'
import type { PortfolioData } from '@/hooks/usePortfolio'

interface PortfolioKpiBarProps {
  portfolioData: PortfolioData
  dynamicHistory: {
    shareHistory: Array<{
      investedValue?: number
      cashValue?: number
      shareValue?: number
    }>
  }
}

export default function PortfolioKpiBar({ portfolioData, dynamicHistory }: PortfolioKpiBarProps) {
  const { yieldPct: consolidatedYield, gainBrl: consolidatedGain } =
    nonCashPortfolioPerformance(portfolioData.positions, 'gross')
  const isPositive = consolidatedYield >= 0
  const totalCash = portfolioData.cashValue

  const shareHistoryData = dynamicHistory.shareHistory || []
  const sparklineValuation = shareHistoryData.map((h) => h.investedValue ?? 0)
  const sparklineCash = shareHistoryData.map((h) => h.cashValue ?? 0)
  const sparklineYield = shareHistoryData.map((h) => h.shareValue ?? 1)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 items-stretch">
      <KpiCard
        title="Patrimônio Investido"
        value={formatCurrency(portfolioData.investedValue)}
        subtext="Valor total de investimentos"
        icon={<Briefcase size={16} className="w-4 h-4" />}
        glowColor="var(--color-income)"
        showGlow={true}
        sparklineData={sparklineValuation}
        index={1}
        className="col-span-1"
      />

      <KpiCard
        title="Saldo em Caixa"
        value={formatCurrency(totalCash)}
        subtext="Disponível para novos aportes"
        icon={<Wallet size={16} className="w-4 h-4" />}
        glowColor="var(--color-balance)"
        showGlow={false}
        sparklineData={sparklineCash}
        index={2}
        className="col-span-1"
      />

      <KpiCard
        title="Rentabilidade Consolidada"
        value={
          <span className={`text-[clamp(11px,3.3vw,1.25rem)] font-extrabold font-mono leading-none ${isPositive ? 'text-income' : 'text-expense'}`}>
            {formatSignedPercentBR(consolidatedYield)}
            <span className="text-xs sm:text-sm font-medium font-sans ml-1.5 opacity-90">
              ({consolidatedGain >= 0 ? '+' : ''}{formatCurrency(consolidatedGain)})
            </span>
          </span>
        }
        subtext="Retorno sobre o capital investido"
        icon={isPositive ? <TrendingUp size={16} className="w-4 h-4" /> : <TrendingDown size={16} className="w-4 h-4" />}
        glowColor={isPositive ? 'var(--color-income)' : 'var(--color-expense)'}
        showGlow={true}
        sparklineData={sparklineYield}
        isTrendPositive={isPositive}
        index={3}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  )
}
