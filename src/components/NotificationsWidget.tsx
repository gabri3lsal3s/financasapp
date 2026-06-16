import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { useNotifications, type AlertItem } from '@/contexts/NotificationsContext'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import { formatDate, formatCurrency } from '@/utils/format'

interface AlertCardProps {
  alert: AlertItem
  todayStr: string
  snoozeAlert: (id: string) => void
  markAsRead: (id: string) => void
}

function AlertCard({ alert, todayStr, snoozeAlert, markAsRead }: AlertCardProps) {
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

      {/* Balanced 2-column grid for action buttons to eliminate overflow and keep them perfectly centered and aligned */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10">
        {showSnooze ? (
          <>
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
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => markAsRead(alert.id)}
              className="w-full text-[10px] font-bold text-secondary hover:text-primary hover:bg-primary/5 py-1.5 px-0 h-auto rounded-lg transition-all text-center uppercase tracking-normal"
              title="Remove definitivamente o lembrete desta lista"
            >
              Marcar como lida
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => markAsRead(alert.id)}
            className="col-span-2 w-full text-[10px] font-bold text-secondary hover:text-primary hover:bg-primary/5 py-1.5 px-0 h-auto rounded-lg transition-all text-center uppercase tracking-normal"
            title="Remove definitivamente o lembrete desta lista"
          >
            Marcar como lida
          </Button>
        )}
      </div>
    </div>
  )
}

export default function NotificationsWidget() {
  const navigate = useNavigate()
  const {
    combinedAlerts,
    remindersEnabled,
    isMobileAlertsOpen,
    setIsMobileAlertsOpen,
    isDesktopAlertsOpen,
    setIsDesktopAlertsOpen,
    snoozeAlert,
    markAsRead,
    todayStr,
  } = useNotifications()

  if (!remindersEnabled || combinedAlerts.length === 0) {
    return null
  }

  return (
    <>
      {/* Mobile Alerts Detail Sheet/Modal */}
      <Modal
        isOpen={isMobileAlertsOpen}
        onClose={() => setIsMobileAlertsOpen(false)}
        title="Lembretes de Vencimento"
      >
        <div className="modal-body-stack">
          <ModalIntro align="start">
            Acompanhe faturas e cobranças vencidas ou próximas do vencimento:
          </ModalIntro>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {combinedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                todayStr={todayStr}
                snoozeAlert={snoozeAlert}
                markAsRead={markAsRead}
              />
            ))}
          </div>
          <div className="modal-button-footer mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsMobileAlertsOpen(false)
                navigate('/contas')
              }}
              className="w-full text-xs"
            >
              Gerenciar Contas
            </Button>
          </div>
        </div>
      </Modal>

      {/* Desktop Floating Notification Widget */}
      <div className="hidden md:block fixed bottom-6 right-8 z-50">
        <div className="relative">
          {/* FAB Button */}
          <Button
            type="button"
            id="alerts-fab"
            onClick={() => setIsDesktopAlertsOpen(!isDesktopAlertsOpen)}
            variant="outline"
            className="alerts-fab-trigger flex h-10 w-10 min-h-10 items-center justify-center rounded-full border border-glass surface-glass shadow-lg hover:bg-accent/40 active:scale-95 transition-all duration-300 relative p-0"
            title="Lembretes de Vencimento"
          >
            <Bell size={18} className="animate-bell-ring text-primary" />
            <span className="absolute -top-1 -right-1 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-expense text-[8px] font-black text-white border border-secondary shadow-sm">
              {combinedAlerts.length}
            </span>
          </Button>

          {/* Floating Card Content */}
          {isDesktopAlertsOpen && (
            <div className="absolute bottom-16 right-0 w-80 surface-glass-strong border border-glass rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-5 duration-300 z-50 animate-stagger-item">
              <div className="flex items-center justify-between border-b border-primary/10 pb-2 mb-3">
                <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <Bell size={16} className="text-expense shrink-0" />
                  Lembretes de Vencimento
                </h4>
                <Button
                  type="button"
                  onClick={() => setIsDesktopAlertsOpen(false)}
                  variant="ghost"
                  size="xs"
                  className="text-secondary hover:text-primary transition-colors text-xs font-semibold h-auto py-1 px-2"
                >
                  Fechar
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {combinedAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    todayStr={todayStr}
                    snoozeAlert={snoozeAlert}
                    markAsRead={markAsRead}
                  />
                ))}
              </div>
              <div className="mt-4 pt-2 border-t border-primary/10 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDesktopAlertsOpen(false)
                    navigate('/contas')
                  }}
                  className="w-full text-xs gap-1"
                >
                  Gerenciar Contas
                  <ChevronRight size={12} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}


