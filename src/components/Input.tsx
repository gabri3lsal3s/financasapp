import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-2 border rounded-lg bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] hover:border-[var(--color-focus)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all duration-[var(--transition-fast)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-disabled)] ${
            error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input


