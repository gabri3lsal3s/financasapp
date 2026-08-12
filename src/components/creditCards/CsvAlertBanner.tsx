import { AlertTriangle, Check, Info, X } from 'lucide-react'

export type CsvAlertMessage = {
  type: 'error' | 'success' | 'warning'
  text: string
}

interface CsvAlertBannerProps {
  message: CsvAlertMessage | null
  onClose: () => void
}

const icons = {
  error: Info,
  warning: AlertTriangle,
  success: Check,
}

export default function CsvAlertBanner({ message, onClose }: CsvAlertBannerProps) {
  if (!message) return null

  const Icon = icons[message.type]

  return (
    <div className={`p-3.5 rounded-xl border flex gap-3 items-start animate-page-enter shadow-sm ${
      message.type === 'error'
        ? 'bg-[color-mix(in_srgb,var(--color-expense)_8%,var(--glass-layer-panel))] border-[color-mix(in_srgb,var(--color-expense)_25%,var(--glass-border))] text-expense'
        : message.type === 'warning'
        ? 'bg-[color-mix(in_srgb,var(--color-warning)_8%,var(--glass-layer-panel))] border-[color-mix(in_srgb,var(--color-warning)_25%,var(--glass-border))] text-warning'
        : 'bg-[color-mix(in_srgb,var(--color-income)_8%,var(--glass-layer-panel))] border-[color-mix(in_srgb,var(--color-income)_25%,var(--glass-border))] text-income'
    }`}>
      <Icon size={16} className="shrink-0 mt-0.5 text-current" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold leading-normal text-primary">{message.text}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-secondary hover:text-primary transition-colors duration-150 shrink-0 p-0.5"
        aria-label="Fechar aviso"
      >
        <X size={14} />
      </button>
    </div>
  )
}
