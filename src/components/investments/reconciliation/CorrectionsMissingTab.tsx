import { cn } from '@/lib/utils'
import Button from '@/components/Button'
import Input from '@/components/Input'
import NumberInput from '@/components/NumberInput'
import Select from '@/components/Select'
import B3ReconciliationGuidance from '@/components/investments/B3ReconciliationGuidance'
import { PORTFOLIO_OPERATION_OPTIONS } from '@/utils/portfolioOperations'
import { PORTFOLIO_PRICING_MODE_OPTIONS } from '@/constants/portfolioPricingMode'
import { formatCurrency } from '@/utils/format'
import { Link } from 'lucide-react'
import type { MissingDraft } from '@/hooks/useReconciliationState'
import type { PortfolioOperationType, PortfolioPricingMode } from '@/types'

interface CorrectionsMissingTabProps {
  missingDrafts: MissingDraft[]
  loading: boolean
  selectedMissingCount: number
  existingSystemTickers: string[]
  onUpdateMissingDraft: <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => void
  onImportSelectedMissing: () => void
}

export default function CorrectionsMissingTab({
  missingDrafts,
  loading,
  selectedMissingCount,
  existingSystemTickers,
  onUpdateMissingDraft,
  onImportSelectedMissing,
}: CorrectionsMissingTabProps) {
  return (
    <div className="space-y-3">
      <B3ReconciliationGuidance title="Faltantes — revisão antes de importar" variant="info">
        Confira tipo de operação (compra, venda, desdobro como <strong>cotas creditadas</strong>, grupamento como
        cancelamento de cotas). Desmarque linhas que você registrará manualmente depois.
      </B3ReconciliationGuidance>

      <div className="modal-panel-glass flex flex-col md:flex-row md:items-center justify-between gap-4 text-left p-4 sm:p-5 mb-1.5">
        <div>
          <h5 className="text-xs font-black text-primary uppercase tracking-tight">
            Lançamentos Faltantes no Livro-Razão
          </h5>
          <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
            Movimentações presentes na B3 que ainda não foram inseridas no sistema.{' '}
            <span className="text-warning font-bold">Você pode editar os campos antes de importar!</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end">
          <span className="text-xs text-secondary font-bold">
            {selectedMissingCount} de {missingDrafts.length} selecionados
          </span>
          <Button
            variant="primary"
            size="sm"
            disabled={loading || selectedMissingCount === 0}
            onClick={onImportSelectedMissing}
            className="font-bold shrink-0"
          >
            {loading ? 'Importando...' : 'Importar Selecionados'}
          </Button>
        </div>
      </div>

      <div className="divide-y divide-glass/10 border border-glass/20 rounded-2xl overflow-y-auto max-h-[380px] bg-glass/5 pr-1 scrollbar-thin">
        {missingDrafts.map((draft) => {
          const total = Number(draft.quantity) * Number(draft.price)

          return (
            <div
              key={draft.id}
              className={cn(
                'flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 px-3.5 py-3 text-xs transition-colors hover:bg-glass/10',
                !draft.selected && 'opacity-60',
              )}
            >
              {/* Left: Checkbox + Ticker + Date */}
              <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-glass/30 text-balance accent-balance focus:ring-balance/30 focus:ring-offset-0 focus:outline-none"
                  checked={draft.selected}
                  onChange={(e) => onUpdateMissingDraft(draft.id, 'selected', e.target.checked)}
                />

                <div className="relative flex items-center gap-1.5">
                  {/* Ticker Input */}
                  <div className="w-22">
                    <Input
                      type="text"
                      value={draft.ticker}
                      onChange={(e) => onUpdateMissingDraft(draft.id, 'ticker', e.target.value)}
                      className="h-7 text-[11px] font-black uppercase font-mono px-2 py-0.5 text-primary"
                      placeholder="Ticker"
                    />
                  </div>

                  {existingSystemTickers.length > 0 && (
                    <div className="relative flex items-center justify-center w-4 h-4 text-secondary">
                      <Link size={10} className="pointer-events-none" />
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            onUpdateMissingDraft(draft.id, 'ticker', e.target.value)
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="Vincular a um ativo existente"
                      >
                        <option value="" disabled>
                          Vincular...
                        </option>
                        {existingSystemTickers.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Date Input */}
                <div className="w-28">
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(e) => onUpdateMissingDraft(draft.id, 'date', e.target.value)}
                    className="h-7 text-[11px] font-mono px-2 py-0.5 text-primary"
                  />
                </div>
              </div>

              {/* Middle: Operation Type & Pricing Mode */}
              <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                {/* Operation Type Select */}
                <div className="min-w-[130px]">
                  <Select
                    value={draft.operation_type}
                    onChange={(e) =>
                      onUpdateMissingDraft(draft.id, 'operation_type', e.target.value as PortfolioOperationType)
                    }
                    options={PORTFOLIO_OPERATION_OPTIONS.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                    className="text-[10px] font-black"
                  />
                </div>

                {/* Pricing Mode Select */}
                <div className="min-w-[120px]">
                  <Select
                    value={draft.pricing_mode}
                    onChange={(e) =>
                      onUpdateMissingDraft(draft.id, 'pricing_mode', e.target.value as PortfolioPricingMode)
                    }
                    options={PORTFOLIO_PRICING_MODE_OPTIONS.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                    className="text-[10px] font-bold"
                  />
                </div>
              </div>

              {/* Right: Qty & Price */}
              <div className="flex items-center gap-2 justify-between md:justify-end min-w-[210px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black text-secondary/50 uppercase tracking-wider">Qtd</span>
                  <div className="w-16">
                    <NumberInput
                      step="any"
                      value={draft.quantity}
                      onChange={(e) => onUpdateMissingDraft(draft.id, 'quantity', e.target.value)}
                      className="h-7 text-[11px] font-mono font-bold text-right px-1.5 py-0.5"
                      hideSpinButtons
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black text-secondary/50 uppercase tracking-wider">Preço</span>
                  <div className="w-18">
                    <NumberInput
                      step="any"
                      value={draft.price}
                      onChange={(e) => onUpdateMissingDraft(draft.id, 'price', e.target.value)}
                      className="h-7 text-[11px] font-mono font-bold text-right px-1.5 py-0.5"
                      hideSpinButtons
                    />
                  </div>
                </div>

                <div className="text-right min-w-[85px]">
                  <span className="text-primary font-mono font-black text-[11px] block">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
