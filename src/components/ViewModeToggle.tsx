import { cn } from '@/lib/utils'

export type ViewModeOption = {
  value: string
  label: string
}

interface ViewModeToggleProps {
  options: [ViewModeOption, ...ViewModeOption[]]
  value: string
  onChange: (value: string) => void
  className?: string
  size?: 'sm' | 'md'
}

export default function ViewModeToggle({
  options,
  value,
  onChange,
  className,
  size = 'sm',
}: ViewModeToggleProps) {
  const sizeClasses = size === 'sm'
    ? 'text-[9px] px-3 py-1 rounded-md'
    : 'text-xs px-4 py-1.5 rounded-lg'

  return (
    <div className={cn('flex gap-1 bg-glass/10 p-0.5 rounded-lg self-start', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'font-black uppercase tracking-wider transition-all whitespace-nowrap',
            sizeClasses,
            value === opt.value
              ? 'bg-glass/20 text-primary shadow-sm'
              : 'text-secondary hover:text-primary'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
