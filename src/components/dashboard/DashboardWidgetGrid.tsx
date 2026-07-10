import { lazy, Component, useState, createContext, useContext, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SECTION_GAP, CONTENT_MAX_WIDTH } from '@/constants/layout'
import type { WidgetId, DashboardWidgetMeta } from '@/hooks/useDashboardLayout'
import WidgetCard from '@/components/dashboard/WidgetCard'
import DashboardCategoryDetailModal from '@/components/dashboard/DashboardCategoryDetailModal'

/* ── Lazy imports dos details ── */
const FinancialHealthDetail = lazy(() => import('@/components/dashboard/details/FinancialHealthDetail'))
const InsightsDetail         = lazy(() => import('@/components/dashboard/details/InsightsDetail'))
const SubscriptionsDetail    = lazy(() => import('@/components/dashboard/details/SubscriptionsDetail'))
const CategoryBreakdownDetail = lazy(() => import('@/components/dashboard/details/CategoryBreakdownDetail'))
const LimitsOverviewDetail    = lazy(() => import('@/components/dashboard/details/LimitsOverviewDetail'))
const DailyFlowDetail         = lazy(() => import('@/components/dashboard/details/DailyFlowDetail'))

/* ── Summaries (sempre visíveis) ── */
import HealthSummary from '@/components/dashboard/summaries/HealthSummary'
import ActionsSummary from '@/components/dashboard/summaries/ActionsSummary'
import SubscriptionsSummary from '@/components/dashboard/summaries/SubscriptionsSummary'
import CategoryBreakdownSummary from '@/components/dashboard/summaries/CategoryBreakdownSummary'
import LimitsOverviewSummary from '@/components/dashboard/summaries/LimitsOverviewSummary'
import DailyFlowSummary from '@/components/dashboard/summaries/DailyFlowSummary'

/* ------------------------------------------------------------------ */
/*  Error Fallback (não quebra o grid todo)                           */
/* ------------------------------------------------------------------ */

interface ErrorFallbackProps { children: ReactNode }
interface ErrorFallbackState { hasError: boolean }

class ErrorFallback extends Component<ErrorFallbackProps, ErrorFallbackState> {
  constructor(props: ErrorFallbackProps) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): ErrorFallbackState { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 py-3 text-secondary/60">
          <AlertTriangle size={14} />
          <span className="text-[10px]">Não foi possível carregar este widget.</span>
        </div>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CategoryDetailTarget {
  categoryId: string
  categoryName: string
  color: string
  type: 'expense' | 'income'
}

/* Contexto para compartilhar o callback de abertura do modal */
const CategoryDetailContext = createContext<((target: CategoryDetailTarget) => void) | null>(null)

export function useOpenCategoryDetail() {
  return useContext(CategoryDetailContext)
}

interface DashboardWidgetGridProps {
  layout: {
    visibleWidgets: DashboardWidgetMeta[]
    loaded: boolean
  }
}

/* ------------------------------------------------------------------ */
/*  Mapa widget → componentes                                         */
/* ------------------------------------------------------------------ */

interface WidgetComponents {
  Summary: React.ComponentType
  Detail: React.ComponentType
}

const WIDGET_MAP: Record<WidgetId, WidgetComponents> = {
  health:        { Summary: HealthSummary,        Detail: FinancialHealthDetail },
  actions:       { Summary: ActionsSummary,       Detail: InsightsDetail },
  subscriptions: { Summary: SubscriptionsSummary, Detail: SubscriptionsDetail },
  categories:    { Summary: CategoryBreakdownSummary, Detail: CategoryBreakdownDetail },
  limits:        { Summary: LimitsOverviewSummary, Detail: LimitsOverviewDetail },
  flow:          { Summary: DailyFlowSummary,     Detail: DailyFlowDetail },
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function DashboardWidgetGrid({ layout }: DashboardWidgetGridProps) {
  const { visibleWidgets, loaded } = layout
  const [detailTarget, setDetailTarget] = useState<CategoryDetailTarget | null>(null)

  if (!loaded) return null

  return (
    <CategoryDetailContext.Provider value={setDetailTarget}>
      <div className={cn(CONTENT_MAX_WIDTH)}>
        <div className={cn(SECTION_GAP)}>
          {visibleWidgets.map((widget) => {
            const comps = WIDGET_MAP[widget.id]
            if (!comps) return null

            return (
              <WidgetCard
                key={widget.id}
                widget={widget}
                summary={<comps.Summary />}
                detail={
                  <ErrorFallback>
                    <comps.Detail />
                  </ErrorFallback>
                }
              />
            )
          })}
        </div>
      </div>

      {/* Modal de detalhamento de categoria */}
      <DashboardCategoryDetailModal
        isOpen={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        categoryId={detailTarget?.categoryId ?? ''}
        categoryName={detailTarget?.categoryName ?? ''}
        color={detailTarget?.color ?? '#888'}
        type={detailTarget?.type ?? 'expense'}
      />
    </CategoryDetailContext.Provider>
  )
}
