import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  CartesianGrid
} from 'recharts'
import { formatCurrency } from '@/utils/format'

interface ChartItem {
  name: string
  value: number
  active?: boolean
}

interface InteractiveAIChartProps {
  chartData?: ChartItem[]
  onBarClick?: (item: ChartItem) => void
}

export const InteractiveAIChart: React.FC<InteractiveAIChartProps> = ({
  chartData = [],
  onBarClick
}) => {
  if (!chartData || chartData.length === 0) return null

  // Auto-detect single correct chart type based on content of chartData
  const isCategory = chartData.some(d => 
    ['Lazer', 'Transporte', 'Assinaturas', 'Supermercado', 'Carro', 'Capex', 'Compras', 'Outros'].includes(d.name) ||
    (!['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM', 'HOJE', 'LIMITE', 'META', 'CONSUMO'].includes(d.name.toUpperCase()))
  )

  const isLimitComparison = chartData.some(d => 
    ['LIMITE', 'META', 'ORÇAMENTO', 'ORCAMENTO'].includes(d.name.toUpperCase())
  )

  const chartType: 'bar' | 'donut' | 'comparison' = isCategory ? 'donut' : isLimitComparison ? 'comparison' : 'bar'

  // Using theme-based colors (tints of primary, income, expense, balance)
  const COLORS = [
    'var(--color-primary)',
    'var(--color-income)',
    'var(--color-balance)',
    'var(--color-warning)',
    'var(--color-tier-s)',
    'var(--color-tier-a)',
    'var(--color-tier-b)'
  ]

  // Custom polished Tooltip conforming to main app's dark/light modes
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-glass p-2.5 rounded-xl shadow-lg text-[10px] font-semibold text-primary space-y-1">
          <p className="font-extrabold uppercase text-secondary font-mono tracking-wider">{label}</p>
          {payload.map((item: any, i: number) => (
            <p key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
              <span className="text-secondary">{item.name}:</span>
              <span className="font-bold text-primary font-mono">
                {formatCurrency(item.value)}
              </span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-2xl p-4 border border-glass bg-secondary/5 space-y-3.5 mt-4">
      {/* Dynamic Title based on Auto-Detected Type */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-secondary tracking-wider">
          {chartType === 'donut' && 'Distribuição por Categoria'}
          {chartType === 'bar' && 'Evolução dos Gastos'}
          {chartType === 'comparison' && 'Acompanhamento de Metas'}
        </span>
        <span className="text-[8px] font-bold font-mono text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
          IA Analítico
        </span>
      </div>

      {/* Main Container */}
      <div className="h-36 w-full flex items-center justify-center">
        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" strokeOpacity={0.4} />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: '800', fontFamily: 'monospace' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: '800', fontFamily: 'monospace' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-secondary)', opacity: 0.1 }} />
              <Bar 
                dataKey="value" 
                name="Gasto"
                radius={[5, 5, 0, 0]}
                onClick={(data) => onBarClick && onBarClick(data)}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.active ? 'var(--color-primary)' : 'var(--color-text-secondary)'} 
                    className="cursor-pointer hover:opacity-85 transition-opacity"
                    fillOpacity={entry.active ? 1.0 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === 'donut' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === 'comparison' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 30, left: -15, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--glass-border)" strokeOpacity={0.4} />
              <XAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 8, fontWeight: '800', fontFamily: 'monospace' }}
              />
              <YAxis 
                type="category"
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: '800' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} barSize={14}>
                {chartData.map((entry, index) => {
                  const isLimite = entry.name.toUpperCase() === 'LIMITE' || entry.name.toUpperCase() === 'META'
                  let fillColor = 'var(--color-text-secondary)' // default grey for limit
                  let opacity = 0.5
                  
                  if (!isLimite) {
                    opacity = 1.0
                    // It's the "HOJE" or consumption bar. Let's check if it's over the limit
                    const limitEntry = chartData.find(d => d.name.toUpperCase() === 'LIMITE' || d.name.toUpperCase() === 'META')
                    const limitVal = limitEntry ? limitEntry.value : Infinity
                    fillColor = entry.value > limitVal ? 'var(--color-expense)' : 'var(--color-income)'
                  }
                  
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={fillColor}
                      fillOpacity={opacity}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Polish Legend details below the chart */}
      {chartType === 'donut' && (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 pt-2 border-t border-glass">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span>{entry.name}:</span>
              <span className="text-primary font-mono">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      )}

      {chartType === 'bar' && (
        <div className="text-[9px] font-bold text-secondary text-center select-none pt-1">
          Gráfico diário de evolução. O dia destacado indica gastos elevados.
        </div>
      )}

      {chartType === 'comparison' && (
        <div className="text-[9px] font-bold text-secondary text-center select-none pt-1">
          Barra verde indica que os gastos estão dentro da meta recomendada.
        </div>
      )}
    </div>
  )
}
