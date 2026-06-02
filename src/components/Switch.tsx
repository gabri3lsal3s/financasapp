import type { ButtonHTMLAttributes } from 'react'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'role'> {
  checked: boolean
  label?: string
}

export default function Switch({
  checked,
  label,
  className = '',
  title,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title ?? label}
      aria-label={label}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] ${
        checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-disabled)]'
      } ${className}`}
      {...props}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[var(--color-bg-primary)] shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
