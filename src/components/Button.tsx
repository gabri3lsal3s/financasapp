import { ReactNode, ButtonHTMLAttributes } from 'react'
import { Button as ShadcnButton, type ButtonProps as ShadcnButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'outline'
  | 'ghost'
  | 'ghost-success'
  | 'ghost-danger'
  | 'link'
  | 'income'
  | 'expense'
  | 'balance'
  | 'warning'
  | 'warning-solid'
  | 'success'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  size?: 'xs' | 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const variantMap: Record<ButtonVariant, NonNullable<ShadcnButtonProps['variant']>> = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  outline: 'outline',
  ghost: 'ghost',
  link: 'link',
  income: 'income',
  expense: 'expense',
  balance: 'balance',
  warning: 'warning',
  'warning-solid': 'warning-solid',
  success: 'success',
  'ghost-success': 'ghost-success',
  'ghost-danger': 'ghost-danger',
}

const sizeMap: Record<NonNullable<ButtonProps['size']>, NonNullable<ShadcnButtonProps['size']>> = {
  xs: 'xs',
  sm: 'sm',
  md: 'default',
  lg: 'lg',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={cn(fullWidth ? 'w-full' : '', className)}
      {...props}
    >
      {children}
    </ShadcnButton>
  )
}
