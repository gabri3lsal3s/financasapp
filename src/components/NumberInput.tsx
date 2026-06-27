import { InputHTMLAttributes, forwardRef, useId, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Minus, Plus } from 'lucide-react'
import { Z_INDEX } from '@/constants/zIndex'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string
  error?: string
  helperText?: string
  suffix?: string
  prefix?: string
  min?: number
  max?: number
  step?: number | string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  hideSpinButtons?: boolean
  /** Quando true, cria um layout compacto sem label (apenas o input com os botões) */
  compact?: boolean
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ 
    label, 
    error, 
    helperText, 
    suffix, 
    prefix,
    min, 
    max, 
    step = 'any', 
    value, 
    onChange, 
    className = '', 
    id, 
    hideSpinButtons = false,
    compact = false,
    disabled,
    placeholder,
    name,
    ...props 
  }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    const parsedValue = typeof value === 'string' ? parseFloat(value) : value
    const numericValue = isNaN(parsedValue) ? 0 : parsedValue

    const handleStep = useCallback((direction: 1 | -1) => {
      if (disabled) return
      const stepSize = typeof step === 'number' ? step : parseFloat(String(step || '1')) || 1
      const newValue = numericValue + (direction * stepSize)
      
      let clampedValue = newValue
      if (min !== undefined) clampedValue = Math.max(min, clampedValue)
      if (max !== undefined) clampedValue = Math.min(max, clampedValue)

      // Criar um evento sintético compatível com onChange
      const fakeEvent = {
        target: {
          value: String(clampedValue),
          name,
        },
      } as React.ChangeEvent<HTMLInputElement>
      onChange(fakeEvent)
    }, [disabled, step, numericValue, min, max, name, onChange])

    // Determinar se os botões devem ser desabilitados
    const canDecrement = min === undefined || numericValue > min
    const canIncrement = max === undefined || numericValue < max

    if (compact) {
      return (
        <div className={cn('relative flex items-center', className)}>
          {prefix && (
            <span className={`absolute left-2.5 text-secondary font-bold text-[10px] pointer-events-none ${Z_INDEX.CONTENT}`}>
              {prefix}
            </span>
          )}
          {!hideSpinButtons && (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || !canDecrement}
              onClick={() => handleStep(-1)}
              className={cn(
                `absolute left-1 top-1/2 -translate-y-1/2 ${Z_INDEX.CONTENT} w-6 h-6 rounded-md flex items-center justify-center transition-all`,
                disabled || !canDecrement
                  ? 'text-secondary/30 cursor-not-allowed'
                  : 'text-secondary hover:text-primary hover:bg-glass/10 active:scale-90 cursor-pointer'
              )}
              aria-label="Diminuir"
            >
              <Minus size={12} />
            </button>
          )}
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            className={cn(
              'flex h-8 w-full rounded-lg border border-glass glass-input px-3 py-2 text-xs font-mono font-bold text-right text-primary ring-offset-background',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-all motion-standard',
              !hideSpinButtons && 'pl-8 pr-2',
              hideSpinButtons && 'px-2.5',
              error && 'border-destructive',
              className
            )}
            {...props}
          />
          {!hideSpinButtons && (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || !canIncrement}
              onClick={() => handleStep(1)}
              className={cn(
                `absolute right-1 top-1/2 -translate-y-1/2 ${Z_INDEX.CONTENT} w-6 h-6 rounded-md flex items-center justify-center transition-all`,
                disabled || !canIncrement
                  ? 'text-secondary/30 cursor-not-allowed'
                  : 'text-secondary hover:text-primary hover:bg-glass/10 active:scale-90 cursor-pointer'
              )}
              aria-label="Aumentar"
            >
              <Plus size={12} />
            </button>
          )}
          {suffix && (
            <span className={`absolute right-2.5 text-secondary font-bold text-[10px] pointer-events-none ${Z_INDEX.CONTENT}`}>
              {suffix}
            </span>
          )}
        </div>
      )
    }

    return (
      <div className="modal-field w-full">
        {label && (
          <Label htmlFor={inputId} className="block">
            {label}
          </Label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className={`absolute left-3 text-secondary font-bold text-[10px] pointer-events-none ${Z_INDEX.CONTENT}`}>
              {prefix}
            </span>
          )}
          {!hideSpinButtons && (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || !canDecrement}
              onClick={() => handleStep(-1)}
              className={cn(
                `absolute left-1.5 top-1/2 -translate-y-1/2 ${Z_INDEX.CONTENT} w-7 h-7 rounded-lg flex items-center justify-center transition-all`,
                disabled || !canDecrement
                  ? 'text-secondary/30 cursor-not-allowed'
                  : 'text-secondary hover:text-primary hover:bg-glass/10 active:scale-90 cursor-pointer'
              )}
              aria-label="Diminuir"
            >
              <Minus size={14} />
            </button>
          )}
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            className={cn(
              'flex h-10 w-full rounded-xl border border-glass glass-input px-3 py-2 text-sm text-primary ring-offset-background',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-all motion-standard',
              !hideSpinButtons && (prefix ? 'pl-10 pr-9' : 'pl-9 pr-9'),
              hideSpinButtons && (prefix ? 'pl-7 pr-3' : 'px-3'),
              error && 'border-destructive',
              className
            )}
            {...props}
          />
          {!hideSpinButtons && (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || !canIncrement}
              onClick={() => handleStep(1)}
              className={cn(
                `absolute right-1.5 top-1/2 -translate-y-1/2 ${Z_INDEX.CONTENT} w-7 h-7 rounded-lg flex items-center justify-center transition-all`,
                disabled || !canIncrement
                  ? 'text-secondary/30 cursor-not-allowed'
                  : 'text-secondary hover:text-primary hover:bg-glass/10 active:scale-90 cursor-pointer'
              )}
              aria-label="Aumentar"
            >
              <Plus size={14} />
            </button>
          )}
          {suffix && (
            <span className={`absolute right-3 text-secondary font-bold text-[10px] pointer-events-none ${Z_INDEX.CONTENT}`}>
              {suffix}
            </span>
          )}
        </div>
        {error ? (
          <p className="text-sm text-destructive mt-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-secondary opacity-80 mt-1">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

NumberInput.displayName = 'NumberInput'

export default NumberInput
