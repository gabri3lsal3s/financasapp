import { useState, Fragment } from 'react'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts'
import { ChartTooltip, ChartSeriesBadges, type ChartSeriesBadgeItem } from './reportsChartShared'

interface WeekdayData {
  dia: string
  Despesas: number
  Rendas: number
  Investimentos: number
  'Despesas (Mês Ant.)'?: number
  'Rendas (Mês Ant.)'?: number
  'Investimentos (Mês Ant.)'?: number
}

interface WeekdayExpenseChartProps {
  data: WeekdayData[]
}

const SERIES: ChartSeriesBadgeItem[] = [
  { key: 'Despesas',      label: 'Despesas',      color: 'var(--color-expense)' },
  { key: 'Rendas',        label: 'Rendas',        color: 'var(--color-income)'  },
  { key: 'Investimentos', label: 'Investimentos', color: 'var(--color-balance)' },
]

const SERIES_STYLE: Record<string, { fillOpacity: number; strokeWidth: number }> = {
  Despesas:      { fillOpacity: 0.18, strokeWidth: 2 },
  Rendas:        { fillOpacity: 0.15, strokeWidth: 2 },
  Investimentos: { fillOpacity: 0.13, strokeWidth: 2 },
}

export default function WeekdayExpenseChart({ data }: WeekdayExpenseChartProps) {
  // Por padrão, apenas Despesas visível
  const [hidden, setHidden] = useState<string[]>(['Rendas', 'Investimentos'])

  const toggle = (key: string) =>
    setHidden((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )

  // WHY: Calcula o valor máximo ativo para evitar que o Recharts estique séries zeradas até as bordas
  const activeKeys = SERIES.filter((s) => !hidden.includes(s.key)).flatMap((s) => {
    const keys = [s.key]
    const compKey = `${s.key} (Mês Ant.)`
    const hasCompData = data.some((d) => (d as unknown as Record<string, unknown>)[compKey] !== undefined)
    if (hasCompData) {
      keys.push(compKey)
    }
    return keys
  })

  const maxValue = data.length > 0 && activeKeys.length > 0
    ? Math.max(...data.flatMap((d) => activeKeys.map((k) => Number((d as unknown as Record<string, unknown>)[k] || 0))))
    : 0

  return (
    <div className="flex flex-col gap-5">
      <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={0}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="var(--color-border)" strokeOpacity={0.15} />
          <PolarAngleAxis
            dataKey="dia"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            domain={[0, maxValue > 0 ? 'auto' : 1]}
            tick={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          {SERIES.map((s) => {
            const compKey = `${s.key} (Mês Ant.)`
            const hasCompData = data.some((d) => (d as unknown as Record<string, unknown>)[compKey] !== undefined)
            
            return (
              <Fragment key={s.key}>
                {!hidden.includes(s.key) && (
                  <Radar
                    name={s.label}
                    dataKey={s.key}
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={SERIES_STYLE[s.key].fillOpacity}
                    strokeWidth={SERIES_STYLE[s.key].strokeWidth}
                    isAnimationActive={false}
                  />
                )}
                {!hidden.includes(s.key) && hasCompData && (
                  <Radar
                    name={`${s.label} (Mês Ant.)`}
                    dataKey={compKey}
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={0.04}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.5}
                    isAnimationActive={false}
                  />
                )}
              </Fragment>
            )
          })}
        </RadarChart>
      </ResponsiveContainer>

      {/* Legenda padronizada — afastada abaixo do gráfico */}
      <ChartSeriesBadges
        items={SERIES}
        hiddenSeries={hidden}
        onToggle={toggle}
        preventEmpty
        className="pb-1"
      />
    </div>
  )
}
