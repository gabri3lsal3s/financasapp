import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useRegisterFloatingActions } from '@/hooks/useFloatingActions'
import { PageHeaderActions } from '@/components/PageHeaderActions'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'

export type PageActionIntent = 'neutral' | 'primary' | 'income' | 'expense' | 'balance' | 'warning'

export interface PageAction {
  icon: LucideIcon
  label: string
  intent?: PageActionIntent
  onClick: () => void
  actionRole?: 'launch' | 'secondary'
  disabled?: boolean
  title?: string
  className?: string
  /** Quando false, o botão não é renderizado (útil para ações condicionais). */
  show?: boolean
  /** Oculta o rótulo em telas estreitas. Padrão: true */
  compactOnMobile?: boolean
}

/**
 * Hook que substitui o padrão PageHeader.
 *
 * Em vez de renderizar `<PageHeader action={<PageHeaderActions>...</PageHeaderActions>}>`
 * (3 imports + JSX que renderiza null), use:
 *
 * ```tsx
 * usePageActions([
 *   { icon: Plus, label: 'Adicionar', intent: 'primary', onClick: fn }
 * ], launchModalOpen)
 * ```
 *
 * @param actions - Array de ações flutuantes da página
 * @param launchModalOpen - Quando true, oculta botões secundários (evita sobreposição com modais)
 */
export function usePageActions(actions: PageAction[], launchModalOpen = false): void {
  // Computa o nó de ações diretamente a cada render.
  // useRegisterFloatingActions já usa useLayoutEffect com diffing,
  // então memoização antecipada causaria problemas de reatividade
  // em props como `intent`, `disabled` e `className`.
  let actionNode: ReactNode = null

  if (actions.length > 0) {
    const visibleActions = actions.filter((a) => a.show !== false)

    if (visibleActions.length > 0) {
      actionNode = (
        <PageHeaderActions launchModalOpen={launchModalOpen}>
          {visibleActions.map((action, index) => {
            const Icon = action.icon
            return (
              <PageHeaderActionButton
                key={index}
                actionRole={action.actionRole ?? 'secondary'}
                intent={action.intent ?? 'neutral'}
                icon={Icon}
                label={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.title}
                className={action.className}
                compactOnMobile={action.compactOnMobile ?? true}
              />
            )
          })}
        </PageHeaderActions>
      )
    }
  }

  useRegisterFloatingActions(actionNode)
}
