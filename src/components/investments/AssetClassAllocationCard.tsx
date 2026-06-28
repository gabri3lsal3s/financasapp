import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import ViewModeToggle from '@/components/ViewModeToggle'
import PortfolioPieChart from '@/components/investments/PortfolioPieChart'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import type { PortfolioGroupTarget } from '@/types'
import { CheckCircle2, Info, TrendingUp } from 'lucide-react'

interface AssetClassAllocationCardProps {
  positions: ValuedPosition[]
  cashValue: number
  totalValue: number
  groupTargets: PortfolioGroupTarget[]
  /** Dados opcionais para o gráfico pizza (por ativo) */
  assetPieData?: Array<{ name: string; value: number; percentage: number; color: string }>
  /** Dados opcionais para o gráfico pizza (por classe) */
  classPieData?: Array<{ name: string; value: number; percentage: number; color: string }>
  /** Dados opcionais para o gráfico pizza (por setor) */
  sectorPieData?: Array<{ name: string; value: number; percentage: number; color: string }>
  /** Callback quando o usuário clica numa fatia do pizza de ativos */
  onAssetSliceClick?: (ticker: string) => void
}

interface AssetClassSummary {
  name: string
  currentValue: number
  currentPercentage: number
  targetPercentage: number
}

type ViewMode = 'bar' | 'pie'
type PieView = 'asset' | 'class' | 'sector'

// Cores HSL harmonizadas do design system para classes de ativos
const CLASS_COLORS: Record<string, string> = {
  'Ações Nacionais': 'var(--color-primary)',
  'Ações Internacionais': 'var(--color-income)',
  'Fundos Imobiliários': 'var(--color-balance)',
  'ETFs': 'var(--color-text-primary)',
  'Criptoativos': 'var(--color-income-strong)',
  'Renda Fixa': 'var(--color-primary-strong)',
  'Saldo em Caixa': 'var(--color-text-secondary)',
  'Outros': 'var(--color-text-secondary)'
}

export default function AssetClassAllocationCard({
  positions,
  cashValue,
  totalValue,
  groupTargets,
  assetPieData = [],
  classPieData = [],
  sectorPieData = [],
  onAssetSliceClick,
}: AssetClassAllocationCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('bar')
  const [pieView, setPieView] = useState<PieView>('class')

  // Views disponíveis para pizza
  const availablePieViews: PieView[] = [
    ...(assetPieData.length > 0 ? ['asset' as const] : []),
    ...(classPieData.length > 0 ? ['class' as const] : []),
    ...(sectorPieData.length > 0 ? ['sector' as const] : []),
  ]
  const effectivePieView = availablePieViews.includes(pieView) ? pieView : availablePieViews[0]

  const currentPieData =
    effectivePieView === 'asset' ? assetPieData :
    effectivePieView === 'class' ? classPieData :
    sectorPieData

  const handlePieSliceClick = (sliceName: string) => {
    if (effectivePieView === 'asset' && onAssetSliceClick && sliceName !== 'Outros') {
      onAssetSliceClick(sliceName)
    }
  }

  const allocationData = useMemo(() => {
    const map = new Map<string, number>()

    // Agregar posições por classe de ativos
    positions.forEach(pos => {
      if (pos.pricing_mode === 'cash') return
      const className = pos.asset_class || 'Outros'
      const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
      map.set(className, (map.get(className) || 0) + valueInBrl)
    })

    // Adicionar saldo em caixa se houver
    if (cashValue > 0) {
      map.set('Saldo em Caixa', cashValue)
    }

    const totalCalculated = Array.from(map.values()).reduce((sum, v) => sum + v, 0)
    const divisor = totalValue > 0 ? totalValue : (totalCalculated > 0 ? totalCalculated : 1)

    const list: AssetClassSummary[] = Array.from(map.entries()).map(([name, val]) => {
      const currentPct = (val / divisor) * 100
      
      // Buscar percentual alvo de groupTargets
      const target = groupTargets.find(
        t => t.group_type === 'class' && t.group_name.trim().toLowerCase() === name.trim().toLowerCase()
      )
      const targetPct = target ? Number(target.target_percentage) : 0

      return {
        name,
        currentValue: val,
        currentPercentage: currentPct,
        targetPercentage: targetPct
      }
    })

    // Ordenar por valor atual decrescente
    return list.sort((a, b) => b.currentValue - a.currentValue)
  }, [positions, cashValue, totalValue, groupTargets])

  const totalTargetDefined = useMemo(() => {
    return groupTargets
      .filter(t => t.group_type === 'class')
      .reduce((sum, t) => sum + Number(t.target_percentage), 0)
  }, [groupTargets])

  if (allocationData.length === 0 && currentPieData.length === 0) {
    return null
  }

  const pieViewOptions = availablePieViews.map(m => ({
    value: m,
    label: m === 'asset' ? 'Por Ativo' : m === 'class' ? 'Por Classe' : 'Por Setor',
  }))

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-5 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-glass/40 pb-3">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">
            Distribuição de Ativos
          </h4>
          <p className="text-[10px] text-secondary font-medium">
            {viewMode === 'bar'
              ? 'Alocação atual comparada às metas por classe'
              : 'Distribuição visual da carteira'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'pie' && pieViewOptions.length > 1 && (
            <ViewModeToggle
              options={pieViewOptions as [typeof pieViewOptions[0], ...typeof pieViewOptions[0][]]}
              value={effectivePieView}
              onChange={(v) => setPieView(v as PieView)}
              size="sm"
            />
          )}
          <ViewModeToggle
            options={[
              { value: 'bar', label: 'Barras' },
              { value: 'pie', label: 'Gráfico' },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            size="sm"
          />
        </div>
      </div>

      {totalTargetDefined > 0 && totalTargetDefined !== 100 && viewMode === 'bar' && (
        <div className="px-2 py-0.5 bg-expense/10 text-expense border border-expense/20 rounded-lg text-[8px] font-bold self-start w-fit">
          Metas: {formatPercentBR(totalTargetDefined, 1)} (Ideal: 100%)
        </div>
      )}

      {/* Modo Barras */}
      {viewMode === 'bar' && (
        <div className="space-y-4">
          {allocationData.map((item) => {
            const color = CLASS_COLORS[item.name] || 'var(--color-primary)'
            const gap = item.targetPercentage - item.currentPercentage
            
            const hasTarget = item.targetPercentage > 0
            const isBelow = hasTarget && gap >= 3.0

            let statusLabel = 'Alinhado'
            let statusClass = 'text-income bg-income/10'
            let StatusIcon = CheckCircle2

            if (isBelow) {
              statusLabel = 'Abaixo'
              statusClass = 'text-primary bg-primary/10'
              StatusIcon = TrendingUp
            } else if (hasTarget && gap <= -3.0) {
              statusLabel = 'Excesso'
              statusClass = 'text-secondary bg-glass/10'
              StatusIcon = Info
            }

            return (
              <div key={item.name} className="space-y-2 hover:bg-glass/5 p-2 rounded-xl transition-all duration-300">
                {/* Linha principal */}
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-extrabold text-primary truncate">{item.name}</span>
                    <span className="font-mono text-secondary shrink-0">({formatCurrency(item.currentValue)})</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-mono text-primary font-bold shrink-0">
                      {formatPercentBR(item.currentPercentage, 1)}
                    </span>
                    {hasTarget && (
                      <>
                        <span className="text-[10px] text-secondary whitespace-nowrap">/ Alvo: {formatPercentBR(item.targetPercentage, 1)}</span>
                        <span className={`px-1.5 py-0.5 rounded-md font-bold text-[8px] uppercase tracking-wider flex items-center gap-1 shrink-0 ${statusClass}`}>
                          <StatusIcon size={9} />
                          {statusLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="w-full h-2 bg-glass/10 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: color,
                      width: `${Math.min(100, item.currentPercentage)}%`
                    }}
                  />
                  {hasTarget && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-glass-strong border-l border-bg-primary"
                      style={{ left: `${Math.min(100, item.targetPercentage)}%` }}
                      title={`Meta: ${item.targetPercentage}%`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modo Pizza */}
      {viewMode === 'pie' && currentPieData.length > 0 && (
        <div className="pt-2">
          <PortfolioPieChart
            data={currentPieData}
            innerRadius={65}
            outerRadius={105}
            onSliceClick={handlePieSliceClick}
          />
        </div>
      )}

      {viewMode === 'pie' && currentPieData.length === 0 && (
        <div className="py-8 text-center text-xs font-semibold text-secondary">
          Nenhum dado disponível para exibir no gráfico.
        </div>
      )}
    </Card>
  )
}
