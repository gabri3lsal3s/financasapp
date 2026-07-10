import { Suspense, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardWidgetMeta } from '@/hooks/useDashboardLayout'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface WidgetCardProps {
  widget: DashboardWidgetMeta
  /** Badge/stat mostrado no canto direito do header */
  summary: ReactNode
  /** Conteúdo principal do card (renderizado com Suspense) */
  detail: ReactNode
}

/* ------------------------------------------------------------------ */
/*  Skeleton padrão                                                    */
/* ------------------------------------------------------------------ */

function DefaultSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-full rounded-lg" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function WidgetCard({ widget, summary, detail }: WidgetCardProps) {
  const Icon = widget.icon

  return (
    <Card
      className={cn(
        '!p-0 rounded-2xl border border-glass surface-glass shadow-sm transition-all duration-300',
        'hover:border-glass-strong hover:shadow-md',
      )}
    >
      {/* ── Header (sempre visível) ── */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 border-b border-glass/40 px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon size={16} className="shrink-0 text-primary/60 sm:text-primary/70" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate">
              {widget.title}
            </h3>
            <p className="text-[10px] sm:text-xs text-secondary mt-0.5 truncate">{widget.subtitle}</p>
          </div>
        </div>
        <div className="shrink-0 max-w-[45%] sm:max-w-none">{summary}</div>
      </div>

      {/* ── Conteúdo (Suspense para lazy loading) ── */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3">
        <Suspense fallback={<DefaultSkeleton />}>
          {detail}
        </Suspense>
      </div>
    </Card>
  )
}
