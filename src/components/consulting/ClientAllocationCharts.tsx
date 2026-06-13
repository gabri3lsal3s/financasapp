import Card from '@/components/Card'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip } from 'recharts'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { ConsolidatedGroup } from '@/services/investmentEngine'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface ClassChartItem {
  name: string
  value: number
  color: string
}

interface ClientAllocationChartsProps {
  classChartData: ClassChartItem[]
  consolidatedClass?: ConsolidatedGroup[]
}

export default function ClientAllocationCharts({
  classChartData,
  consolidatedClass = []
}: ClientAllocationChartsProps) {
  // Se não houver dados consolidados detalhados, reconstrói de forma aproximada para manter retrocompatibilidade
  const displayGroups = consolidatedClass.length > 0
    ? consolidatedClass
    : classChartData.map(item => ({
        name: item.name,
        total_value: item.value,
        current_percentage: 0,
        target_percentage: 0,
        yield_pct: 0,
        cost_basis: 0
      }))

  return (
    <Card className="p-5 flex flex-col justify-between text-left h-full">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-balance" />
        Distribuição de Ativos por Classe
      </h3>

      {classChartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-secondary italic">
          Nenhuma classe de ativos disponível para exibir.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart (5 colunas no desktop) */}
          <div className="md:col-span-5 h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={classChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {classChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip 
                  formatter={(value: number | string) => [formatCurrency(Number(value)), 'Patrimônio']} 
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-secondary, rgb(30, 41, 59))',
                    borderColor: 'var(--color-border, rgb(51, 65, 85))',
                    borderRadius: '12px',
                    color: 'var(--color-text-primary, rgb(248, 250, 252))'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda Lateral Enriquecida (7 colunas no desktop) */}
          <div className="md:col-span-7 space-y-2">
            <div className="hidden sm:grid grid-cols-12 text-[9px] uppercase font-extrabold text-secondary/60 tracking-wider pb-1 border-b border-glass mb-2">
              <span className="col-span-5">Classe</span>
              <span className="col-span-4 text-right">Patrimônio / Meta</span>
              <span className="col-span-3 text-right">Desvio</span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {displayGroups.map(group => {
                const chartItem = classChartData.find(c => c.name === group.name)
                const color = chartItem ? chartItem.color : 'rgb(100, 116, 139)'
                const deviation = group.current_percentage - group.target_percentage
                
                let devIcon = <Minus size={11} className="text-secondary/50" />
                let devColor = 'text-secondary/60 bg-muted/30 border-glass'
                if (deviation > 0.5) {
                  devIcon = <ArrowUpRight size={11} className="text-income" />
                  devColor = 'text-income bg-income/10 border-income/20'
                } else if (deviation < -0.5) {
                  devIcon = <ArrowDownRight size={11} className="text-expense" />
                  devColor = 'text-expense bg-expense/10 border-expense/20'
                }

                return (
                  <div key={group.name} className="grid grid-cols-12 items-center gap-1 sm:gap-2 p-1.5 rounded-lg hover:bg-muted/5 transition-all text-xs font-sans">
                    {/* Identificação da classe com cor */}
                    <div className="col-span-5 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-primary truncate" title={group.name}>
                        {group.name}
                      </span>
                    </div>

                    {/* Valores e % meta */}
                    <div className="col-span-4 text-right">
                      <span className="font-mono font-bold text-primary block leading-none">
                        {formatCurrency(group.total_value)}
                      </span>
                      {group.current_percentage > 0 && (
                        <span className="text-[10px] text-secondary font-mono leading-none">
                          {formatNumberBR(group.current_percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% <span className="text-secondary/40">/ {formatNumberBR(group.target_percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                        </span>
                      )}
                    </div>

                    {/* Desvio */}
                    <div className="col-span-3 text-right">
                      {group.current_percentage > 0 ? (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold font-mono rounded border ${devColor}`}>
                          {devIcon}
                          <span>{deviation > 0 ? '+' : ''}{formatNumberBR(deviation, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-secondary/40 font-mono">-</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

