import { InputHTMLAttributes, useId } from 'react'
import { Checkbox as ShadcnCheckbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export default function Checkbox({
  label,
  description,
  className = '',
  id,
  checked,
  onChange,
  disabled,
}: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'flex items-start gap-3 cursor-pointer group select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
    >
      <ShadcnCheckbox
        id={checkboxId}
        checked={Boolean(checked)}
        onCheckedChange={(value) => {
          onChange?.({
            target: { checked: value === true },
          } as React.ChangeEvent<HTMLInputElement>)
        }}
        disabled={disabled}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-primary leading-tight">{label}</span>
        {description && (
          <span className="text-xs text-secondary mt-0.5 leading-snug">{description}</span>
        )}
      </div>
    </label>
  )
}
