import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { Button as ShadcnButton, type ButtonProps as ShadcnButtonProps } from '@/components/ui/button'

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
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'
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
  icon: 'icon',
}

/**
 * Botão com nomes de variantes amigáveis (primary, danger, etc.).
 * Mapeia para as variantes do Shadcn/ui.
 *
 * Prefira usar diretamente `Button` de `@/components/ui/button` para novo código.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      fullWidth={fullWidth}
      className={className}
      {...props}
    >
      {children}
    </ShadcnButton>
  )
}
