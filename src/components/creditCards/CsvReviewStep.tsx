import { formatCurrency } from '@/utils/format'
import type { InvoiceTotals } from '@/utils/creditCardCsvReconciliation'
import ComparisonRowCard from '@/components/creditCards/ComparisonRowCard'
import type { ComparisonRow, MissingDraft } from '@/utils/csvReconciliationUi'

type FilterTab = 'all' | 'missing' | 'conflicts' | 'matched'

interface CsvReviewStepProps {
  comparisonRows: ComparisonRow[]
  filteredRows: ComparisonRow[]
  filterTab: FilterTab
  onFilterTabChange: (tab: FilterTab) => void
  totals: InvoiceTotals | null
  draftByOfficialId: Record<string, MissingDraft>
}

const filterTabs: { id: FilterTab; label: string; color: string }[] = [
  { id: 'all', label: 'Todos', color: 'primary' },
  { id: 'missing', label: 'Faltando', color: 'expense' },
  { id: 'conflicts', label: 'Conflitos', color: 'warning' },
  { id: 'matched', label: 'Conciliados', color: 'income' },
]

export default function CsvReviewStep({
  comparisonRows,
  filteredRows,
  filterTab,
  onFilterTabChange,
  totals,
  draftByOfficialId,
}: CsvReviewStepProps) {
  const countByStatus = (status: ComparisonRow['status']) =>
    comparisonRows.filter((r) => r.status === status).length

  return (
    <div className="space-y-1.5 animate-page-enter">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-primary">
          Fatura oficial x Item atual (ordenado por data)
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-50">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Oficial (Fatura)</p>
          <p className="text-base font-bold text-primary">{formatCurrency(totals?.officialTotal || 0)}</p>
        </div>
        <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-100">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Identificado (Base)</p>
          <p className="text-base font-bold text-primary">{formatCurrency(totals?.identifiedTotal || 0)}</p>
        </div>
        <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-150">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Sugestões</p>
          <p className="text-base font-bold text-primary text-accent">{formatCurrency(totals?.missingTotal || 0)}</p>
        </div>
        <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-200">
          <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Diferença</p>
          <p className={`text-sm font-black ${Math.abs(totals?.difference || 0) < 0.05 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(totals?.difference || 0)}
          </p>
        </div>
      </div>

      {/* Abas de Filtragem Premium */}
      <div className="flex flex-wrap items-center gap-1.5 py-1">
        {filterTabs.map((tab) => {
          const isActive = filterTab === tab.id
          const count = tab.id === 'all'
            ? comparisonRows.length
            : countByStatus(tab.id === 'matched' ? 'conciliado' : tab.id === 'missing' ? 'faltando' : 'conflitante')
          const activeCls =
            tab.id === 'all'
              ? 'bg-primary text-primary-foreground border-transparent'
              : tab.id === 'missing'
              ? 'bg-expense/15 text-expense border border-expense/30'
              : tab.id === 'conflicts'
              ? 'bg-warning/15 text-warning border border-warning/30'
              : 'bg-income/15 text-income border border-income/30'
          const idleCls =
            tab.id === 'all'
              ? 'bg-[var(--glass-layer-interactive)] text-secondary border-glass hover:text-primary hover:bg-[var(--glass-surface-strong)]'
              : tab.id === 'missing'
              ? 'bg-expense/5 text-expense/60 hover:text-expense hover:bg-expense/10'
              : tab.id === 'conflicts'
              ? 'bg-warning/5 text-warning/60 hover:text-warning hover:bg-warning/10'
              : 'bg-income/5 text-income/60 hover:text-income hover:bg-income/10'

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterTabChange(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                isActive ? activeCls : idleCls
              }`}
            >
              {tab.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {filteredRows.map((row, index) => (
          <ComparisonRowCard
            key={row.key}
            row={row}
            draft={Boolean(draftByOfficialId[row.official.id])}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}
