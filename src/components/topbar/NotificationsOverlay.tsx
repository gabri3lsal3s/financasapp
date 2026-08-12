import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNotifications } from '@/contexts/NotificationsContext'
import { AlertCard } from '@/components/NotificationsWidget'
import { createPortal } from 'react-dom'

interface NotificationsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

/** Overlay unificado de notificações (portal para document.body). */
export default function NotificationsOverlay({
  isOpen,
  onClose,
}: NotificationsOverlayProps) {
  const {
    combinedAlerts,
    snoozeAlert,
    todayStr,
  } = useNotifications()
  const navigate = useNavigate()

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-center p-3 sm:p-6 md:p-10 pointer-events-none animate-fade-in">
      {/* Backdrop com blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      {/* Container — animado do topo, centralizado, max-w-xl */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.96 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 28,
        }}
        className="relative w-full max-w-xl pointer-events-auto z-10"
      >
        <div className="p-3">
          {/* Header */}
          <div className="relative flex items-center gap-2 mb-3">
            <button
              onClick={onClose}
              className="p-2 -ml-1 text-secondary hover:text-primary transition-colors cursor-pointer"
              aria-label="Fechar notificações"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex-1 flex items-center gap-2 rounded-2xl border surface-glass-strong h-[52px] px-3.5">
              <Bell size={15} className="text-expense shrink-0" />
              <span className="text-xs sm:text-[13px] font-bold text-primary">
                Lembretes de Vencimento
              </span>
            </div>
          </div>

          {/* Lista de alertas */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {combinedAlerts.length === 0 ? (
              <p className="text-secondary text-xs text-center py-8">
                Nenhum lembrete pendente.
              </p>
            ) : (
              combinedAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  todayStr={todayStr}
                  snoozeAlert={snoozeAlert}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-primary/10">
            <button
              onClick={() => {
                onClose()
                navigate('/contas')
              }}
              className="w-full text-xs font-bold text-center py-2 rounded-xl border border-glass hover:bg-secondary/10 transition-colors cursor-pointer"
            >
              Gerenciar Contas
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
