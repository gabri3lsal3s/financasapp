import { Skeleton as SkeletonPrimitive } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'

/**
 * Re-exporta o primitivo de Skeleton para uso fora da pasta ui/.
 * Adiciona variantes estruturais prontas para os padrões mais comuns do app.
 *
 * Todas as variantes usam tons neutros/glass — sem barras coloridas ou
 * cores temáticas, para um visual padronizado durante o carregamento.
 */
export { SkeletonPrimitive as Skeleton }

// ─── Variantes de texto ───────────────────────────────────────────────────────

interface SkeletonTextProps {
  width?: string
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

// ─── Accordion Card (para listas expansíveis) ────────────────────────────────

export function SkeletonAccordionCard() {
  return (
    <div className="rounded-xl border border-glass overflow-hidden">
      <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <SkeletonPrimitive className="w-3 h-3 rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonPrimitive className="h-3.5 w-28 rounded" />
            <SkeletonPrimitive className="h-2.5 w-40 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right space-y-1">
            <SkeletonPrimitive className="h-2.5 w-16 rounded ml-auto" />
            <SkeletonPrimitive className="h-3.5 w-20 rounded ml-auto" />
          </div>
          <SkeletonPrimitive className="h-3.5 w-3.5 rounded shrink-0" />
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card (neutro, sem borda colorida) ───────────────────────────────────

export function SkeletonKpi() {
  return (
    <div className="flex h-full flex-col justify-between p-3 sm:p-5 rounded-xl border border-glass">
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

// ─── Grid de 4 KPIs (todos neutros) ──────────────────────────────────────────

export function SkeletonKpiGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch lg:grid-cols-4">
      <Card className="p-0 overflow-hidden"><SkeletonKpi /></Card>
      <Card className="p-0 overflow-hidden"><SkeletonKpi /></Card>
      <Card className="p-0 overflow-hidden"><SkeletonKpi /></Card>
      <Card className="p-0 overflow-hidden"><SkeletonKpi /></Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETONS ESPECÍFICOS POR PÁGINA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// Layout: KPIs (linha), DailyFlowChart (card grande), Insights (card lateral)

export function SkeletonDashboard() {
  return (
    <div className="space-y-5 animate-fade-in">
      <SkeletonKpiGrid />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Daily Flow Chart */}
          <Card className="border border-glass p-4 sm:p-5">
            <div className="mb-4 border-b border-glass/40 pb-3 space-y-1.5">
              <SkeletonPrimitive className="h-4 w-28 rounded" />
              <SkeletonPrimitive className="h-2.5 w-44 rounded" />
            </div>
            <div className="space-y-2">
              <SkeletonPrimitive className="h-32 w-full rounded-lg" />
            </div>
          </Card>
          {/* Limits Control */}
          <Card className="border border-glass p-4 sm:p-5">
            <div className="space-y-2">
              <SkeletonPrimitive className="h-3.5 w-24 rounded" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SkeletonPrimitive className="h-12 rounded-lg" />
                <SkeletonPrimitive className="h-12 rounded-lg" />
              </div>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-5 lg:col-span-1">
          {/* Daily Budget Advisor */}
          <Card className="border border-glass p-4 sm:p-5 space-y-3">
            {[1, 2, 3].map(i => (
              <SkeletonPrimitive key={i} className={`h-3 w-${i === 1 ? 'full' : i === 2 ? '3/4' : '1/2'} rounded`} />
            ))}
          </Card>
          {/* Financial Insights */}
          <Card className="border border-glass p-4 sm:p-5 space-y-3">
            <SkeletonPrimitive className="h-4 w-20 rounded" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <SkeletonPrimitive className="h-3 w-24 rounded" />
                <SkeletonPrimitive className="h-3 w-16 rounded" />
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── EXPENSES / INCOMES (lista de transações) ────────────────────────────────

export function SkeletonTransactionList() {
  return (
    <div className="space-y-3 py-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-glass p-3 sm:p-4 flex items-center gap-3">
          <SkeletonPrimitive className="w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <SkeletonPrimitive className="h-3.5 w-32 rounded" />
            <SkeletonPrimitive className="h-2.5 w-20 rounded" />
          </div>
          <div className="text-right space-y-1">
            <SkeletonPrimitive className="h-3.5 w-16 rounded ml-auto" />
            <SkeletonPrimitive className="h-2.5 w-12 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── INVESTMENTS ──────────────────────────────────────────────────────────────
// Layout: PortfolioKpiBar, tabs, EvolutionChart, HoldingsTable, PieCharts

export function SkeletonInvestments() {
  return (
    <div className="space-y-4 py-4 animate-fade-in">
      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-0 overflow-hidden"><SkeletonKpi /></Card>
        ))}
      </div>
      {/* Tab bar */}
      <div className="flex justify-center">
        <div className="flex gap-1 bg-glass/10 p-0.5 rounded-xl border border-glass h-9">
          {[1, 2, 3].map(i => (
            <SkeletonPrimitive key={i} className="h-7 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Cash balance card */}
      <Card className="border border-glass p-5 space-y-2">
        <SkeletonPrimitive className="h-2.5 w-20 rounded" />
        <SkeletonPrimitive className="h-8 w-40 rounded" />
        <SkeletonPrimitive className="h-2.5 w-56 rounded" />
      </Card>
      {/* Evolution chart */}
      <Card className="border border-glass p-5 space-y-3">
        <SkeletonPrimitive className="h-3.5 w-28 rounded" />
        <SkeletonPrimitive className="h-48 w-full rounded-lg" />
      </Card>
      {/* Pie charts section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border border-glass p-4 space-y-3">
            <SkeletonPrimitive className="h-3 w-20 rounded mx-auto" />
            <SkeletonPrimitive className="h-28 w-28 rounded-full mx-auto" />
            <div className="space-y-1.5">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-2">
                  <SkeletonPrimitive className="h-2 w-2 rounded-full shrink-0" />
                  <SkeletonPrimitive className="h-2.5 flex-1 rounded" />
                  <SkeletonPrimitive className="h-2.5 w-14 rounded" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── CATEGORIES (com grid de cards e KPIs) ───────────────────────────────────

export function SkeletonCategories() {
  return (
    <div className="space-y-4 py-4 animate-fade-in">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4 border border-glass space-y-2">
            <SkeletonPrimitive className="h-2.5 w-20 rounded" />
            <SkeletonPrimitive className="h-5 w-24 rounded" />
          </Card>
        ))}
      </div>
      {/* Category cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="rounded-xl border border-glass p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <SkeletonPrimitive className="h-4 w-4 rounded shrink-0" />
                <SkeletonPrimitive className="h-3.5 w-24 rounded" />
              </div>
              <SkeletonPrimitive className="h-3.5 w-16 rounded-full shrink-0" />
            </div>
            <div className="space-y-1.5">
              <SkeletonPrimitive className="h-2.5 w-full rounded" />
              <SkeletonPrimitive className="h-2 w-3/4 rounded" />
            </div>
            <div className="pt-3 border-t border-glass/30 flex items-center justify-between">
              <SkeletonPrimitive className="h-3 w-20 rounded" />
              <SkeletonPrimitive className="h-6 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CONTAS (Cartões e Pendências) ───────────────────────────────────────────
// Layout: KPIs, tabs (Cartões/Pendências), accordion cards

export function SkeletonContas() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI grid */}
      <SkeletonKpiGrid />

      {/* Tab bar */}
      <div className="flex justify-center">
        <div className="grid grid-cols-2 w-full max-w-md mx-auto bg-glass/10 p-0.5 rounded-xl border border-glass h-9">
          <SkeletonPrimitive className="h-7 rounded-lg mx-0.5" />
          <SkeletonPrimitive className="h-7 rounded-lg mx-0.5" />
        </div>
      </div>

      {/* Cards section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-glass pb-2">
          <SkeletonPrimitive className="h-4 w-32 rounded" />
          <SkeletonPrimitive className="h-4 w-8 rounded-full" />
        </div>
        {[1, 2].map(i => <SkeletonAccordionCard key={i} />)}
      </div>

      {/* Pending debts section */}
      <div className="space-y-3 pt-4 border-t border-glass">
        <SkeletonPrimitive className="h-3.5 w-36 rounded" />
        <div className="flex flex-wrap gap-2">
          {[1, 2].map(i => (
            <SkeletonPrimitive key={i} className="h-8 w-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
// Layout: period selector, KPIs, charts, composition cards

export function SkeletonReports() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Period tabs */}
      <div className="flex justify-center">
        <div className="grid grid-cols-3 w-full max-w-md mx-auto bg-glass/10 p-0.5 rounded-xl border border-glass h-9">
          <SkeletonPrimitive className="h-7 rounded-lg mx-0.5" />
          <SkeletonPrimitive className="h-7 rounded-lg mx-0.5" />
          <SkeletonPrimitive className="h-7 rounded-lg mx-0.5" />
        </div>
      </div>

      {/* KPI grid */}
      <SkeletonKpiGrid />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border border-glass p-4 sm:p-5 space-y-3">
          <SkeletonPrimitive className="h-3.5 w-28 rounded" />
          <SkeletonPrimitive className="h-40 w-full rounded-lg" />
        </Card>
        <Card className="border border-glass p-4 sm:p-5 space-y-3">
          <SkeletonPrimitive className="h-3.5 w-28 rounded" />
          <div className="flex items-center justify-center gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <SkeletonPrimitive key={i} className="h-32 w-8 rounded-lg" />
            ))}
          </div>
        </Card>
      </div>

      {/* Composition card */}
      <Card className="border border-glass p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-glass/40 pb-4">
          <div className="space-y-1">
            <SkeletonPrimitive className="h-3.5 w-28 rounded" />
            <SkeletonPrimitive className="h-2.5 w-36 rounded" />
          </div>
          <div className="flex gap-1 bg-glass/10 p-0.5 rounded-lg border border-glass">
            <SkeletonPrimitive className="h-7 w-20 rounded" />
            <SkeletonPrimitive className="h-7 w-16 rounded" />
            <SkeletonPrimitive className="h-7 w-16 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonPrimitive className="h-52 rounded-lg lg:col-span-1" />
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <SkeletonPrimitive key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      </Card>

      {/* Insights card */}
      <Card className="border border-glass p-4 sm:p-5">
        <div className="space-y-3">
          <SkeletonPrimitive className="h-3.5 w-24 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SkeletonPrimitive className="h-16 rounded-xl" />
            <SkeletonPrimitive className="h-16 rounded-xl" />
            <SkeletonPrimitive className="h-16 rounded-xl" />
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── CATEGORY GRID (ExpenseCategories / IncomeCategories) ────────────────────

export function SkeletonCategoryGrid() {
  return (
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 py-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-xl border border-glass p-3 sm:p-4 flex items-center gap-3">
          <SkeletonPrimitive className="w-8 h-8 rounded-lg shrink-0" />
          <SkeletonPrimitive className="h-4 flex-1 rounded" />
        </div>
      ))}
    </div>
  )
}
