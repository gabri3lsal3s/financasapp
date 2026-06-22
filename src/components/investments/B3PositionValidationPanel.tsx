import { useMemo } from 'react'
import { Upload, Wand2, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/Button'
import { formatNumberBR } from '@/utils/format'
import B3ReconciliationGuidance from '@/components/investments/B3ReconciliationGuidance'
import B3AdjustmentCard from '@/components/investments/B3AdjustmentCard'
import type {
  PositionAdjustmentSuggestion,
  PositionValidationResult,
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
  detectedManualPositionAssets?: Array<{ ticker: string; quantity: number; type: 'fixed_income' | 'treasury' }>
  /** Quando true, não há extrato de movimentação — oculta coluna Mov. e filtra falsos positivos de "Extrato incompleto" */
  positionOnlyMode?: boolean
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
  detectedManualPositionAssets,
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
        className={cn(
          'modal-upload-zone relative flex flex-col items-center gap-4 overflow-hidden p-5 sm:flex-row',
          positionDragActive && 'modal-upload-zone--active-income',
          !positionDragActive && positionFileName && 'modal-upload-zone--ready-income'
        )}
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
        <div
          className={cn(
            'modal-upload-zone__icon shrink-0',
            positionFileName && 'modal-upload-zone__icon--income'
          )}
        >
          <Upload size={20} className={positionDragActive ? 'animate-bounce' : ''} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-black text-primary truncate tracking-tight">
            {positionFileName ? (
              <span className="text-income font-mono">{positionFileName}</span>
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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-income/40 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-income"></span>
          </span>
        )}
      </div>

      {positionParseStatus && (
        <p className="text-[11px] text-warning bg-warning/5 border border-warning/15 rounded-xl px-4 py-2.5">
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
            <div className="modal-panel-glass space-y-3 border-balance/25 p-4 transition-all duration-300 hover:shadow-lg hover:shadow-balance/5 group">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-balance/15 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-balance/80 animate-pulse" />
                  <p className="text-xs font-black text-primary uppercase tracking-tight">
                    Central de Ajuste Mágico (Custódia B3)
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[10px] font-bold text-secondary cursor-pointer hover:text-primary transition-colors">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-balance/30 bg-primary text-balance focus:ring-balance focus:ring-offset-0 focus:outline-none cursor-pointer"
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
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {adjustments.map((adj) => (
                  <B3AdjustmentCard
                    key={adj.ticker}
                    adj={adj}
                    isChecked={selectedAdjustmentTickers.has(adj.ticker)}
                    onToggle={() => onToggleAdjustment(adj.ticker)}
                  />
                ))}
              </div>
              
              <div className="pt-2 border-t border-balance/10 flex justify-end">
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

          {/* Renda Fixa / Tesouro Manual Alert */}
          {detectedManualPositionAssets && detectedManualPositionAssets.length > 0 && (
            <div className="w-full bg-warning/5 border border-warning/20 rounded-2xl p-4 text-left flex gap-3 items-start animate-page-enter mb-3">
              <AlertCircle size={18} className="text-warning shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-2 w-full">
                <p className="text-xs font-bold text-warning uppercase tracking-tight">
                  Aviso: Custódia de Renda Fixa e Tesouro Direto
                </p>
                <p className="text-[10px] text-secondary leading-relaxed">
                  Os seguintes ativos foram encontrados no relatório de posição, mas <strong>não são ajustados automaticamente</strong> pelo aplicativo. 
                  Adicione ou ajuste-os manualmente no Livro-Razão se necessário:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {detectedManualPositionAssets.map((asset) => (
                    <div key={asset.ticker} className="bg-primary/5 border border-glass/40 rounded-xl p-2.5 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-primary font-mono truncate max-w-[180px]" title={asset.ticker}>{asset.ticker}</span>
                      <span className="text-[10px] font-black text-secondary opacity-80 font-mono tabular-nums">{formatNumberBR(asset.quantity)} un</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
