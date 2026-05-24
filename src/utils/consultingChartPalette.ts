/** Paleta semântica para gráficos de consultoria (tokens HSL do design system). */
export const CONSULTING_CHART_COLORS = [
  'hsl(var(--color-income))',
  'hsl(var(--color-balance))',
  'hsl(var(--color-expense))',
  'hsl(var(--ds-color-primary))',
  'hsl(var(--ds-color-secondary))',
  'hsl(var(--ds-color-accent))',
] as const

export const pickConsultingChartColor = (index: number): string =>
  CONSULTING_CHART_COLORS[index % CONSULTING_CHART_COLORS.length]
