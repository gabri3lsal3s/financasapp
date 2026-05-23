import Card from '@/components/Card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip, Legend as ChartLegend } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface ClassChartItem {
  name: string
  value: number
  color: string
}

interface ClientAllocationChartsProps {
  classChartData: ClassChartItem[]
}

export default function ClientAllocationCharts({
  classChartData,
}: ClientAllocationChartsProps) {
  return (
    <Card className="p-5 flex flex-col justify-between shadow-sm border border-border/40 text-left h-full">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-indigo-500" />
        Distribuição de Ativos por Classe
      </h3>
      <div className="h-64 w-full flex items-center justify-center relative">
        {classChartData.length === 0 ? (
          <div className="text-xs text-secondary italic">Nenhuma classe de ativos disponível para exibir.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={classChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
              >
                {classChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip 
                formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Patrimônio']} 
                contentStyle={{
                  backgroundColor: 'var(--color-bg-card, #1e293b)',
                  borderColor: 'var(--color-border, #334155)',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary, #f8fafc)'
                }}
              />
              <ChartLegend verticalAlign="bottom" height={36} iconType="circle" fontSize={11} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
