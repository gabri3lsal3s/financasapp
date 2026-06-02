import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-standard press-subtle [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border border-primary/25 bg-primary text-primary-foreground shadow-sm hover:opacity-90',
        destructive:
          'border border-destructive/25 bg-destructive text-destructive-foreground hover:opacity-90',
        outline:
          'border border-glass bg-transparent text-primary hover:bg-accent hover:text-primary',
        secondary:
          'border border-glass bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'border border-transparent text-secondary hover:bg-accent hover:text-primary',
        link: 'border-transparent text-secondary hover:text-primary underline-offset-4 hover:underline font-medium',
        income:
          'border border-glass bg-transparent text-income hover:bg-income/10 hover:text-income',
        expense:
          'border border-glass bg-transparent text-expense hover:bg-expense/10 hover:text-expense',
        balance:
          'border border-glass bg-transparent text-balance hover:bg-balance/10 hover:text-balance',
        warning:
          'border border-glass bg-transparent text-warning hover:bg-warning/10 hover:text-warning',
        success:
          'border border-income/25 bg-income text-primary-foreground shadow-sm hover:opacity-90',
        'warning-solid':
          'border border-warning/25 bg-warning text-primary-foreground shadow-sm hover:opacity-90',
        'ghost-success':
          'border border-transparent text-income hover:bg-income/10 hover:text-income',
        'ghost-danger':
          'border border-transparent text-expense hover:bg-expense/10 hover:text-expense',
      },
      size: {
        default: 'h-10 px-4 py-2 min-h-10',
        sm: 'h-9 rounded-lg px-3 min-h-9',
        lg: 'h-12 rounded-xl px-6 min-h-12 text-base',
        icon: 'h-10 w-10 min-h-10',
        xs: 'h-8 rounded-xl px-3 min-h-8 text-[10px] font-extrabold uppercase tracking-wider',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
