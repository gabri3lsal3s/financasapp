import ExposureLimitsEditor from '@/components/investments/ExposureLimitsEditor'
import SmartAporteSimulator from '@/components/investments/SmartAporteSimulator'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import type { PortfolioGroupTarget } from '@/types'

interface RebalancingViewProps {
  portfolioId: string
  positions: ValuedPosition[]
  totalValue: number
  cashValue: number
  groupTargets: PortfolioGroupTarget[]
  preferences?: unknown
  onSaved: () => void
}

export default function RebalancingView({
  portfolioId,
  positions,
  totalValue,
  cashValue,
  groupTargets,
  preferences,
  onSaved,
}: RebalancingViewProps) {
  return (
    <div className="space-y-6 animate-fade-in w-full">
      {/* 1. Definição de Metas por Classe/Setor */}
      <ExposureLimitsEditor
        portfolioId={portfolioId}
        positions={positions}
        totalValue={totalValue}
        groupTargets={groupTargets}
        onSaved={onSaved}
      />

      {/* 2. Simulador de Aporte Inteligente */}
      <SmartAporteSimulator
        portfolioId={portfolioId}
        positions={positions}
        preferences={preferences}
        groupTargets={groupTargets}
        totalValue={totalValue}
        cashValue={cashValue}
      />
    </div>
  )
}
