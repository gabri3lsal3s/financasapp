import type { ButtonHTMLAttributes } from 'react'
import { Switch as ShadcnSwitch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'role' | 'onChange'> {
  checked: boolean
  label?: string
  onChange?: () => void
  onCheckedChange?: (checked: boolean) => void
}

export default function Switch({
  checked,
  label,
  className = '',
  title,
  onClick,
  onChange,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <ShadcnSwitch
      checked={checked}
      title={title ?? label}
      aria-label={label}
      className={cn(className)}
      onCheckedChange={(value) => {
        onCheckedChange?.(value)
        onChange?.()
      }}
      onClick={onClick}
      {...props}
    />
  )
}
