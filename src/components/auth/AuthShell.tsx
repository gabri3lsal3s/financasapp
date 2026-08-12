/**
 * AuthShell — scaffold compartilhado das telas de autenticação e onboarding (DRY).
 *
 * Centraliza o padrão repetido em 5 páginas (Login, Register, ForgotPassword,
 * ResetPassword, OnboardingCategories): fundo centralizado com glow, container
 * com largura controlada, marca circular e título. Cada página passa seu
 * conteúdo (cards/formulários) como children.
 */
import type { ReactNode } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  title: string
  /** Ícone da marca (lucide) exibido no círculo superior. */
  icon: ReactNode
  subtitle?: ReactNode
  /** 'md' (padrão, max-w-md) ou 'xl' (onboarding, max-w-xl). */
  maxWidth?: 'md' | 'xl'
  /** Classes do círculo da marca (controle de tamanho). */
  markClassName?: string
  className?: string
  children: ReactNode
}

export default function AuthShell({
  title,
  icon,
  subtitle,
  maxWidth = 'md',
  markClassName = 'h-12 w-12',
  className,
  children,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-secondary px-4 py-12 sm:px-6 lg:px-8 animate-page-enter">
      <div className="app-shell-glow" aria-hidden="true" />
      <div
        className={cn(
          'relative w-full space-y-8',
          Z_INDEX.CONTENT,
          maxWidth === 'md' ? 'max-w-md' : 'max-w-xl',
          className,
        )}
      >
        <div>
          <div
            className={cn(
              'mx-auto flex items-center justify-center rounded-full surface-glass glass-refract ring-1 ring-glass',
              markClassName,
            )}
          >
            {icon}
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-primary">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-center text-sm text-secondary px-4">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
