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
  const baseStyles = 'rounded-full border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantStyles = {
    neutral: 'border-primary text-secondary hover:text-primary hover:bg-tertiary',
    danger: 'border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-tertiary',
    success: 'border-[var(--color-income)] text-income hover:bg-tertiary',
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
