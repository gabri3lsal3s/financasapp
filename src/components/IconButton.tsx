import { ReactNode, ButtonHTMLAttributes } from 'react'
import Button, { type ButtonVariant } from '@/components/Button'
import { cn } from '@/lib/utils'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'neutral' | 'danger' | 'success' | 'ghost' | 'ghost-danger'
  label?: string
}

const sizeStyles = {
  sm: 'h-8 w-8 min-h-8',
  md: 'h-10 w-10 min-h-10',
  lg: 'h-11 w-11 min-h-11',
}

const variantMap: Record<string, ButtonVariant> = {
  neutral: 'outline',
  danger: 'expense',
  success: 'income',
  ghost: 'ghost',
  'ghost-danger': 'ghost-danger',
}

export default function IconButton({
  icon,
  size = 'md',
  variant = 'neutral',
  label,
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <Button
      type="button"
      variant={variantMap[variant]}
      size="icon"
      aria-label={label}
      className={cn('rounded-full', sizeStyles[size], className)}
      {...props}
    >
      {icon}
    </Button>
  )
}
