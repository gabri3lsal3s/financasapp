import type { ReactNode } from 'react'
import Button from '@/components/Button'

interface VisualStyleOptionCardProps {
  selected: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  description: string
  iconWrapClassName?: string
}

export default function VisualStyleOptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  iconWrapClassName = 'bg-primary/10 border border-primary/20',
}: VisualStyleOptionCardProps) {
  return (
    <Button
      type="button"
      variant={selected ? 'secondary' : 'outline'}
      onClick={onSelect}
      className={`p-4 h-36 w-full flex flex-col justify-between items-start text-left ${
        selected ? 'border-primary accent-primary' : ''
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconWrapClassName}`}>
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-[14px] text-primary leading-tight">{title}</h4>
        <p className="text-[11px] leading-tight text-secondary mt-1">{description}</p>
      </div>
    </Button>
  )
}
