import { useState } from 'react'
import PortfolioPieChart from '@/components/investments/PortfolioPieChart'
import { ChevronDown } from 'lucide-react'

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
  const [showOnMobile, setShowOnMobile] = useState(false)

  if (assetPieData.length === 0 && classPieData.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Botão toggle para mobile — visível apenas em telas < md */}
      <button
        type="button"
        onClick={() => setShowOnMobile((prev) => !prev)}
        className="flex md:hidden items-center justify-between w-full p-3 rounded-2xl border border-glass/30 bg-glass/5 text-xs font-black uppercase tracking-wider text-primary transition-all hover:bg-glass/10"
      >
        <span>Distribuição da Carteira</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${
            showOnMobile ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Grid de gráficos pizza — sempre visível em md+, toggleável em mobile */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${
          showOnMobile ? 'block' : 'hidden md:grid'
        }`}
      >
        {assetPieData.length > 0 && (
          <PortfolioPieChart
            title="Por Ativo"
            subtitle="Distribuição entre os ativos da carteira"
            data={assetPieData}
            innerRadius={50}
            outerRadius={80}
            onSliceClick={handleAssetSliceClick}
          />
        )}
        {classPieData.length > 0 && (
          <PortfolioPieChart
            title="Por Classe"
            subtitle="Distribuição por classe de ativos"
            data={classPieData}
            innerRadius={50}
            outerRadius={80}
            onSliceClick={handleClassSliceClick}
          />
        )}
      </div>
    </div>
  )
}
