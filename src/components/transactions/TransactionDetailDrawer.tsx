import { RefreshCw, Pencil, Trash2 } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import InfoTooltip from '@/components/InfoTooltip'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'
import { formatCurrency } from '@/utils/format'
import { getCategoryIcon } from '@/utils/categoryIcons'

interface TransactionDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  amount: number
  originalAmount?: number
  dateLabel: string
  categoryColor: string
  categoryIconName?: string
  isOffline?: boolean
  installmentInfo?: string
  paymentLabel?: string
  paymentColor?: string
  billCompetenceLabel?: string
  onEdit?: () => void
  onDelete?: () => void
}

/** Linha de detalhe rotulada dentro do painel do drawer. */
function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <span className="text-[9px] uppercase font-bold tracking-widest block mb-0.5 text-secondary/70">
        {label}
      </span>
      <span className="font-semibold font-mono block text-[12px]" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  )
}

/**
 * Bottom sheet (mobile) / dialog (desktop) com os detalhes completos de uma
 * transação e ações de edição/exclusão.
 *
 * Substitui a expansão inline (sanfona) do TransactionCard no mobile:
 * - o card vira um feed limpo (sem layout shift);
 * - o toque abre este drawer com dados completos e ações.
 */
export default function TransactionDetailDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  amount,
  originalAmount,
  dateLabel,
  categoryColor,
  categoryIconName,
  isOffline,
  installmentInfo,
  paymentLabel,
  paymentColor,
  billCompetenceLabel,
  onEdit,
  onDelete,
}: TransactionDetailDrawerProps) {
  const showOriginalAmount = originalAmount !== undefined && Math.abs(originalAmount - amount) > 0.009

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalhes • ${title}`}>
      <div className="modal-body-stack">
        {/* Resumo do lançamento */}
        <div className="rounded-xl border border-glass surface-glass p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${categoryColor} 12%, transparent)`, color: categoryColor }}
              >
                {getCategoryIcon(subtitle, 13, categoryIconName)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary truncate flex items-center gap-1.5">
                  {title}
                  {isOffline && (
                    <span title="Pendente de sincronização" className="flex-shrink-0 flex">
                      <RefreshCw size={12} className="animate-spin text-[var(--ds-color-accent-primary)]" />
                    </span>
                  )}
                </p>
                <p className="text-[9px] text-secondary truncate">{subtitle}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              {showOriginalAmount && (
                <div className="flex items-center gap-1 justify-end mb-0.5">
                  <span className="text-[10px] line-through text-secondary opacity-60">
                    {formatCurrency(originalAmount)}
                  </span>
                  <InfoTooltip content={WEIGHT_TOOLTIPS.transactionValue} iconSize={8} />
                </div>
              )}
              <p className="text-base font-bold font-mono text-primary">{formatCurrency(amount)}</p>
            </div>
          </div>
        </div>

        {/* Grade de detalhes */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3.5 rounded-xl surface-glass border border-glass">
          <DetailRow label="Método" value={paymentLabel || 'Outros'} valueColor={paymentColor} />
          <DetailRow label="Data Completa" value={dateLabel} />
          {installmentInfo && (
            <div className="col-span-2 pt-2 border-t border-glass">
              <DetailRow label="Parcelamento" value={installmentInfo} />
            </div>
          )}
          {billCompetenceLabel && (
            <div className="col-span-2 pt-2 border-t border-glass">
              <DetailRow
                label="Fatura Competência"
                value={billCompetenceLabel}
                valueColor="var(--ds-color-accent-primary)"
              />
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 justify-end">
          {onDelete && (
            <Button
              type="button"
              size="sm"
              variant="expense"
              onClick={onDelete}
              className="gap-1.5 select-none min-h-[44px]"
            >
              <Trash2 size={16} aria-hidden />
              <span className="text-xs font-bold">Excluir</span>
            </Button>
          )}
          {onEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="gap-1.5 select-none min-h-[44px]"
            >
              <Pencil size={16} aria-hidden />
              <span className="text-xs font-bold">Editar</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
