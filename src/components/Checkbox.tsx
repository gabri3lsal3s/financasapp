import { InputHTMLAttributes, useId } from 'react'
import { Check } from 'lucide-react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

/**
 * Checkbox padronizado do design system.
 * Usa tokens CSS do tema para consistência em todos os temas (light/dark).
 */
export default function Checkbox({
  label,
  description,
  className = '',
  id,
  checked,
  onChange,
  disabled,
  ...props
}: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  return (
    <label
      htmlFor={checkboxId}
      className={`flex items-start gap-3 cursor-pointer group select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {/* Hidden native input for a11y / form semantics */}
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
        {...props}
      />

      {/* Custom checkbox visual */}
      <div
        className={`
          relative flex-shrink-0 mt-0.5
          w-[18px] h-[18px] rounded-md border-2
          flex items-center justify-center
          transition-all duration-150 ease-in-out
          ${checked
            ? 'bg-indigo-500 border-indigo-500 shadow-sm shadow-indigo-500/30'
            : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] group-hover:border-indigo-400 group-hover:shadow-sm'
          }
          ${!disabled && !checked ? 'group-hover:border-indigo-400' : ''}
        `}
        aria-hidden="true"
      >
        <Check
          size={11}
          strokeWidth={3}
          className={`text-white transition-all duration-100 ${
            checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
        />
      </div>

      {/* Label text */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-primary leading-tight">
          {label}
        </span>
        {description && (
          <span className="text-xs text-secondary mt-0.5 leading-snug">{description}</span>
        )}
      </div>
    </label>
  )
}
