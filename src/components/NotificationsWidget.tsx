import { type AlertItem } from '@/contexts/NotificationsContext'
import Button from '@/components/Button'
import { formatDate, formatCurrency } from '@/utils/format'

interface AlertCardProps {
  alert: AlertItem
  todayStr: string
  snoozeAlert: (id: string) => void
}

function AlertCard({ alert, todayStr, snoozeAlert }: AlertCardProps) {
  const showSnooze = !alert.isOverdue && alert.dueDate > todayStr

  return (
    <div
      className={`flex flex-col gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
        alert.isOverdue
          ? 'border-expense/20 bg-expense/5 hover:bg-expense/10'
          : 'border-warning/20 bg-warning/5 hover:bg-warning/10'
      }`}
    >
      {/* Top row: Title and value */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-bold text-primary truncate leading-tight">
            {alert.title}
          </span>
          <span className="text-[10px] text-secondary leading-none">
            {alert.isOverdue ? 'Venceu em' : 'Vence em'}{' '}
            <strong className="text-primary font-mono font-bold">{formatDate(alert.dueDate)}</strong>
          </span>
        </div>

        <div className="flex flex-col items-end shrink-0 gap-1">
          <span className={`text-xs font-black font-mono leading-none ${
            alert.debtType === 'receivable' ? 'text-income' : 'text-expense'
          }`}>
            {alert.debtType === 'receivable' ? '+' : ''}{formatCurrency(alert.amount)}
          </span>
          {alert.isOverdue && (
            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-expense/15 text-expense border border-expense/20">
              Vencida
            </span>
          )}
        </div>
      </div>

      {/* Action buttons footer */}
      {showSnooze && (
        <div className="pt-2 border-t border-primary/10">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => snoozeAlert(alert.id)}
            className="w-full text-[10px] font-bold text-secondary hover:text-primary hover:bg-primary/5 py-1.5 px-0 h-auto rounded-lg transition-all text-center uppercase tracking-normal"
            title="Adia o lembrete para reaparecer no dia do vencimento"
          >
            Lembrar mais tarde
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * This component previously rendered both a mobile Modal and a desktop
 * notification dropdown. As of the unified overlay refactor, the
 * notifications UI is rendered directly in AppTopBar's NotificationsOverlay.
 *
 * AlertCard is kept here for reuse and exported for use by the overlay.
 */
export { AlertCard }
export type { AlertCardProps }

export default function NotificationsWidget() {
  // Notifications UI moved to AppTopBar's unified NotificationsOverlay
  return null
}
