import { CSSProperties, ReactNode } from 'react'
import Card from '@/components/Card'
import { Sparkline } from '@/components/reports/reportsChartShared'
import { formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: ReactNode
  subtext?: ReactNode
  icon: ReactNode
  glowColor?: string
  showGlow?: boolean
  sparklineData?: number[]
  compareSparklineData?: number[]
  trendPercent?: number | null
  trendSuffix?: string
  isDespesa?: boolean
  isTrendPositive?: boolean
  index?: number
  staggerClass?: string
  className?: string
  valueTooltip?: string
  children?: ReactNode
  onClick?: () => void
  style?: CSSProperties
}

const STAGGER_STEPS = [50, 100, 150, 200, 250, 300, 400, 500]

function getDelayClass(idx?: number): string {
  if (idx === undefined) return ''
  const stepVal = STAGGER_STEPS[Math.min(idx, STAGGER_STEPS.length - 1)]
  return `delay-${stepVal}`
}

export default function KpiCard({
  title,
  value,
  subtext,
  icon,
  glowColor = 'var(--color-primary)',
  sparklineData,
  compareSparklineData,
  trendPercent,
  trendSuffix = '%',
  isDespesa = false,
  isTrendPositive,
  index,
  staggerClass = '',
  className = '',
  valueTooltip,
  children,
  onClick,
  style,
}: KpiCardProps) {
  const isPositive = isTrendPositive !== undefined
    ? isTrendPositive
    : (trendPercent !== undefined && trendPercent !== null ? trendPercent >= 0 : true)

  const showTrend = trendPercent !== undefined && trendPercent !== null
  const delayClass = staggerClass || getDelayClass(index)

  return (
    <Card
      className={cn(
        'h-full relative overflow-hidden flex flex-col !p-3 sm:!p-5 border border-glass surface-glass transition-all hover:border-glass-strong hover:shadow-md',
        delayClass,
        className
      )}
      style={style}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="min-w-0 flex-1 pr-8 sm:pr-0 text-left">
          <p className="text-[9px] xs:text-[10px] font-bold uppercase tracking-widest text-secondary leading-tight whitespace-normal sm:truncate">
            {title}
          </p>
          {typeof value === 'string' || typeof value === 'number' ? (
            <p
              className="text-[clamp(11px,3.3vw,1.25rem)] font-extrabold font-mono text-primary mt-1.5 xs:mt-2.5 leading-none whitespace-nowrap"
              title={valueTooltip || String(value)}
            >
              {value}
            </p>
          ) : (
            <div className="mt-1.5 xs:mt-2.5 leading-none">
              {value}
            </div>
          )}
        </div>

        <span
          className="absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `${glowColor}15`,
            color: glowColor,
          }}
        >
          {icon}
        </span>
      </div>

      {/* Embedded Sparkline */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3.5 h-8 w-full overflow-hidden flex items-end">
          <Sparkline 
            data={sparklineData} 
            compareData={compareSparklineData} 
            color={glowColor} 
            height={28} 
          />
        </div>
      )}

      {/* Bottom row: Subtext and trend badge */}
      {(subtext || showTrend) && (
        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-glass/40 text-[9px] xs:text-[10px] font-semibold mt-auto">
          <span className="text-secondary whitespace-normal sm:truncate leading-normal text-left">
            {subtext}
          </span>
          {showTrend && trendPercent !== null && (
            <span
              className={cn(
                'shrink-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold',
                isDespesa
                  ? (isPositive ? 'text-expense bg-expense/10' : 'text-income bg-income/10')
                  : (isPositive ? 'text-income bg-income/10' : 'text-expense bg-expense/10')
              )}
            >
              {isPositive && trendPercent > 0 ? '+' : ''}
              {formatNumberWithTwoDecimalsBR(trendPercent)}
              {trendSuffix}
            </span>
          )}
        </div>
      )}

      {children}
    </Card>
  )
}
