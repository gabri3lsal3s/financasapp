import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useRegisterFloatingActions, useRegisterRawActions } from '@/hooks/useFloatingActions'
import type { RawPageAction } from '@/contexts/floatingActionsSharedContext'

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
 * @param actions - Array de ações flutuantes da página
 * @param launchModalOpen - Quando true, oculta botões secundários (evita sobreposição com modais)
 */
export function usePageActions(actions: PageAction[], launchModalOpen = false): void {
  const visibleActions = actions.filter((a) => a.show !== false)

  // Registra o array estruturado para o novo PageActionButtonHub
  const rawActions: RawPageAction[] = visibleActions.map((a) => ({
    icon: a.icon,
    label: a.label,
    intent: a.intent,
    onClick: a.onClick,
    actionRole: a.actionRole,
    disabled: a.disabled,
    title: a.title,
    className: a.className,
    show: a.show,
    compactOnMobile: a.compactOnMobile,
  }))

  useRegisterRawActions(rawActions)

  // Mantém o nó ReactNode legado como null (FloatingSideStack já não renderiza ações)
  const actionNode: ReactNode = null
  useRegisterFloatingActions(actionNode)

  // Mantém compatibilidade: a prop launchModalOpen é usada internamente pelo hub
  void launchModalOpen
}
