import type { ReactNode } from 'react'
import Button from '@/components/Button'

interface QuickLaunchOptionProps {
  label: string
  icon: ReactNode
  borderHoverClass: string
  iconWrapClass: string
  onClick: () => void
}

export default function QuickLaunchOption({
  label,
  icon,
  borderHoverClass,
  iconWrapClass,
  onClick,
}: QuickLaunchOptionProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-6 h-auto rounded-2xl hover:shadow-lg group ${borderHoverClass}`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${iconWrapClass}`}>
        {icon}
      </div>
      <span className="font-semibold text-primary">{label}</span>
    </Button>
  )
}
