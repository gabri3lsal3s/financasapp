import type { AnimationTiming } from 'recharts/types/util/types'

export type ChartTooltipEntry = {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

export type ChartLegendEntry = {
  value?: string
  color?: string
  dataKey?: string | number
}

export type PieLabelProps = {
  cx: number
  cy: number
  midAngle: number
  outerRadius: number
  pct: string | number
}

/** Props de animação Recharts — cubic-bezier exige cast via unknown (não está em AnimationTiming). */
export type ChartAnimProps = {
  isAnimationActive: boolean
  animationDuration: number
  animationEasing: AnimationTiming
}

export function chartAnimProps(visualStyle: string, durationCyber = 1200, durationClassic = 700): ChartAnimProps {
  const easing = visualStyle === 'cyberpunk'
    ? ('cubic-bezier(0.34, 1.56, 0.64, 1)' as unknown as AnimationTiming)
    : 'ease-out'
  return {
    isAnimationActive: true,
    animationDuration: visualStyle === 'cyberpunk' ? durationCyber : durationClassic,
    animationEasing: easing,
  }
}
