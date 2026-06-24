import PortfolioPieChart from '@/components/investments/PortfolioPieChart'

interface PieChartsSectionProps {
  assetPieData: Array<{ name: string; value: number; percentage: number; color: string }>
  classPieData: Array<{ name: string; value: number; percentage: number; color: string }>
  handleAssetSliceClick: (sliceName: string) => void
  handleClassSliceClick: (sliceName: string) => void
}

export default function PieChartsSection({
  assetPieData,
  classPieData,
  handleAssetSliceClick,
  handleClassSliceClick,
}: PieChartsSectionProps) {
  if (assetPieData.length === 0 && classPieData.length === 0) return null

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Grid de gráficos pizza — responsivo sem toggle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
        {assetPieData.length > 0 && (
          <PortfolioPieChart
            title="Por Ativo"
            subtitle="Distribuição entre os ativos da carteira"
            data={assetPieData}
            innerRadius={45}
            outerRadius={70}
            onSliceClick={handleAssetSliceClick}
          />
        )}
        {classPieData.length > 0 && (
          <PortfolioPieChart
            title="Por Classe"
            subtitle="Distribuição por classe de ativos"
            data={classPieData}
            innerRadius={45}
            outerRadius={70}
            onSliceClick={handleClassSliceClick}
          />
        )}
      </div>
    </div>
  )
}
