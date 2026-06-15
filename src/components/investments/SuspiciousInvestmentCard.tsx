import Button from '@/components/Button'
import { formatCurrency } from '@/utils/format'
import ReconciliationCard from '@/components/reconciliation/ReconciliationCard'
import ReconciliationBadge from '@/components/reconciliation/ReconciliationBadge'
import type { PortfolioTransaction } from '@/types'

interface SuspiciousInvestmentCardProps {
  tx: PortfolioTransaction
  onDelete: () => void
}

export default function SuspiciousInvestmentCard({ tx, onDelete }: SuspiciousInvestmentCardProps) {
  return (
    <ReconciliationCard
      selected
      variant="expense"
      className="p-3 flex items-center justify-between text-xs cursor-default"
    >
      <div className="text-left space-y-1">
        <div className="flex items-center gap-2">
          <strong className="text-primary font-bold font-mono">{tx.ticker}</strong>
          <ReconciliationBadge variant="system">
            Exclusivo do Sistema
          </ReconciliationBadge>
        </div>
        <div className="text-[10px] text-secondary mt-1 font-mono">
          <span>Data: <strong>{tx.date}</strong></span>
          <span className="mx-2">•</span>
          <span>Qtd: <strong>{tx.quantity}</strong></span>
          <span className="mx-2">•</span>
          <span>Preço: <strong>{formatCurrency(tx.price)}</strong></span>
        </div>
      </div>
      <Button
        size="sm"
        variant="danger"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="px-3 text-xs font-semibold"
      >
        Excluir Lançamento
      </Button>
    </ReconciliationCard>
  )
}
