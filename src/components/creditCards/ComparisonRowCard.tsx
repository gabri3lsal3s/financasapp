import { formatCurrency, formatDate } from '@/utils/format'
import ReconciliationCard from '@/components/reconciliation/ReconciliationCard'
import ReconciliationBadge from '@/components/reconciliation/ReconciliationBadge'
import ReconciliationSideBySide from '@/components/reconciliation/ReconciliationSideBySide'

export interface ComparisonRow {
  key: string
  official: {
    id: string
    date: string
    description: string
    amount: number
    installmentNumber: number | null
    installmentTotal: number | null
    isRefund: boolean
  }
  current: {
    id: string
    date: string
    description?: string | null
    amount: number
    base_amount?: number
    category_id?: string | null
    category_name?: string | null
  } | null
  status: 'conciliado' | 'conflitante' | 'faltando'
}

interface ComparisonRowCardProps {
  row: ComparisonRow
  draft?: boolean
  index: number
}

export default function ComparisonRowCard({ row, draft, index }: ComparisonRowCardProps) {
  const installment =
    row.official.installmentNumber && row.official.installmentTotal
      ? ` • Parcela ${row.official.installmentNumber}/${row.official.installmentTotal}`
      : ''

  const leftContent = (
    <div className="space-y-1">
      <p className="text-sm text-primary mt-1 break-words font-sans">{row.official.description}</p>
      <p className="text-xs text-secondary mt-1 font-mono">
        {formatDate(row.official.date)} • {formatCurrency(Number(row.official.amount || 0))}
        {installment}
      </p>
      {row.official.isRefund && (
        <p className="text-xs text-secondary mt-1 font-mono">Estorno identificado no arquivo oficial.</p>
      )}
    </div>
  )

  const rightContent = (
    <div className="space-y-1">
      {row.current ? (
        <>
          {String(row.current.category_id || '') === '__refund_registered__' && (
            <ReconciliationBadge variant="official" className="mb-1">
              Estorno cadastrado
            </ReconciliationBadge>
          )}
          <p className="text-sm text-primary mt-1 break-words font-sans">
            {row.current.description || row.current.category_name || 'Sem descrição'}
          </p>
          <p className="text-xs text-secondary mt-1 font-mono">
            {formatDate(row.current.date)} • {formatCurrency(Number(row.current.base_amount ?? row.current.amount ?? 0))}
          </p>
        </>
      ) : draft ? (
        <p className="text-xs text-secondary mt-1 italic">
          Não existe item atual correspondente. Use as sugestões de inclusão abaixo.
        </p>
      ) : (
        <p className="text-xs text-secondary mt-1 italic">Não existe item atual correspondente.</p>
      )}
    </div>
  )

  return (
    <ReconciliationCard
      index={index}
      className="p-3 space-y-2 cursor-default"
    >
      <div className="flex items-center justify-between">
        <ReconciliationBadge
          variant={
            row.status === 'conciliado'
              ? 'success'
              : row.status === 'conflitante'
              ? 'conflict'
              : 'missing'
          }
        >
          {row.status}
        </ReconciliationBadge>
        <span className="text-[10px] font-medium text-secondary bg-tertiary px-2 py-0.5 rounded-full border border-glass">
          {formatDate(row.official.date)}
        </span>
      </div>

      <ReconciliationSideBySide
        leftTitle="Fatura oficial"
        leftBadgeText="Oficial"
        leftBadgeVariant="official"
        leftContent={leftContent}
        rightTitle="Item atual"
        rightBadgeText={row.current ? 'Sistema' : undefined}
        rightBadgeVariant="system"
        rightContent={rightContent}
        arrowIcon={false}
      />
    </ReconciliationCard>
  )
}
