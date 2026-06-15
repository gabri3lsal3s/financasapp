import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/utils/format'
import { portfolioOperationLabel } from '@/utils/portfolioOperations'
import ReconciliationCard from '@/components/reconciliation/ReconciliationCard'
import ReconciliationSideBySide from '@/components/reconciliation/ReconciliationSideBySide'
import type { PortfolioOperationType, PortfolioTransaction } from '@/types'
import type { B3TransactionItem } from '@/utils/investmentExcelReconciliation'

export interface ConflictDraft {
  key: string
  existingId: string
  officialId: string
  selected: boolean
  applied: boolean
  date: string
  quantity: string
  price: string
  operation_type: PortfolioOperationType
  official: B3TransactionItem
  existing: PortfolioTransaction
}

interface InvestmentConflictCardProps {
  draft: ConflictDraft
  onToggleSelect: () => void
}

export default function InvestmentConflictCard({ draft, onToggleSelect }: InvestmentConflictCardProps) {
  const isPriceDiff = Math.abs(draft.existing.price - draft.official.price) > 0.0001
  const isQtyDiff = Math.abs(draft.existing.quantity - draft.official.quantity) > 0.0001
  const isDateDiff = draft.existing.date !== draft.official.date
  const isOpDiff = draft.existing.operation_type !== draft.official.operation_type

  const leftContent = (
    <div className="space-y-1">
      <p className="text-[9px] text-secondary">
        Tipo:{' '}
        <span className={cn('font-bold', isOpDiff ? 'text-warning' : 'text-primary')}>
          {portfolioOperationLabel(draft.existing.operation_type)}
        </span>
      </p>
      <div className="grid grid-cols-3 gap-1.5 text-secondary font-mono text-[10px]">
        <div>
          <span>Data</span>
          <span className={cn('block font-bold text-primary', isDateDiff ? 'text-warning' : '')}>
            {draft.existing.date}
          </span>
        </div>
        <div>
          <span>Qtd</span>
          <span className={cn('block font-bold text-primary', isQtyDiff ? 'text-warning' : '')}>
            {draft.existing.quantity} un
          </span>
        </div>
        <div>
          <span>Preço</span>
          <span className={cn('block font-bold text-primary', isPriceDiff ? 'text-warning' : '')}>
            {formatCurrency(draft.existing.price)}
          </span>
        </div>
      </div>
    </div>
  )

  const rightContent = (
    <div className="space-y-1">
      <p className="text-[9px] text-secondary truncate" title={draft.official.raw_operation_type}>
        Mov. B3: <span className="font-bold text-primary">{draft.official.raw_operation_type}</span>
      </p>
      <p className="text-[9px] text-secondary">
        Tipo:{' '}
        <span className={cn('font-bold', isOpDiff ? 'text-balance' : 'text-primary')}>
          {portfolioOperationLabel(draft.official.operation_type)}
        </span>
      </p>
      <div className="grid grid-cols-3 gap-1.5 text-secondary font-mono text-[10px]">
        <div>
          <span>Data</span>
          <span className={cn('block font-bold text-primary', isDateDiff ? 'text-balance font-extrabold' : '')}>
            {draft.official.date}
          </span>
        </div>
        <div>
          <span>Qtd</span>
          <span className={cn('block font-bold text-primary', isQtyDiff ? 'text-balance font-extrabold' : '')}>
            {draft.official.quantity} un
          </span>
        </div>
        <div>
          <span>Preço</span>
          <span className={cn('block font-bold text-primary', isPriceDiff ? 'text-balance font-extrabold' : '')}>
            {formatCurrency(draft.official.price)}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <ReconciliationCard
      selected={draft.selected}
      onClick={onToggleSelect}
      className="p-3.5 flex flex-col md:flex-row gap-3 items-stretch md:items-center text-left"
    >
      <div className="flex items-center justify-center shrink-0" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={draft.selected}
          onCheckedChange={onToggleSelect}
          className="h-4 w-4 rounded border-glass"
        />
      </div>

      <ReconciliationSideBySide
        className="flex-1"
        leftTitle={draft.existing.ticker}
        leftBadgeText="Livro-Razão"
        leftBadgeVariant="system"
        leftContent={leftContent}
        rightTitle={draft.official.ticker}
        rightBadgeText="B3 Oficial"
        rightBadgeVariant="official"
        rightContent={rightContent}
      />
    </ReconciliationCard>
  )
}
