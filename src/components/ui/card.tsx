import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Quando fornecido, o card se comporta como botão (cursor pointer, keyboard accessible). */
  onClick?: React.MouseEventHandler<HTMLDivElement> | (() => void)
}

const Card = React.forwardRef<
  HTMLDivElement,
  CardProps
>(({ className, onClick, onKeyDown, role, tabIndex, ...props }, ref) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick(event as unknown as React.MouseEvent<HTMLDivElement>)
    }
    onKeyDown?.(event)
  }

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-glass surface-glass text-card-foreground shadow-sm motion-standard',
        onClick
          ? 'cursor-pointer motion-standard press-subtle focus:outline-none hover:scale-[1.015]'
          : '',
        className
      )}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : onKeyDown}
      role={onClick ? (role ?? 'button') : role}
      tabIndex={onClick ? (tabIndex ?? 0) : tabIndex}
      {...props}
    />
  )
})
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-4', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-primary', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-4 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
