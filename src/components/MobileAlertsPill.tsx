import { Bell } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationsContext'
import Button from '@/components/Button'

export default function MobileAlertsPill() {
  const { remindersEnabled, combinedAlerts, setIsMobileAlertsOpen } = useNotifications()

  if (!remindersEnabled || combinedAlerts.length === 0) {
    return null
  }

  return (
    <div className="md:hidden flex justify-center mb-3">
      <Button
        type="button"
        onClick={() => setIsMobileAlertsOpen(true)}
        variant="outline"
        size="xs"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-glass surface-glass-strong shadow-sm text-[10px] font-black text-primary hover-lift-subtle press-subtle select-none animate-in fade-in slide-in-from-top-1 duration-300"
      >
        <Bell size={12} className="text-expense animate-bell-ring shrink-0" />
        <span>
          {combinedAlerts.length} {combinedAlerts.length === 1 ? 'lembrete' : 'lembretes'} de vencimento
        </span>
      </Button>
    </div>
  )
}
