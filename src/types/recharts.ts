import type { AnimationTiming } from 'recharts/types/util/types'

export type ChartTooltipEntry = {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

/** Props de animação Recharts — cubic-bezier exige cast via unknown (não está em AnimationTiming). */
type ChartAnimProps = {
  isAnimationActive: boolean
  animationDuration: number
  animationEasing: AnimationTiming
}

export function chartAnimProps(durationGlass = 1200): ChartAnimProps {
  return {
    isAnimationActive: true,
    animationDuration: durationGlass,
    animationEasing: 'ease-out' as AnimationTiming,
  }
}
