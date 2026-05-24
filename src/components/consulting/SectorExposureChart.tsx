import Card from '@/components/Card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip, Legend as ChartLegend } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { ConsolidatedGroup } from '@/services/investmentEngine'

interface SectorExposureChartProps {
  consolidatedSector: ConsolidatedGroup[]
}

const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#14b8a6', '#6366f1', '#a855f7',
  '#f97316', '#84cc16', '#475569', '#eab308'
]

const SECTOR_COLORS_MAP: Record<string, string> = {
  'Financeiro': '#3b82f6',
  'Energia': '#10b981',
  'Energia Elétrica': '#10b981',
  'Materiais Básicos': '#f59e0b',
  'Petróleo e Gás': '#ef4444',
  'Petróleo, Gás e Biocombustíveis': '#ef4444',
  'Consumo': '#8b5cf6',
  'Consumo Não Cíclico': '#8b5cf6',
  'Consumo Cíclico': '#ec4899',
  'Telecomunicações': '#06b6d4',
  'Tecnologia': '#14b8a6',
  'Tecnologia da Informação': '#14b8a6',
  'Saneamento': '#6366f1',
  'Outros': '#64748b'
}

export default function SectorExposureChart({ consolidatedSector }: SectorExposureChartProps) {
  const chartData = consolidatedSector
    .filter(item => item.total_value > 0)
    .map((item, idx) => {
      // Tenta mapear o setor pelo nome ou usa um índice da paleta
      const matchedColor = SECTOR_COLORS_MAP[item.name] || COLOR_PALETTE[idx % COLOR_PALETTE.length]
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
