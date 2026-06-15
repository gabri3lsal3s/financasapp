import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/utils/format'
import { portfolioOperationLabel } from '@/utils/portfolioOperations'
import ReconciliationCard from '@/components/reconciliation/ReconciliationCard'
import ReconciliationBadge from '@/components/reconciliation/ReconciliationBadge'
import type { PositionAdjustmentSuggestion } from '@/utils/investmentExcelReconciliation'

interface B3AdjustmentCardProps {
  adj: PositionAdjustmentSuggestion
  isChecked: boolean
  onToggle: () => void
}

export default function B3AdjustmentCard({ adj, isChecked, onToggle }: B3AdjustmentCardProps) {
  return (
    <ReconciliationCard
      selected={isChecked}
      onClick={onToggle}
      variant="balance"
      className="p-3.5 flex items-start gap-3 text-[11px]"
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isChecked}
          onCheckedChange={onToggle}
          className="mt-0.5 h-3.5 w-3.5 rounded border-glass"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-primary text-xs">{adj.ticker}</span>
          <ReconciliationBadge
            variant={adj.operation_type === 'buy' ? 'success' : 'missing'}
          >
            {adj.operation_type === 'buy' ? 'Aporte de Ajuste' : 'Retirada de Ajuste'}
          </ReconciliationBadge>
        </div>
        <p className="text-[9.5px] text-secondary mt-1 font-mono">
          {portfolioOperationLabel(adj.operation_type)} de{' '}
          <strong className="text-primary font-bold">{adj.quantity}</strong> un a{' '}
          <strong className="text-primary font-bold">{formatCurrency(adj.price)}</strong> em{' '}
          <span className="underline">{adj.date}</span>.
        </p>
      </div>
    </ReconciliationCard>
  )
}
