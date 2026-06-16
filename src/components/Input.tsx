import { InputHTMLAttributes, forwardRef, useId } from 'react'
import { Input as ShadcnInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import DatePicker from '@/components/DatePicker'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    const isDateInput = props.type === 'date'

    return (
      <div className="modal-field w-full">
        {label && (
          <Label htmlFor={inputId} className="block">
            {label}
          </Label>
        )}
        {isDateInput ? (
          <DatePicker
            id={inputId}
            value={String(props.value ?? '')}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={props.onChange as any}
            name={props.name}
            placeholder={props.placeholder}
            disabled={props.disabled}
            required={props.required}
            className={cn(error ? 'border-destructive' : '', className)}
          />
        ) : (
          <div className="relative">
            <ShadcnInput
              ref={ref}
              id={inputId}
              className={cn(
                error ? 'border-destructive' : '',
                className
              )}
              {...props}
            />
          </div>
        )}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-secondary opacity-80">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
