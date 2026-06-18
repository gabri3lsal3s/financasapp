/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

import type { ChartTooltipEntry } from '@/types/recharts'
import type { Payload } from 'recharts/types/component/DefaultLegendContent'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'

// ─── Formatação de eixo ──────────────────────────────────────────────────────

export function formatChartAxisTick(value: number): string {
  const numericValue = Number.isFinite(value) ? value : 0
  if (numericValue >= 1000) {
    return `R$ ${formatNumberBR(numericValue / 1000, { maximumFractionDigits: 0 })}k`
  }
  return `R$ ${formatNumberBR(numericValue, { maximumFractionDigits: 0 })}`
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = formatCurrency,
}: {
  active?: boolean
  payload?: ChartTooltipEntry[]
  label?: string | number
  formatValue?: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="surface-glass-strong border border-glass p-2.5 rounded-xl shadow-lg glass-shadow-tooltip backdrop-blur-md min-w-[150px] flex flex-col gap-1">
      {label && (
        <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider border-b border-glass pb-1 mb-1">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-secondary truncate">{entry.name}</span>
            </div>
            <span className="font-semibold text-primary font-mono whitespace-nowrap">
              {formatValue(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pie Tooltip ─────────────────────────────────────────────────────────────

export function PieTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ChartTooltipEntry[]
}) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload as { name?: string; value?: number; color?: string } | undefined
  if (!point) return null

  return (
    <div className="surface-glass-strong border border-glass p-2.5 rounded-xl shadow-lg glass-shadow-tooltip backdrop-blur-md min-w-[130px] flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: point.color || payload[0].color || 'var(--color-primary)' }} />
        <span className="truncate">{point.name}</span>
      </div>
      <p className="text-xs font-mono font-bold text-primary mt-1">
        {formatCurrency(Number(point.value ?? 0))}
      </p>
    </div>
  )
}

// ─── ChartSeriesBadge ─────────────────────────────────────────────────────────
// Badge unitário para legenda de série de gráfico.
// Clicável para toggle de visibilidade, com ponto colorido e label.

export interface ChartSeriesBadgeItem {
  /** Chave única da série (usada para toggle) */
  key: string
  /** Label exibida */
  label: string
  /** Cor da série (CSS color ou var(--...)) */
  color: string
  /** Se a série é tracejada (comparação com período anterior) */
  dashed?: boolean
}

interface ChartSeriesBadgeProps {
  item: ChartSeriesBadgeItem
  isHidden: boolean
  isLastVisible?: boolean
  onToggle: (key: string) => void
}

export function ChartSeriesBadge({ item, isHidden, isLastVisible = false, onToggle }: ChartSeriesBadgeProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!isLastVisible) onToggle(item.key)
      }}
      disabled={isLastVisible}
      title={
        isLastVisible
          ? 'Pelo menos 1 série deve ficar visível'
          : isHidden
            ? `Mostrar ${item.label}`
            : `Ocultar ${item.label}`
      }
      aria-pressed={!isHidden}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
        'transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        isHidden
          ? 'opacity-40 border-glass bg-transparent text-secondary'
          : 'border-glass/60 surface-glass shadow-sm text-primary',
        isLastVisible ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80',
      ].join(' ')}
    >
      {/* Ponto colorido — sólido ou tracejado/anel para séries de comparação */}
      {item.dashed ? (
        <span
          className="w-3 h-[2px] rounded-full flex-shrink-0 opacity-70"
          style={{
            background: `repeating-linear-gradient(90deg, ${item.color} 0px, ${item.color} 3px, transparent 3px, transparent 5px)`,
          }}
        />
      ) : (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: item.color,
            boxShadow: isHidden ? 'none' : `0 0 5px ${item.color}70`,
          }}
        />
      )}
      <span className="leading-none truncate max-w-[110px]">{item.label}</span>
    </button>
  )
}

// ─── ChartSeriesBadges ────────────────────────────────────────────────────────
// Contêiner de badges de séries — use fora do ResponsiveContainer para legendas
// externas (ex: WeekdayExpenseChart) ou como bloco autônomo abaixo de um gráfico.

interface ChartSeriesBadgesProps {
  items: ChartSeriesBadgeItem[]
  hiddenSeries: string[]
  onToggle: (key: string) => void
  /** Se true, impede desmarcar a última série visível */
  preventEmpty?: boolean
  className?: string
}

export function ChartSeriesBadges({
  items,
  hiddenSeries,
  onToggle,
  preventEmpty = true,
  className = '',
}: ChartSeriesBadgesProps) {
  if (!items.length) return null

  const visibleCount = items.filter((item) => !hiddenSeries.includes(item.key)).length

  return (
    <div className={`flex flex-wrap gap-1.5 justify-center px-1 ${className}`}>
      {items.map((item) => {
        const isHidden = hiddenSeries.includes(item.key)
        const isLastVisible = preventEmpty && !isHidden && visibleCount === 1
        return (
          <ChartSeriesBadge
            key={item.key}
            item={item}
            isHidden={isHidden}
            isLastVisible={isLastVisible}
            onToggle={onToggle}
          />
        )
      })}
    </div>
  )
}

// ─── InteractiveChartLegend ───────────────────────────────────────────────────
// Compatível com <Legend content={...}> do Recharts.
// Filtra séries de comparação (Mês/Ano Ant.) da legenda principal.

interface InteractiveChartLegendProps {
  payload?: Payload[]
  hiddenSeries: string[]
  onToggle: (dataKey: string) => void
}

export function InteractiveChartLegend({ payload, hiddenSeries, onToggle }: InteractiveChartLegendProps) {
  const items = useMemo<ChartSeriesBadgeItem[]>(() => {
    if (!payload?.length) return []
    return payload
      .filter((entry) => {
        const dataKey = String(entry.dataKey ?? entry.value ?? '')
        // Ocultar séries de comparação da legenda (são tracejadas e vinculadas à série principal)
        return !dataKey.includes('(Mês Ant.)') && !dataKey.includes('(Ano Ant.)') && !dataKey.includes('Ant.')
      })
      .map((entry) => ({
        key: String(entry.dataKey ?? entry.value ?? ''),
        label: String(entry.value ?? entry.dataKey ?? ''),
        color: String(entry.color ?? 'var(--color-primary)'),
      }))
  }, [payload])

  return (
    <ChartSeriesBadges
      items={items}
      hiddenSeries={hiddenSeries}
      onToggle={onToggle}
      preventEmpty
      className="pt-2"
    />
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[]
  compareData?: number[]
  color: string
  height?: number
  width?: number | string
}

export function Sparkline({ data, compareData, color, height = 32, width = '100%' }: SparklineProps) {
  const chartData = useMemo(() => {
    const len = Math.max(data.length, compareData?.length ?? 0)
    if (len === 0) {
      return Array.from({ length: 10 }, (_, idx) => ({ idx, value: 0 }))
    }
    return Array.from({ length: len }, (_, idx) => ({
      idx,
      value: data[idx] ?? 0,
      ...(compareData ? { compareValue: compareData[idx] ?? 0 } : {}),
    }))
  }, [data, compareData])

  return (
    <ResponsiveContainer width={width} height={height} minWidth={0} minHeight={0}>
      <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {compareData && compareData.length > 0 && (
          <Area
            type="monotone"
            dataKey="compareValue"
            stroke={color}
            strokeWidth={1}
            strokeDasharray="2 2"
            fill="transparent"
            dot={false}
            opacity={0.35}
            isAnimationActive={false}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
