import { useMemo } from 'react'
import { Upload, Wand2, AlertCircle, Sparkles } from 'lucide-react'
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
  /** Quando true, não há extrato de movimentação — oculta coluna Mov. e filtra falsos positivos de "Extrato incompleto" */
  positionOnlyMode?: boolean
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
  positionOnlyMode = false,
}: B3PositionValidationPanelProps) {
  const selectedCount = useMemo(
    () => adjustments.filter((a) => selectedAdjustmentTickers.has(a.ticker)).length,
    [adjustments, selectedAdjustmentTickers]
  )

  const visibleRows = useMemo(
    () =>
      positionOnlyMode
        ? (positionValidation?.rows.filter((r) => r.status !== 'movements_official') ?? [])
        : (positionValidation?.rows ?? []),
    [positionValidation, positionOnlyMode]
  )

  const mismatchRows = useMemo(
    () => visibleRows.filter((r) => r.status !== 'ok'),
    [visibleRows]
  )

  return (
    <div className="space-y-4 text-left animate-page-enter">
      {/* Visual File Dropzone Panel */}
      <div
        onDragEnter={onPositionDragEnter}
        onDragOver={onPositionDragOver}
        onDragLeave={onPositionDragLeave}
        onDrop={onPositionDrop}
        onClick={() => document.getElementById('b3-position-file-input')?.click()}
        className={`relative overflow-hidden border border-dashed rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 cursor-pointer backdrop-blur-md transition-all duration-300 ${
          positionDragActive
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01] shadow-lg shadow-emerald-500/5'
            : positionFileName
              ? 'border-emerald-500/30 bg-emerald-500/[0.02] hover:border-emerald-500/50 hover:bg-emerald-500/5'
              : 'border-primary/30 bg-primary/20 hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]'
        } group`}
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
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
          positionFileName ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/30 text-secondary'
        } group-hover:scale-105`}>
          <Upload size={20} className={positionDragActive ? 'animate-bounce' : ''} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-black text-primary truncate tracking-tight">
            {positionFileName ? (
              <span className="text-emerald-500 font-mono">{positionFileName}</span>
            ) : (
              'Planilha de Posição de Custódia Oficial (.xlsx)'
            )}
          </p>
          <p className="text-[10px] text-secondary mt-0.5">
            {positionFileName 
              ? 'Clique ou arraste outro arquivo para atualizar a validação' 
              : 'Exporte na área logada da B3 (Investimentos → Posição) ou XP.'}
          </p>
        </div>
        {positionFileName && (
          <span className="absolute top-2 right-2 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
      </div>

      {positionParseStatus && (
        <p className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5">
          {positionParseStatus}
        </p>
      )}

      {positionValidation && (
        <>
          {mismatchRows.length === 0 ? (
            <B3ReconciliationGuidance title="Custódia Auditada e Sincronizada!" variant="success">
              {positionOnlyMode
                ? 'Todas as cotas do Livro-Razão coincidem perfeitamente com a custódia oficial B3.'
                : 'A custódia B3, as movimentações e o livro-razão estão em perfeita harmonia.'}
            </B3ReconciliationGuidance>
          ) : (
            <B3ReconciliationGuidance title={`${mismatchRows.length} discrepância(s) de posição detectada(s)`} variant="warning">
              Há diferenças entre a custódia oficial da B3 e as posições registradas no Livro-Razão. Aplique o ajuste automático abaixo para regularizar.
            </B3ReconciliationGuidance>
          )}

          {/* Magical Automatic Adjustments Panel */}
          {adjustments.length > 0 && (
            <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.03] backdrop-blur-md p-4 space-y-3 hover:shadow-lg hover:shadow-indigo-500/5 group transition-all duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-500/15 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                  <p className="text-xs font-black text-primary uppercase tracking-tight">
                    Central de Ajuste Mágico (Custódia B3)
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-secondary cursor-pointer hover:text-primary transition-colors">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-indigo-500/30 bg-primary text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:outline-none cursor-pointer"
                    checked={selectedCount === adjustments.length}
                    onChange={(e) => onSelectAllAdjustments(e.target.checked)}
                  />
                  Selecionar Todos os Ajustes
                </label>
              </div>
              
              <p className="text-[10px] text-secondary leading-relaxed">
                Recomendamos efetuar os lançamentos abaixo para sincronizar seu livro-razão com a custódia B3 de forma instantânea. 
                Os preços unitários foram obtidos da planilha de posição ou da última cotação conhecida.
              </p>
              
              <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {adjustments.map((adj) => {
                  const isChecked = selectedAdjustmentTickers.has(adj.ticker)
                  return (
                    <li
                      key={adj.ticker}
                      onClick={() => onToggleAdjustment(adj.ticker)}
                      className={`flex items-start gap-3 text-[11px] border rounded-xl px-3.5 py-2.5 cursor-pointer transition-all duration-200 ${
                        isChecked
                          ? 'border-indigo-500/30 bg-indigo-500/[0.04] shadow-sm'
                          : 'border-border/30 bg-card/40 hover:border-indigo-500/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 rounded border-primary bg-primary text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:outline-none cursor-pointer shrink-0"
                        checked={isChecked}
                        readOnly
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-primary text-xs">{adj.ticker}</span>
                          <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                            adj.operation_type === 'buy' 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10'
                              : 'bg-red-500/10 text-red-500 border border-red-500/10'
                          }`}>
                            {adj.operation_type === 'buy' ? 'Aporte de Ajuste' : 'Retirada de Ajuste'}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-secondary mt-1 font-mono">
                          {portfolioOperationLabel(adj.operation_type)} de <strong className="text-primary font-bold">{adj.quantity}</strong> un a <strong className="text-primary font-bold">{formatCurrency(adj.price)}</strong> em <span className="underline">{adj.date}</span>.
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              
              <div className="pt-2 border-t border-indigo-500/10 flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={applyingAdjustments || selectedCount === 0}
                  onClick={onApplyAdjustments}
                  className="w-full sm:w-auto font-bold gap-1.5 group-hover:scale-102"
                >
                  <Wand2 size={13} className="group-hover:rotate-12 transition-transform duration-300" />
                  {applyingAdjustments
                    ? 'Auditando e gravando...'
                    : `Aplicar ${selectedCount} Ajuste(s) Automático(s)`}
                </Button>
              </div>
            </div>
          )}

          {/* Premium Audit Grid */}
          {showNonEquityNote && (
            <div className="flex gap-2.5 text-[10px] text-secondary bg-primary/10 rounded-xl px-4 py-2.5 border border-border/30 items-center mb-1 animate-page-enter">
              <AlertCircle size={14} className="shrink-0 text-indigo-500" />
              <span className="leading-normal">
                Ativos de <strong>Renda Fixa e Tesouro Direto</strong> lidos apenas para mapeamento cadastral e rentabilidade.
              </span>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/20 backdrop-blur-md shadow-sm">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-secondary/40 text-secondary text-[9px] uppercase tracking-wider border-b border-border/30">
                  <th className="text-left px-4 py-3 font-extrabold">Ativo / Ticker</th>
                  <th className="text-right px-4 py-3 font-extrabold">Custódia B3</th>
                  {!positionOnlyMode && (
                    <th className="text-right px-4 py-3 font-extrabold hidden sm:table-cell">Histórico Mov.</th>
                  )}
                  <th className="text-right px-4 py-3 font-extrabold">Livro-Razão</th>
                  <th className="text-right px-4 py-3 font-extrabold">Desvio ($\Delta$)</th>
                  <th className="text-left px-4 py-3 font-extrabold">Parecer</th>
                </tr>
              </thead>
              <tbody className="font-mono divide-y divide-border/20">
                {visibleRows.map((row) => {
                  const delta = row.official - row.system
                  const isOk = row.status === 'ok'
                  return (
                    <tr 
                      key={row.ticker} 
                      className={`transition-colors duration-200 hover:bg-primary/5 ${
                        isOk ? '' : 'bg-amber-500/[0.02]'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-bold text-primary text-xs tracking-wide">
                        {row.ticker}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary tabular-nums">
                        {row.official}
                      </td>
                      {!positionOnlyMode && (
                        <td className="px-4 py-2.5 text-right text-secondary/80 tabular-nums hidden sm:table-cell">
                          {row.fromMovements}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right font-bold text-primary tabular-nums">
                        {row.system}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-black ${
                          isOk ? 'text-secondary/60' : delta > 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {isOk ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider whitespace-nowrap ${
                            isOk 
                              ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/10' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/10'
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

          {!positionOnlyMode && mismatchRows.some((r) => r.status === 'movements_official') && (
            <div className="flex gap-2.5 text-[10px] text-secondary bg-primary/10 rounded-xl px-4 py-3 border border-border/30 items-start">
              <AlertCircle size={15} className="shrink-0 text-amber-500 mt-0.5 animate-pulse" />
              <span className="leading-relaxed">
                <strong>Observação de Auditoria:</strong> Alguns ativos exibem a marcação &quot;Extrato incompleto&quot;. Isso indica que as quantidades finais no livro-razão coincidem com a B3, mas a planilha de movimentações carregada não possui histórico suficiente para justificar a evolução do saldo.
              </span>
            </div>
          )}
        </>
      )}

    </div>
  )
}
