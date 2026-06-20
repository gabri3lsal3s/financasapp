import KpiCard from '@/components/KpiCard'
import { formatCurrency, formatSignedPercentBR } from '@/utils/format'
import { Wallet, TrendingUp, ArrowUpRight, Percent } from 'lucide-react'
import type { PortfolioShareDailyRow } from '@/types'

interface PortfolioKpiBarProps {
  totalValue: number
  investedValue: number
  shareHistory: PortfolioShareDailyRow[]
}

export default function PortfolioKpiBar({
  totalValue,
  investedValue,
  shareHistory
}: PortfolioKpiBarProps) {
  const absoluteProfit = totalValue - investedValue
  const profitPercentage = investedValue > 0 ? (absoluteProfit / investedValue) * 100 : 0
  const isProfit = absoluteProfit >= 0

  // Mapeamento dos históricos diários para sparklines
  const equityHistory = shareHistory.map(h => Number(h.gross_pl))
  const cotaHistory = shareHistory.map(h => Number(h.share_value))
  const profitHistory = shareHistory.map(h => Number(h.net_pl))
  const investedHistory = shareHistory.map(h => Number(h.gross_pl) - Number(h.net_pl))

  // Calcular variação diária baseado nos 2 últimos dias de histórico (se houver)
  let dailyVariationPercent: number | null = null

  if (shareHistory.length >= 2) {
    const last = shareHistory[shareHistory.length - 1]
    const prev = shareHistory[shareHistory.length - 2]
    
    dailyVariationPercent = prev.share_value > 0 
      ? ((last.share_value - prev.share_value) / prev.share_value) * 100 
      : 0
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch animate-page-enter">
      {/* Patrimônio Bruto */}
      <KpiCard
        title="Patrimônio Bruto"
        value={formatCurrency(totalValue)}
        subtext="variação diária"
        icon={<Wallet size={16} />}
        glowColor="var(--color-primary)"
        showGlow={true}
        sparklineData={equityHistory}
        trendPercent={dailyVariationPercent}
        index={1}
      />

      {/* Total Aportado */}
      <KpiCard
        title="Total Aportado"
        value={formatCurrency(investedValue)}
        subtext="custo de aquisição"
        icon={<TrendingUp size={16} />}
        glowColor="var(--color-balance)"
        showGlow={false}
        sparklineData={investedHistory}
        trendPercent={null}
        index={2}
      />

      {/* Resultado Líquido */}
      <KpiCard
        title="Resultado Líquido"
        value={(isProfit ? '+' : '') + formatCurrency(absoluteProfit)}
        subtext="lucro acumulado"
        icon={<ArrowUpRight size={16} className={isProfit ? '' : 'rotate-90'} />}
        glowColor={isProfit ? 'var(--color-income)' : 'var(--color-expense)'}
        showGlow={!isProfit}
        sparklineData={profitHistory}
        trendPercent={null}
        isTrendPositive={isProfit}
        index={3}
      />

      {/* Rentabilidade Global */}
      <KpiCard
        title="Rentabilidade Global"
        value={formatSignedPercentBR(profitPercentage)}
        subtext="retorno da carteira"
        icon={<Percent size={16} />}
        glowColor={profitPercentage >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
        showGlow={profitPercentage < 0}
        sparklineData={cotaHistory}
        trendPercent={dailyVariationPercent}
        index={4}
      />
    </div>
  )
}
