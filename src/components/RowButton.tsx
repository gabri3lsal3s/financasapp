import type { ReactNode } from 'react'
import Button from '@/components/Button'
import { cn } from '@/lib/utils'

interface RowButtonProps {
  children: ReactNode
  onClick: () => void
  /** Classes CSS adicionais para personalização do botão */
  className?: string
  /** Tipo HTML do botão (padrão: 'button') */
  type?: 'button' | 'submit'
  /** Desabilita o botão */
  disabled?: boolean
  /** Se true, aplica animação de entrada em lista (animate-stagger-item) */
  animated?: boolean
}

/**
 * Componente base de botão expansivo para itens de lista.
 *
 * Fornece a estrutura padrão de botão de linha horizontalmente expandido:
 * - Largura total, altura automática
 * - Alinhamento de texto à esquerda
 * - Layout em coluna com itens esticados
 * - Padding padrão p-2.5
 *
 * Usado como base para: BillExpenseRowButton, PaymentRowButton, ReportsCategoryRowButton
 * e outros botões de lista no projeto.
 */
export default function RowButton({
  children,
  onClick,
  className,
  type = 'button',
  disabled,
  animated,
}: RowButtonProps) {
  return (
    <Button
      type={type}
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full h-auto text-left flex-col items-stretch p-2.5',
        animated && 'animate-stagger-item',
        className
      )}
    >
      {children}
    </Button>
  )
}
