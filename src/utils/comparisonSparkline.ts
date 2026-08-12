/**
 * Helpers puros do sparkline comparativo (DRY): construção de path SVG e
 * acumulação de séries (curva de gastos acumulados). Vivem em utils/ para
 * reuso e testabilidade — formatação monetária fica em format.ts.
 */
import { roundToDecimals } from '@/utils/format'

/** Acumula uma série numérica (ex.: gastos diários → curva acumulada do mês). */
export function accumulateSeries(values: number[], decimals = 2): number[] {
  let acc = 0
  return values.map((value) => {
    acc += value
    return roundToDecimals(acc, decimals)
  })
}

/** Constrói o path SVG de uma série normalizada ao viewBox (viewBox fixo). */
export function buildSparklinePath(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number,
): string {
  if (values.length === 0) return ''

  const padding = 2
  const range = max - min
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0

  const points = values.map((value, index) => {
    const x = values.length > 1 ? padding + index * stepX : width / 2
    const normalized = range > 0 ? (value - min) / range : 0.5
    const y = height - padding - normalized * (height - padding * 2)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  return `M ${points.join(' L ')}`
}
