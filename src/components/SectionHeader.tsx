import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  /** Conteúdo do heading (padrão children) */
  children?: ReactNode
  className?: string
  /** Nível do heading: h2 (default), h3, h4 */
  as?: 'h2' | 'h3' | 'h4'
  /** Se true, adiciona borda inferior */
  bordered?: boolean

  /** Título da seção (alternativa a children para uso com description+action) */
  title?: string
  /** Descrição abaixo do título */
  description?: string
  /** Elemento de ação (botão, etc) alinhado à direita */
  action?: ReactNode
}

const headingStyles = {
  h2: 'text-sm sm:text-base',
  h3: 'text-sm',
  h4: 'text-xs',
}

/**
 * Cabeçalho de seção padronizado.
 * Segue o padrão visual do app: uppercase, font-bold/black, tracking-wider, text-primary.
 *
 * Uso com children (novo padrão):
 * @example
 * <SectionHeader>Insights Financeiros do Período</SectionHeader>
 * <SectionHeader as="h4" bordered>Metas de Alocação</SectionHeader>
 *
 * Uso com title + description + action (legado, ex: Settings):
 * @example
 * <SectionHeader title="Aparência" description="Tema e cor de destaque" />
 * <SectionHeader title="Admin" action={<Button>Atualizar</Button>} />
 */
export default function SectionHeader({
  children,
  className,
  as: Tag = 'h3',
  bordered = false,
  title,
  description,
  action,
}: SectionHeaderProps) {
  // Modo legado: title + description + action
  if (title !== undefined) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center justify-between gap-3">
          <Tag
            className={cn(
              'font-bold uppercase tracking-wider text-primary text-sm',
            )}
          >
            {title}
          </Tag>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
        {description && (
          <p className="text-sm text-secondary">{description}</p>
        )}
      </div>
    )
  }

  // Modo padrão: children + as + bordered (AssetConfigModal, QuantPreferencesEditor)
  return (
    <Tag
      className={cn(
        'font-bold uppercase tracking-wider text-primary',
        headingStyles[Tag],
        bordered && 'border-b border-glass/10 pb-1 mb-2',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
