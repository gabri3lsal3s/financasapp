import { Skeleton as SkeletonPrimitive } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'

/**
 * Re-exporta o primitivo de Skeleton para uso fora da pasta ui/.
 * Adiciona variantes estruturais prontas para os padrões mais comuns do app.
 */
export { SkeletonPrimitive as Skeleton }

// ─── Variantes de texto ───────────────────────────────────────────────────────

interface SkeletonTextProps {
  /** Largura como classe Tailwind (ex: 'w-24') ou inline style. Padrão: 'w-full' */
  width?: string
  /** Altura como classe Tailwind (ex: 'h-4'). Padrão: 'h-4' */
  height?: string
  className?: string
}

export function SkeletonText({ width = 'w-full', height = 'h-4', className }: SkeletonTextProps) {
  return (
    <SkeletonPrimitive
      className={cn('rounded-md', width, height, className)}
    />
  )
}

// ─── Card genérico ────────────────────────────────────────────────────────────

interface SkeletonCardProps {
  className?: string
  /** Número de linhas de texto a renderizar dentro do card */
  lines?: number
}

export function SkeletonCard({ className, lines = 2 }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-xl border border-glass p-4 space-y-3', className)}>
      <SkeletonText height="h-4" width="w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonText key={i} height="h-3" width={i === lines - 1 ? 'w-3/4' : 'w-full'} />
      ))}
    </div>
  )
}

// ─── KPI Card (espelha a estrutura de DashboardKpis) ─────────────────────────

interface SkeletonKpiProps {
  /** Cor da borda esquerda (valor CSS). Padrão: var(--glass-border) */
  accentColor?: string
}

export function SkeletonKpi({ accentColor }: SkeletonKpiProps) {
  return (
    <div
      className="flex h-full flex-col justify-between border-l-4 p-3 sm:p-5 rounded-xl border border-glass"
      style={{ borderLeftColor: accentColor ?? 'var(--glass-border)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <SkeletonPrimitive className="h-3 w-20 rounded" />
          <SkeletonPrimitive className="h-6 w-32 rounded" />
        </div>
        <SkeletonPrimitive className="h-5 w-5 rounded-full flex-shrink-0 opacity-40" />
      </div>
    </div>
  )
}

// ─── Grade de 4 KPIs (substituto do DashboardKpis durante loading) ────────────

export function SkeletonDashboardKpis() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch xl:grid-cols-4">
      <Card className="p-0 overflow-hidden">
        <SkeletonKpi accentColor="var(--color-income)" />
      </Card>
      <Card className="p-0 overflow-hidden">
        <SkeletonKpi accentColor="var(--color-expense)" />
      </Card>
      <Card className="p-0 overflow-hidden">
        <SkeletonKpi accentColor="var(--color-balance)" />
      </Card>
      <Card className="p-0 overflow-hidden">
        <SkeletonKpi />
      </Card>
    </div>
  )
}
