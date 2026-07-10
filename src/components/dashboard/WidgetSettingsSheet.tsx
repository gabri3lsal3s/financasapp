import { useCallback, useMemo } from 'react'
import { GripVertical, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DashboardWidgetMeta, WidgetId } from '@/hooks/useDashboardLayout'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface WidgetSettingsSheetProps {
  layout: {
    allWidgets: DashboardWidgetMeta[]
    order: WidgetId[]
    visibility: Record<WidgetId, boolean>
    toggleVisibility: (widgetId: WidgetId) => void
    moveWidget: (fromIndex: number, toIndex: number) => void
    resetLayout: () => void
  }
  isOpen: boolean
  onClose: () => void
}

/* ------------------------------------------------------------------ */
/*  Sortable Row                                                       */
/* ------------------------------------------------------------------ */

function SortableRow({
  widget,
  isVisible,
  onToggle,
}: {
  widget: DashboardWidgetMeta
  isVisible: boolean
  onToggle: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id })

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  }), [transform, transition, isDragging])

  const Icon = widget.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
        isVisible
          ? 'border-glass/50 hover:border-glass'
          : 'border-glass/20 opacity-40',
        isDragging && 'ring-2 ring-primary/20 shadow-sm',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="text-secondary/40 cursor-grab active:cursor-grabbing p-0.5 hover:text-secondary transition-colors touch-none"
        title="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      {/* Ícone (sem fundo, apenas cor do texto) */}
      <span className={cn(
        'flex items-center justify-center shrink-0 w-5',
        isVisible ? 'text-primary' : 'text-secondary/40',
      )}>
        <Icon size={16} />
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">          <p className={cn(
            'text-xs font-bold truncate',
            isVisible ? 'text-primary' : 'text-secondary/50',
          )}>
            {widget.title}
          </p>
          <p className="text-[9px] text-secondary/50 truncate">{widget.subtitle}</p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center text-secondary/40 hover:text-secondary transition-colors"
          title={isVisible ? 'Ocultar' : 'Mostrar'}
        >
          {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function WidgetSettingsSheet({ layout, isOpen, onClose }: WidgetSettingsSheetProps) {
  const {
    allWidgets,
    order,
    visibility,
    toggleVisibility,
    moveWidget,
    resetLayout,
  } = layout

  // Widgets ordenados conforme layout atual
  const sortedWidgets = useMemo(
    () => order
      .map((id) => allWidgets.find((w) => w.id === id))
      .filter((w): w is DashboardWidgetMeta => w !== undefined),
    [order, allWidgets],
  )

  const widgetIds = useMemo(() => sortedWidgets.map((w) => w.id), [sortedWidgets])

  // ── Sensores ──
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // só ativa drag após mover 8px
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // ── Handlers ──
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = widgetIds.indexOf(active.id as WidgetId)
    const newIndex = widgetIds.indexOf(over.id as WidgetId)
    if (oldIndex !== -1 && newIndex !== -1) {
      moveWidget(oldIndex, newIndex)
    }
  }, [widgetIds, moveWidget])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Personalizar Dashboard">
      <div className="modal-body-stack">
        <p className="text-[10px] text-secondary mb-2">
          Arraste os cartões para reordenar. Toque no olho para mostrar/ocultar.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={widgetIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {sortedWidgets.map((widget) => (
                <SortableRow
                  key={widget.id}
                  widget={widget}
                  isVisible={visibility[widget.id]}
                  onToggle={() => toggleVisibility(widget.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Botão restaurar padrão */}
        <div className="pt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetLayout}
            className="flex items-center gap-1.5 text-[10px]"
          >
            <RotateCcw size={13} />
            Restaurar Padrão
          </Button>
        </div>
      </div>
    </Modal>
  )
}
