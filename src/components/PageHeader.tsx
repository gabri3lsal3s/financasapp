import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Título do conteúdo da página (renderizado como h2 — o h1 global fica no AppTopBar). */
  title: ReactNode
  /** Descrição/metadados abaixo do título. */
  subtitle?: ReactNode
  /** Ações/CTAs alinhados à direita (ex.: Button, PageHeaderActions). */
  action?: ReactNode
  className?: string
  /** Ocultar subtítulo em telas estreitas (mobile). Padrão: false. */
  truncateSubtitleOnMobile?: boolean
}

/**
 * Cabeçalho de conteúdo de página — padrão visual único para o topo das telas.
 *
 * Convenções do app:
 * - O `h1` global da página é renderizado pelo `AppTopBar` (getPageTitle).
 *   Este componente usa `h2` para o título de conteúdo, mantendo a hierarquia correta.
 * - Segue o padrão visual: text-2xl/sm, font-bold, uppercase tracking-tight.
 * - Subtítulo em `text-secondary` com truncate em mobile quando necessário.
 * - Ações à direita (Regra 4: ações principais na metade inferior em mobile).
 *
 * Uso:
 * <PageHeader title="Despesas" subtitle="Competência março/2026"
 *   action={<Button size="lg">Nova despesa</Button>} />
 */
export default function PageHeader({
  title,
  subtitle,
  action,
  className,
  truncateSubtitleOnMobile = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex w-full items-start justify-between gap-3',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold uppercase tracking-tight text-primary sm:text-2xl">
          {title}
        </h2>
        {subtitle !== undefined && subtitle !== null && (
          <p
            className={cn(
              'mt-1 text-xs text-secondary sm:text-sm',
              truncateSubtitleOnMobile && 'truncate sm:truncate-none sm:whitespace-normal'
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  )
}
