import { ReactNode, ButtonHTMLAttributes } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'neutral' | 'danger' | 'success'
  label?: string
}

export default function IconButton({
  icon,
  size = 'md',
  variant = 'neutral',
  label,
  className = '',
  ...props
}: IconButtonProps) {
  const baseStyles = 'rounded-full transition-all duration-[var(--transition-fast)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.05] active:scale-[0.95]'
  
  const variantStyles = {
    neutral: 'text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]',
    danger: 'text-[var(--color-danger)] hover:bg-[rgba(var(--color-danger),0.1)]',
    success: 'text-[var(--color-income)] hover:bg-[rgba(var(--color-income),0.1)]',
  }
  
  const sizeStyles = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  }
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      aria-label={label}
      {...props}
    >
      {icon}
    </button>
  )
}
