import { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantStyles = {
    primary: 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-button-text)] hover:opacity-90',
    secondary: 'border-primary bg-tertiary text-primary hover:bg-primary',
    danger: 'border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:opacity-90',
    outline: 'border-primary bg-secondary text-secondary hover:text-primary hover:bg-tertiary',
    ghost: 'border-transparent bg-transparent text-secondary hover:text-primary hover:bg-tertiary',
  }
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm min-h-9',
    md: 'px-4 py-2 text-base min-h-10',
    lg: 'px-6 py-3 text-lg min-h-12',
  }
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}





