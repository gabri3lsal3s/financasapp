import GlassChoiceCard, { type GlassChoiceIntent } from '@/components/GlassChoiceCard'

interface QuickLaunchOptionProps {
  label: string
  icon: React.ReactNode
  borderHoverClass?: string
  iconWrapClass?: string
  onClick: () => void
}

const HOVER_TO_INTENT: Record<string, GlassChoiceIntent> = {
  'hover:border-income': 'income',
  'hover:border-expense': 'expense',
  'hover:border-balance': 'balance',
}

function resolveIntent(borderHoverClass: string): GlassChoiceIntent {
  return HOVER_TO_INTENT[borderHoverClass] ?? 'neutral'
}

/** Wrapper fino sobre GlassChoiceCard — compatível com props legadas do Dashboard. */
export default function QuickLaunchOption({
  label,
  icon,
  borderHoverClass = '',
  onClick,
}: QuickLaunchOptionProps) {
  return (
    <GlassChoiceCard
      label={label}
      icon={icon}
      intent={resolveIntent(borderHoverClass)}
      onClick={onClick}
    />
  )
}
