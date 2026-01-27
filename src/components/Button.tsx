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
  const baseStyles = 'font-medium rounded-lg transition-all duration-[var(--transition-fast)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'
  
  const variantStyles = {
    primary: 'bg-[var(--color-primary)] text-[var(--color-button-text)] hover:scale-[1.02] hover:shadow-md active:shadow-sm',
    secondary: 'bg-[var(--color-hover)] text-[var(--color-text-primary)] hover:scale-[1.02] hover:shadow-md active:shadow-sm',
    danger: 'bg-[var(--color-danger)] text-white hover:scale-[1.02] hover:shadow-md active:shadow-sm',
    outline: 'border-2 border-[var(--color-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] hover:scale-[1.02] active:scale-[0.98]',
    ghost: 'text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] hover:scale-[1.02]',
  }
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
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


