import { InputHTMLAttributes, forwardRef, useId } from 'react'
import { Calendar } from 'lucide-react'
import { Input as ShadcnInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
      <div className="w-full">
        {label && (
          <Label htmlFor={inputId} className="mb-1 block">
            {label}
          </Label>
        )}
        <div className="relative">
          <ShadcnInput
            ref={ref}
            id={inputId}
            className={cn(
              props.type === 'date' ? 'pl-4 pr-10' : '',
              error ? 'border-destructive' : '',
              className
            )}
            {...props}
          />
          {props.type === 'date' && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-secondary">
              <Calendar size={18} />
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-secondary opacity-60">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
