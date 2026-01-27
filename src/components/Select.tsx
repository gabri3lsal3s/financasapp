import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full px-4 py-2 border rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-focus)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all duration-[var(--transition-fast)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-disabled)] ${
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
          } ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select


