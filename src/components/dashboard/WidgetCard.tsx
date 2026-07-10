import { Suspense, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaQuery } from '@/hooks/useMediaQuery'
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
  /** Impede o colapso no mobile (sempre expandido) */
  disableCollapse?: boolean
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

export default function WidgetCard({ widget, summary, detail, disableCollapse }: WidgetCardProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const Icon = widget.icon

  // Se disableCollapse, comporta como desktop (sempre expandido, sem chevron)
  const effectiveMobile = isMobile && !disableCollapse

  return (
    <Card
      className={cn(
        '!p-0 rounded-2xl border border-glass surface-glass shadow-sm transition-all duration-300',
        'hover:border-glass-strong hover:shadow-md',
      )}
    >
      {/* ── Header (sempre visível) ── */}
      <div
        className={cn(
          'border-b border-glass/40 px-4 sm:px-5 pt-4 sm:pt-5 pb-3',
          effectiveMobile && 'cursor-pointer select-none active:bg-secondary/10 transition-colors',
        )}
        onClick={() => effectiveMobile && setIsCollapsed((prev) => !prev)}
        role={effectiveMobile ? 'button' : undefined}
        tabIndex={effectiveMobile ? 0 : undefined}
        onKeyDown={effectiveMobile ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsCollapsed((prev) => !prev) } } : undefined}
      >
        {effectiveMobile ? (
          /* ── Mobile colapsável: só título + chevron (sem summary) ── */
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary truncate">
              {widget.title}
            </h3>
            <motion.div
              animate={{ rotate: isCollapsed ? 0 : 180 }}
              transition={{ duration: 0.2 }}
              className="text-secondary/40 shrink-0"
            >
              <ChevronDown size={14} />
            </motion.div>
          </div>
        ) : (
          /* ── Desktop / disableCollapse: layout horizontal clássico com resumo ── */
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icon size={16} className="shrink-0 text-primary/60 sm:text-primary/70" />
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate">
                  {widget.title}
                </h3>
                <p className="text-[10px] sm:text-xs text-secondary mt-0.5 truncate">{widget.subtitle}</p>
              </div>
            </div>
            <div className="shrink-0 sm:max-w-none">
              {summary}
            </div>
          </div>
        )}
      </div>

      {/* ── Conteúdo (colapsável no mobile, sempre visível no desktop / disableCollapse) ── */}
      <AnimatePresence initial={false}>
        {(!effectiveMobile || !isCollapsed) && (
          <motion.div
            key="content"
            initial={effectiveMobile ? { height: 0, opacity: 0 } : undefined}
            animate={effectiveMobile ? { height: 'auto', opacity: 1 } : undefined}
            exit={effectiveMobile ? { height: 0, opacity: 0 } : undefined}
            transition={effectiveMobile ? { duration: 0.22, ease: [0.16, 1, 0.3, 1] } : undefined}
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3">
              <Suspense fallback={<DefaultSkeleton />}>
                {detail}
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
