import { useState, useEffect, useCallback, useMemo } from 'react'
import { Wallet, Sparkles, RefreshCw, PieChart, Target, BarChart3, type LucideIcon } from 'lucide-react'
import {
  loadUserPreferences,
  saveDashboardLayout,
  type DashboardLayoutPref,
} from '@/services/userPreferencesService'

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export type WidgetId = 'health' | 'actions' | 'subscriptions' | 'categories' | 'limits' | 'flow'

export interface DashboardWidgetMeta {
  id: WidgetId
  title: string
  subtitle: string
  icon: LucideIcon
  defaultVisible: boolean
  defaultPosition: number
}

export interface DashboardLayoutState {
  order: WidgetId[]
  visibility: Record<WidgetId, boolean>
}

/* ------------------------------------------------------------------ */
/*  Definição dos 6 widgets                                            */
/* ------------------------------------------------------------------ */

const ALL_WIDGETS: DashboardWidgetMeta[] = [
  {
    id: 'health',
    title: 'Situação Financeira',
    subtitle: 'Saldo, orçamento e projeção',
    icon: Wallet,
    defaultVisible: true,
    defaultPosition: 0,
  },
  {
    id: 'actions',
    title: 'Insights Financeiros',
    subtitle: 'Análise inteligente do período',
    icon: Sparkles,
    defaultVisible: true,
    defaultPosition: 1,
  },
  {
    id: 'subscriptions',
    title: 'Gastos Recorrentes',
    subtitle: 'Assinaturas e despesas fixas',
    icon: RefreshCw,
    defaultVisible: true,
    defaultPosition: 2,
  },
  {
    id: 'flow',
    title: 'Fluxo Diário',
    subtitle: 'Entradas e saídas por dia',
    icon: BarChart3,
    defaultVisible: true,
    defaultPosition: 3,
  },
  {
    id: 'categories',
    title: 'Gastos por Categoria',
    subtitle: 'Distribuição dos gastos',
    icon: PieChart,
    defaultVisible: false,
    defaultPosition: 4,
  },
  {
    id: 'limits',
    title: 'Limites de Orçamento',
    subtitle: 'Metas e alertas',
    icon: Target,
    defaultVisible: false,
    defaultPosition: 5,
  },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildDefaultLayout(): DashboardLayoutState {
  const order: WidgetId[] = [...ALL_WIDGETS]
    .sort((a, b) => a.defaultPosition - b.defaultPosition)
    .map((w) => w.id)

  const visibility = Object.fromEntries(
    ALL_WIDGETS.map((w) => [w.id, w.defaultVisible]),
  ) as Record<WidgetId, boolean>

  return { order, visibility }
}

function mergeWithDefaults(stored: DashboardLayoutPref): DashboardLayoutState {
  const defaults = buildDefaultLayout()

  // Filtra apenas IDs válidos e remove duplicatas
  const validIds = stored.order.filter((id): id is WidgetId =>
    ALL_WIDGETS.some((w) => w.id === id),
  )

  // Adiciona widgets que estão faltando no fim
  const existingIds = new Set(validIds)
  for (const w of ALL_WIDGETS) {
    if (!existingIds.has(w.id)) {
      validIds.push(w.id)
    }
  }

  // Merge visibility: stored vence, default é fallback
  const visibility: Record<WidgetId, boolean> = { ...defaults.visibility }
  for (const [id, visible] of Object.entries(stored.visibility)) {
    if (ALL_WIDGETS.some((w) => w.id === id)) {
      visibility[id as WidgetId] = visible as boolean
    }
  }

  return { order: validIds, visibility }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayoutState>(buildDefaultLayout)
  const [loaded, setLoaded] = useState(false)

  // Carrega preferências do usuário ao montar
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const prefs = await loadUserPreferences()
        if (cancelled) return

        if (prefs.dashboardLayout) {
          setLayout(mergeWithDefaults(prefs.dashboardLayout))
        }
      } catch {
        // Fallback para layout padrão já está no state inicial
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  // Persiste toda vez que o layout muda (após carregamento inicial)
  useEffect(() => {
    if (!loaded) return
    const pref: DashboardLayoutPref = {
      order: layout.order,
      visibility: layout.visibility,
    }
    saveDashboardLayout(pref).catch(() => {
      // Falha silenciosa — localStorage já foi atualizado
    })
  }, [layout, loaded])

  // ── Ações ──

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    setLayout((prev) => {
      const order = [...prev.order]
      const [moved] = order.splice(fromIndex, 1)
      order.splice(toIndex, 0, moved)
      return { ...prev, order }
    })
  }, [])

  const MIN_VISIBLE_WIDGETS = 2

  const toggleVisibility = useCallback((widgetId: WidgetId) => {
    setLayout((prev) => {
      // Não permite ocultar se restariam menos de MIN_VISIBLE_WIDGETS visíveis
      const isCurrentlyVisible = prev.visibility[widgetId]
      if (isCurrentlyVisible) {
        const visibleCount = Object.values(prev.visibility).filter(Boolean).length
        if (visibleCount <= MIN_VISIBLE_WIDGETS) {
          return prev // não altera — mantém o mínimo de visíveis
        }
      }

      return {
        ...prev,
        visibility: {
          ...prev.visibility,
          [widgetId]: !isCurrentlyVisible,
        },
      }
    })
  }, [])

  const resetLayout = useCallback(() => {
    setLayout(buildDefaultLayout())
  }, [])

  // ── Dados derivados ──

  const allWidgets = useMemo(() => ALL_WIDGETS, [])

  const visibleWidgets = useMemo(() => {
    return layout.order
      .filter((id) => layout.visibility[id])
      .map((id) => ALL_WIDGETS.find((w) => w.id === id)!)
      .filter(Boolean)
  }, [layout.order, layout.visibility])

  return {
    allWidgets,
    visibleWidgets,
    order: layout.order,
    visibility: layout.visibility,
    loaded,
    moveWidget,
    toggleVisibility,
    resetLayout,
  }
}
