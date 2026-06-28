import { InputHTMLAttributes, forwardRef, useId } from 'react'
import { Input as ShadcnInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import DatePicker from '@/components/DatePicker'

/** Evento sintético mínimo compatível com ChangeEvent<HTMLInputElement>.
 * Usado como ponte entre DatePicker e o onChange padrão do Input. */
interface SyntheticInputChange {
  target: { value: string; name?: string }
}

/**
 * Converte um SyntheticInputChange para ChangeEvent<HTMLInputElement>.
 * Ambos são estruturalmente compatíveis (target.value + target.name),
 * então o cast é seguro sem necessidade de `unknown` intermediário.
 */
function toChangeEvent(e: SyntheticInputChange): React.ChangeEvent<HTMLInputElement> {
  return e as React.ChangeEvent<HTMLInputElement>
}

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
            onChange={(e) => {
              if (props.onChange) {
                // DatePicker emite { target: { value, name } } — compatível estruturalmente
                // com ChangeEvent<HTMLInputElement>. Usamos uma função bridge tipada.
                props.onChange(toChangeEvent(e))
              }
            }}
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
