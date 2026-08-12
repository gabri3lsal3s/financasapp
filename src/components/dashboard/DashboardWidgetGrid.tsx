import { lazy, Component, useState, type ReactNode } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SECTION_GAP, CONTENT_MAX_WIDTH, KPI_GRID, CARD_BASE_FLAT } from '@/constants/layout'
import type { WidgetId, DashboardWidgetMeta } from '@/hooks/useDashboardLayout'
import { useDashboardFinances } from '@/contexts/dashboardDataContext'
import AmountText, { type AmountTone } from '@/components/ui/amount-text'
import WidgetCard from '@/components/dashboard/WidgetCard'
import DashboardHero from '@/components/dashboard/DashboardHero'
import {
  CategoryDetailContext,
  type CategoryDetailTarget,
} from '@/components/dashboard/categoryDetailContext'
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
  const {
    totalIncomes,
    totalExpenses,
    totalInvestments,
    balance,
  } = useDashboardFinances()

  if (!loaded) return null

  const hasAnyData = totalIncomes > 0 || totalExpenses > 0 || totalInvestments > 0 || balance !== 0

  // Separa o widget de fluxo para renderização fixa/expandida
  const flowWidget = visibleWidgets.find((w) => w.id === 'flow')
  const otherWidgets = visibleWidgets.filter((w) => w.id !== 'flow')

  return (
    <CategoryDetailContext.Provider value={setDetailTarget}>
      <div className={cn(CONTENT_MAX_WIDTH)}>
        <div className={cn(SECTION_GAP)}>
          {/* ── Hero: Saldo consolidado + sparkline comparativo ── */}
          <DashboardHero />

          {/* ── KPI Bar (mobile: 2×2, desktop: 4 colunas) ── */}
          {hasAnyData && (
            <div className={cn(KPI_GRID)}>
              <KpiCard
                icon={<TrendingUp size={15} />}
                label="Rendas"
                value={totalIncomes}
                tone="income"
              />
              <KpiCard
                icon={<TrendingDown size={15} />}
                label="Despesas"
                value={totalExpenses}
                tone="expense"
              />
              <KpiCard
                icon={<PiggyBank size={15} />}
                label="Investimentos"
                value={totalInvestments}
                tone="balance"
              />
              <KpiCard
                icon={<Wallet size={15} />}
                label="Saldo"
                value={balance}
                tone={balance >= 0 ? 'income' : 'expense'}
              />
            </div>
          )}

          {/* ── Fluxo Diário: sempre fixo após os KPIs e expandido ── */}
          {flowWidget && (
            <WidgetCard
              key="flow-fixed"
              widget={flowWidget}
              disableCollapse
              summary={<DailyFlowSummary />}
              detail={
                <ErrorFallback>
                  <DailyFlowDetail />
                </ErrorFallback>
              }
            />
          )}

          {/* ── Demais widgets sempre abertos e organizados em grade de 2 colunas no desktop ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {otherWidgets.map((widget) => {
              const comps = WIDGET_MAP[widget.id]
              if (!comps) return null

              return (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  disableCollapse
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
      </div>

      {/* Modal de detalhamento de categoria */}
      <DashboardCategoryDetailModal
        isOpen={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        categoryId={detailTarget?.categoryId ?? ''}
        categoryName={detailTarget?.categoryName ?? ''}
        color={detailTarget?.color ?? 'var(--color-text-secondary)'}
        type={detailTarget?.type ?? 'expense'}
      />
    </CategoryDetailContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/*  KpiCard interno                                                    */
/* ------------------------------------------------------------------ */

function KpiCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: AmountTone }) {
  return (
    <div className={cn(CARD_BASE_FLAT, 'p-3 sm:p-4 flex flex-col justify-between min-h-[72px] sm:min-h-0')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-secondary/70">
          {label}
        </span>
        <span className="shrink-0 opacity-40">{icon}</span>
      </div>
      <AmountText
        value={value}
        size="sm"
        weight="extrabold"
        tone={tone}
        className="mt-1"
      />
    </div>
  )
}
