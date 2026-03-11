import { SelectHTMLAttributes, forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const selectId = id ?? generatedId

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-primary mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`w-full pl-4 pr-10 py-2 border rounded-lg bg-primary text-primary hover:border-[var(--color-focus)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all duration-[var(--transition-fast)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-disabled)] appearance-none ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
              } ${className}`}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-secondary">
            <ChevronDown size={18} />
          </div>
        </div>
        {error && <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select





