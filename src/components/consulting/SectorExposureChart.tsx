import Card from '@/components/Card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip, Legend as ChartLegend } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { ConsolidatedGroup } from '@/services/investmentEngine'
import { pickConsultingChartColor } from '@/utils/consultingChartPalette'

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
    <Card className="p-5 flex flex-col justify-between shadow-sm border border-border/40 text-left h-full">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <PieIcon size={16} className="text-indigo-500" />
        Exposição Atual por Setor
      </h3>
      <div className="h-64 w-full flex items-center justify-center relative">
        {chartData.length === 0 ? (
          <div className="text-xs text-secondary italic">Nenhum dado de setor disponível para exibir.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip
                formatter={(value: any, _name: any, props: any) => {
                  const formattedVal = `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  const pctVal = `(${props.payload.percentage.toFixed(2)}%)`
                  return [`${formattedVal} ${pctVal}`, 'Alocação']
                }}
                contentStyle={{
                  backgroundColor: 'var(--color-bg-card, #1e293b)',
                  borderColor: 'var(--color-border, #334155)',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary, #f8fafc)'
                }}
              />
              <ChartLegend
                verticalAlign="bottom"
                height={40}
                iconType="circle"
                fontSize={11}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
