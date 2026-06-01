import { useMemo } from 'react'
import { Upload, Wand2, AlertCircle } from 'lucide-react'
import Button from '@/components/Button'
import B3ReconciliationGuidance from '@/components/investments/B3ReconciliationGuidance'
import { formatCurrency } from '@/utils/format'
import { portfolioOperationLabel } from '@/utils/portfolioOperations'
import type {
  PositionAdjustmentSuggestion,
  PositionValidationResult,
  PositionValidationRow,
} from '@/utils/investmentExcelReconciliation'

interface B3PositionValidationPanelProps {
  positionFileName: string
  positionParseStatus: string
  positionDragActive: boolean
  positionValidation: PositionValidationResult | null
  adjustments: PositionAdjustmentSuggestion[]
  selectedAdjustmentTickers: Set<string>
  onToggleAdjustment: (ticker: string) => void
  onSelectAllAdjustments: (selected: boolean) => void
  onPositionFileInputRef: (el: HTMLInputElement | null) => void
  onPositionDragEnter: (e: React.DragEvent) => void
  onPositionDragOver: (e: React.DragEvent) => void
  onPositionDragLeave: (e: React.DragEvent) => void
  onPositionDrop: (e: React.DragEvent) => void
  onPositionFileChange: (file: File) => void
  onApplyAdjustments: () => void
  applyingAdjustments: boolean
  showNonEquityNote: boolean
}

const statusLabel = (row: PositionValidationRow): string => {
  if (row.status === 'ok') return 'OK'
  if (row.status === 'ghost_system') return 'Fantasma'
  if (row.status === 'movements_official') return 'Extrato incompleto'
  if (row.status === 'system_official') return 'Ajustar sistema'
  return 'Divergente'
}

export default function B3PositionValidationPanel({
  positionFileName,
  positionParseStatus,
  positionDragActive,
  positionValidation,
  adjustments,
  selectedAdjustmentTickers,
  onToggleAdjustment,
  onSelectAllAdjustments,
  onPositionFileInputRef,
  onPositionDragEnter,
  onPositionDragOver,
  onPositionDragLeave,
  onPositionDrop,
  onPositionFileChange,
  onApplyAdjustments,
  applyingAdjustments,
  showNonEquityNote,
}: B3PositionValidationPanelProps) {
  const selectedCount = useMemo(
    () => adjustments.filter((a) => selectedAdjustmentTickers.has(a.ticker)).length,
    [adjustments, selectedAdjustmentTickers]
  )

  const mismatchRows = useMemo(
    () => positionValidation?.rows.filter((r) => r.status !== 'ok') ?? [],
    [positionValidation]
  )

  return (
    <div className="space-y-3 text-left">
      <div
        onDragEnter={onPositionDragEnter}
        onDragOver={onPositionDragOver}
        onDragLeave={onPositionDragLeave}
        onDrop={onPositionDrop}
        onClick={() => document.getElementById('b3-position-file-input')?.click()}
        className={`border border-dashed rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
          positionDragActive
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-border/50 bg-card/40 hover:border-emerald-500/40'
        }`}
      >
        <input
          id="b3-position-file-input"
          ref={onPositionFileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPositionFileChange(file)
          }}
        />
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Upload size={18} className="text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary truncate">
            {positionFileName || 'Relatório de posição atual (.xlsx)'}
          </p>
          <p className="text-[10px] text-secondary">Exporte em Investimentos → Posição na B3/XP</p>
        </div>
      </div>

      {positionParseStatus && (
        <p className="text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          {positionParseStatus}
        </p>
      )}

      {positionValidation && (
        <>
          {positionValidation.allOk ? (
            <B3ReconciliationGuidance title="Posição conferida" variant="success">
              Custódia B3, movimentações e livro-razão estão alinhados.
            </B3ReconciliationGuidance>
          ) : (
            <B3ReconciliationGuidance title={`${positionValidation.mismatchCount} divergência(s) de cotas`} variant="warning">
              Use o ajuste automático para igualar o livro-razão à posição oficial B3, ou corrija manualmente nos passos anteriores.
            </B3ReconciliationGuidance>
          )}

          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-secondary/40 text-secondary text-[9px] uppercase">
                  <th className="text-left px-3 py-2 font-bold">Ticker</th>
                  <th className="text-right px-3 py-2 font-bold">B3</th>
                  <th className="text-right px-3 py-2 font-bold hidden sm:table-cell">Mov.</th>
                  <th className="text-right px-3 py-2 font-bold">Sistema</th>
                  <th className="text-right px-3 py-2 font-bold">Δ</th>
                  <th className="text-left px-3 py-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono divide-y divide-border/30">
                {positionValidation.rows.map((row) => {
                  const delta = row.official - row.system
                  const isOk = row.status === 'ok'
                  return (
                    <tr key={row.ticker} className={isOk ? '' : 'bg-amber-500/[0.04]'}>
                      <td className="px-3 py-1.5 font-bold text-primary">{row.ticker}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{row.official}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums hidden sm:table-cell">{row.fromMovements}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{row.system}</td>
                      <td
                        className={`px-3 py-1.5 text-right tabular-nums font-bold ${
                          isOk ? 'text-secondary' : delta > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {isOk ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${
                            isOk ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                          }`}
                        >
                          {statusLabel(row)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {adjustments.length > 0 && (
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wand2 size={16} className="text-indigo-500" />
                  <p className="text-xs font-bold text-primary">Ajuste automático (posição B3)</p>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-primary"
                    checked={selectedCount === adjustments.length}
                    onChange={(e) => onSelectAllAdjustments(e.target.checked)}
                  />
                  Selecionar todos
                </label>
              </div>
              <p className="text-[10px] text-secondary leading-relaxed">
                Serão criados lançamentos de compra/venda para igualar o livro-razão à custódia oficial. Preço estimado pelo último negócio do ativo.
              </p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {adjustments.map((adj) => (
                  <li
                    key={adj.ticker}
                    className="flex items-start gap-2 text-[11px] bg-card/80 border border-border/30 rounded-lg px-2.5 py-2"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-primary"
                      checked={selectedAdjustmentTickers.has(adj.ticker)}
                      onChange={() => onToggleAdjustment(adj.ticker)}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-primary">{adj.ticker}</span>
                      <span className="text-secondary"> — {adj.label}</span>
                      <p className="text-[9px] text-secondary mt-0.5">
                        {portfolioOperationLabel(adj.operation_type)} · {adj.quantity} un ·{' '}
                        {formatCurrency(adj.price)} · {adj.date}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={applyingAdjustments || selectedCount === 0}
                onClick={onApplyAdjustments}
                className="w-full sm:w-auto font-bold gap-1.5"
              >
                <Wand2 size={14} />
                {applyingAdjustments
                  ? 'Aplicando...'
                  : `Corrigir ${selectedCount} posição(ões) automaticamente`}
              </Button>
            </div>
          )}

          {mismatchRows.some((r) => r.status === 'movements_official') && (
            <div className="flex gap-2 text-[10px] text-secondary bg-primary/15 rounded-lg px-3 py-2 border border-border/30">
              <AlertCircle size={14} className="shrink-0 text-amber-500 mt-0.5" />
              <span>
                Tickers com &quot;Extrato incompleto&quot;: o livro-razão já bate com a B3, mas o arquivo de movimentação
                não reproduz a posição — reimporte um extrato mais longo.
              </span>
            </div>
          )}
        </>
      )}

      {showNonEquityNote && (
        <p className="text-[10px] text-secondary italic">Tesouro e renda fixa lidos apenas para referência.</p>
      )}
    </div>
  )
}
