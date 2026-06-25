import { useState } from 'react'
import PortfolioPieChart from '@/components/investments/PortfolioPieChart'
import ViewModeToggle from '@/components/ViewModeToggle'
import type { ViewModeOption } from '@/components/ViewModeToggle'

interface PieChartsSectionProps {
  assetPieData: Array<{ name: string; value: number; percentage: number; color: string }>
  classPieData: Array<{ name: string; value: number; percentage: number; color: string }>
  sectorPieData: Array<{ name: string; value: number; percentage: number; color: string }>
  handleAssetSliceClick: (sliceName: string) => void
  handleClassSliceClick: (sliceName: string) => void
  handleSectorSliceClick: (sliceName: string) => void
}

type ViewMode = 'asset' | 'class' | 'sector'

export default function PieChartsSection({
  assetPieData,
  classPieData,
  sectorPieData,
  handleAssetSliceClick,
  handleClassSliceClick,
  handleSectorSliceClick,
}: PieChartsSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('asset')

  const hasAssetData = assetPieData.length > 0
  const hasClassData = classPieData.length > 0
  const hasSectorData = sectorPieData.length > 0

  if (!hasAssetData && !hasClassData && !hasSectorData) return null

  // Se o modo atual não tiver dados, escolhe o primeiro disponível
  const availableModes: ViewMode[] = [
    ...(hasAssetData ? ['asset' as const] : []),
    ...(hasClassData ? ['class' as const] : []),
    ...(hasSectorData ? ['sector' as const] : []),
  ]
  const effectiveMode = availableModes.includes(viewMode) ? viewMode : availableModes[0]

  const currentData =
    effectiveMode === 'asset' ? assetPieData :
    effectiveMode === 'class' ? classPieData :
    sectorPieData

  const currentOnClick =
    effectiveMode === 'asset' ? handleAssetSliceClick :
    effectiveMode === 'class' ? handleClassSliceClick :
    handleSectorSliceClick

  const subtitle =
    effectiveMode === 'asset'
      ? 'Distribuição entre os ativos da carteira'
      : effectiveMode === 'class'
        ? 'Distribuição por classe de ativos'
        : 'Distribuição por setor'

  // Monta opções do seletor — garantido não-vazio
  const viewOptions: [ViewModeOption, ...ViewModeOption[]] = availableModes.map((m) => ({
    value: m,
    label:
      m === 'asset' ? 'Por Ativo' :
      m === 'class' ? 'Por Classe' :
      'Por Setor',
  })) as [ViewModeOption, ...ViewModeOption[]]

  return (
    <div className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-5 lg:space-y-6 text-left">
      {/* Cabeçalho com seletor de visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-glass/40 pb-3">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">
            Distribuição da Carteira
          </h4>
          <p className="text-[10px] text-secondary font-medium mt-0.5">{subtitle}</p>
        </div>
        <ViewModeToggle
          options={viewOptions}
          value={effectiveMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          size="md"
        />
      </div>

      {/* Gráfico único ocupando toda a largura */}
      <PortfolioPieChart
        data={currentData}
        innerRadius={60}
        outerRadius={100}
        onSliceClick={currentOnClick}
      />
    </div>
  )
}
