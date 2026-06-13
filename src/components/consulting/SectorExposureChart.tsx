import Card from '@/components/Card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { ConsolidatedGroup } from '@/services/investmentEngine'
import { pickConsultingChartColor } from '@/utils/consultingChartPalette'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface SectorExposureChartProps {
  consolidatedSector: ConsolidatedGroup[]
}

export default function SectorExposureChart({ consolidatedSector }: SectorExposureChartProps) {
  const chartData = consolidatedSector
    .filter(item => item.total_value > 0)
    .map((item, idx) => {
      // Tenta mapear o setor pelo nome ou usa um índice da paleta
      const matchedColor = pickConsultingChartColor(idx)
      return {
        name: item.name,
        value: item.total_value,
        percentage: item.current_percentage,
        color: matchedColor
      }
    })

  return (
    <Card className="p-5 flex flex-col justify-between text-left h-full">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <PieIcon size={16} className="accent-primary" />
        Exposição Atual por Setor
      </h3>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-secondary italic">
          Nenhum dado de setor disponível para exibir.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart (5 colunas no desktop) */}
          <div className="md:col-span-5 h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  formatter={(value: number | string, _name: string, props: { payload?: { percentage?: number } }) => {
                    const formattedVal = formatCurrency(Number(value))
                    const pctVal = `(${formatNumberBR(props.payload?.percentage ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)`
                    return [`${formattedVal} ${pctVal}`, 'Alocação']
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda Lateral customizada (7 colunas no desktop) */}
          <div className="md:col-span-7 space-y-2">
            <div className="hidden sm:grid grid-cols-12 text-[9px] uppercase font-extrabold text-secondary/60 tracking-wider pb-1 border-b border-glass mb-2">
              <span className="col-span-7">Setor</span>
              <span className="col-span-5 text-right font-sans">Patrimônio / Peso</span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {chartData.map(item => (
                <div key={item.name} className="grid grid-cols-12 items-center gap-1 sm:gap-2 p-1.5 rounded-lg hover:bg-muted/5 transition-all text-xs font-sans">
                  {/* Identificação do setor com cor */}
                  <div className="col-span-7 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-primary truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>

                  {/* Valores e % */}
                  <div className="col-span-5 text-right">
                    <span className="font-mono font-bold text-primary block leading-none">
                      {formatCurrency(item.value)}
                    </span>
                    <span className="text-[10px] text-secondary font-mono leading-none">
                      {formatNumberBR(item.percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
