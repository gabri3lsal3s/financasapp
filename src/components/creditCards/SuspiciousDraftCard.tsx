import { addMonths, format } from 'date-fns'
import Button from '@/components/Button'
import { formatCurrency, formatDate } from '@/utils/format'
import ReconciliationCard from '@/components/reconciliation/ReconciliationCard'
import ReconciliationAlert from '@/components/reconciliation/ReconciliationAlert'

export interface SuspiciousItem {
  id: string
  description?: string | null
  date: string
  amount: number
  base_amount?: number
  category_name?: string | null
  installment_number?: number | null
  installment_total?: number | null
  bill_competence?: string | null
}

interface SuspiciousDraftCardProps {
  item: SuspiciousItem
  loading: boolean
  onUnlink: () => Promise<void>
  onIgnore: () => void
  onMove: (newMonth: string) => Promise<void>
}

export default function SuspiciousDraftCard({
  item,
  loading,
  onUnlink,
  onIgnore,
  onMove,
}: SuspiciousDraftCardProps) {
  const purchaseDay = new Date(item.date + 'T12:00:00').getDate()
  const canMove = purchaseDay >= 25 || purchaseDay <= 10
  const targetMonthLabel = purchaseDay >= 25 ? 'próxima fatura' : 'fatura anterior'

  const handleUnlink = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Remover este item do cartão? Ele será mantido como despesa avulsa comum.')) return
    await onUnlink()
  }

  const handleMove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const baseDate = new Date(item.date + 'T12:00:00')
    const newMonth = format(addMonths(baseDate, purchaseDay >= 25 ? 1 : -1), 'yyyy-MM')
    
    if (confirm(`Mover este lançamento para a fatura de ${newMonth}?`)) {
      await onMove(newMonth)
    }
  }

  return (
    <ReconciliationCard
      selected
      variant="warning"
      className="p-4 space-y-3 cursor-default"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary break-words font-sans">
          {item.description || 'Sem descrição'}
        </p>
        <p className="text-xs text-secondary mt-0.5 font-medium font-mono">
          {formatDate(item.date)} • {formatCurrency(Math.abs(Number(item.base_amount ?? item.amount ?? 0)))}
          {item.category_name ? ` • ${item.category_name}` : ''}
          {item.installment_number && item.installment_total
            ? ` • Parcela ${item.installment_number}/${item.installment_total}`
            : ''}
        </p>
        <ReconciliationAlert variant="warning" className="mt-2">
          Este lançamento está vinculado ao cartão mas não foi encontrado no arquivo de fatura oficial enviado.
          Ele pode ter sido cadastrado no cartão incorreto ou pertencer a outro mês.
        </ReconciliationAlert>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleUnlink}
          disabled={loading}
        >
          Desvincular do cartão
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1 text-secondary"
          onClick={onIgnore}
        >
          Ignorar alerta
        </Button>
        {canMove && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 border-[color-mix(in_srgb,var(--color-balance)_30%,var(--glass-border))] hover:bg-[color-mix(in_srgb,var(--color-balance)_10%,transparent)] text-balance"
            onClick={handleMove}
            disabled={loading}
          >
            Mover para {targetMonthLabel}
          </Button>
        )}
      </div>
    </ReconciliationCard>
  )
}
