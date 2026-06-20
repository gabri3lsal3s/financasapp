import { useRef, useEffect } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Search } from 'lucide-react'
import { formatCurrency, formatPercentBR } from '@/utils/format'

interface PieSegmentData {
  name: string
  value: number
  percent: number
  target: number
  yield_pct?: number
  gross_yield_pct?: number
  net_yield_pct?: number
}

interface AllocationPieChartProps {
  pieData: PieSegmentData[]
  chartPalette: string[]
  consolidationView: 'class' | 'sector'
  setConsolidationView: (view: 'class' | 'sector') => void
  hoveredPieSegment: PieSegmentData | null
  setHoveredPieSegment: (segment: PieSegmentData | null) => void
  selectedPieSegment: PieSegmentData | null
  setSelectedPieSegment: (segment: PieSegmentData | null) => void
  totalValue: number
  onViewDetailedAssets: (groupName: string) => void
}

export default function AllocationPieChart({
  pieData,
  chartPalette,
  consolidationView,
  setConsolidationView,
  hoveredPieSegment,
  setHoveredPieSegment,
  selectedPieSegment,
  setSelectedPieSegment,
  totalValue,
  onViewDetailedAssets,
}: AllocationPieChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        selectedPieSegment &&
        chartContainerRef.current &&
        !chartContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedPieSegment(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [selectedPieSegment, setSelectedPieSegment])

  return (
    <Card className="p-4 lg:p-6 flex flex-col items-center relative overflow-hidden">
      <div className="w-full flex items-center justify-between gap-3 mb-4 pb-2 border-b border-primary/5">
        <h4 className="text-xs font-black uppercase tracking-wider text-primary">Alocação Atual</h4>

        <div className="flex items-center bg-secondary/50 rounded-xl p-0.5 w-40 h-[32px] select-none">
          <button
            type="button"
            onClick={() => {
              setConsolidationView('class')
              setSelectedPieSegment(null)
            }}
            className={`flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all ${
              consolidationView === 'class'
                ? 'bg-glass-strong text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Classes
          </button>
          <button
            type="button"
            onClick={() => {
              setConsolidationView('sector')
              setSelectedPieSegment(null)
            }}
            className={`flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all ${
              consolidationView === 'sector'
                ? 'bg-glass-strong text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Setores
          </button>
        </div>
      </div>

      {pieData.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center text-secondary italic text-xs">
          Nenhum ativo alocado para gerar o gráfico.
        </div>
      ) : (
        <>
          <div
            ref={chartContainerRef}
            onClick={() => setSelectedPieSegment(null)}
            className="relative w-full h-64 sm:h-80 cursor-pointer"
          >
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="62%"
                    outerRadius="82%"
                    paddingAngle={3}
                    dataKey="value"
                    onMouseEnter={(_, index) => {
                      if (window.matchMedia('(hover: hover)').matches) {
                        if (pieData[index]) setHoveredPieSegment(pieData[index])
                      }
                    }}
                    onMouseLeave={() => setHoveredPieSegment(null)}
                    onClick={(_, index, event) => {
                      if (event && event.stopPropagation) {
                        event.stopPropagation()
                      }
                      const segment = pieData[index]
                      if (segment) {
                        setSelectedPieSegment(
                          selectedPieSegment?.name === segment.name ? null : segment
                        )
                      }
                    }}
                  >
                    {pieData.map((entry, index) => {
                      const isSelected = selectedPieSegment ? selectedPieSegment.name === entry.name : false
                      const hasSelection = selectedPieSegment !== null
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={chartPalette[index % chartPalette.length]}
                          stroke="var(--color-border)"
                          strokeWidth={isSelected ? 2.5 : 1}
                          opacity={hasSelection ? (isSelected ? 1.0 : 0.4) : 1.0}
                          className="outline-none cursor-pointer transition-all duration-300"
                        />
                      )
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Texto no Centro do Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <div className="max-w-[150px] text-center flex flex-col items-center justify-center">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-secondary leading-tight line-clamp-2">
                  {hoveredPieSegment
                    ? hoveredPieSegment.name
                    : selectedPieSegment
                    ? selectedPieSegment.name
                    : 'Patrimônio Total'}
                </span>
                <span className="text-base sm:text-lg font-black text-primary font-mono mt-1.5 leading-tight">
                  {hoveredPieSegment
                    ? formatCurrency(hoveredPieSegment.value)
                    : selectedPieSegment
                    ? formatCurrency(selectedPieSegment.value)
                    : formatCurrency(totalValue)}
                </span>
                <span className="text-[10px] font-bold text-income mt-1 font-mono leading-none">
                  {hoveredPieSegment
                    ? `${formatPercentBR(hoveredPieSegment.percent, 1)}`
                    : selectedPieSegment
                    ? `${formatPercentBR(selectedPieSegment.percent, 1)}`
                    : '100.0%'}
                </span>
              </div>
            </div>
          </div>

          {selectedPieSegment && (
            <div className="w-full flex justify-center animate-fade-in mt-1 select-none">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewDetailedAssets(selectedPieSegment.name)}
                className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider uppercase text-balance hover:bg-balance/5 !min-h-0 h-auto py-1.5 px-3.5 rounded-full transition-all"
              >
                <Search size={12} className="text-balance" />
                <span>Ver ativos detalhados</span>
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
