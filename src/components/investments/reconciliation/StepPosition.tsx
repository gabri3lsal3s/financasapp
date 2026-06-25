import { AlertCircle, ShieldCheck } from 'lucide-react'
import B3PositionValidationPanel from '@/components/investments/B3PositionValidationPanel'
import { formatQuantityBR } from '@/utils/format'
import type { PositionValidationResult, PositionAdjustmentSuggestion } from '@/utils/investmentExcelReconciliation'

interface StepPositionProps {
  positionFileName: string
  positionParseStatus: string
  positionDragActive: boolean
  positionValidation: PositionValidationResult | null
  positionAdjustments: PositionAdjustmentSuggestion[]
  selectedAdjustmentTickers: Set<string>
  nonB3SystemPositions: Record<string, number>
  detectedManualPositionAssets: Array<{ ticker: string; quantity: number; type: 'fixed_income' | 'treasury' }>
  positionOnlyMode: boolean
  loading: boolean
  onToggleAdjustment: (ticker: string) => void
  onSelectAllAdjustments: (selected: boolean) => void
  onApplyAdjustments: () => void
  onPositionFileChange: (file: File) => void
  onPositionDrop: (e: React.DragEvent) => void
  onPositionDragEnter: (e: React.DragEvent) => void
  onPositionDragOver: (e: React.DragEvent) => void
  onPositionDragLeave: (e: React.DragEvent) => void
  onPositionFileInputRef: (el: HTMLInputElement | null) => void
}

export default function StepPosition({
  positionFileName,
  positionParseStatus,
  positionDragActive,
  positionValidation,
  positionAdjustments,
  selectedAdjustmentTickers,
  nonB3SystemPositions,
  detectedManualPositionAssets,
  positionOnlyMode,
  loading,
  onToggleAdjustment,
  onSelectAllAdjustments,
  onApplyAdjustments,
  onPositionFileChange,
  onPositionDrop,
  onPositionDragEnter,
  onPositionDragOver,
  onPositionDragLeave,
  onPositionFileInputRef,
}: StepPositionProps) {
  return (
    <div className="space-y-3 animate-page-enter">
      {/* Banner: ativos fora do padrão B3 */}
      {Object.keys(nonB3SystemPositions).length > 0 && (
        <div className="flex gap-3 items-start bg-balance/8 border border-balance/25 rounded-2xl px-3.5 py-3 text-left">
          <div className="w-7 h-7 rounded-lg bg-balance/15 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle size={14} className="text-balance" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <p className="text-xs font-bold text-primary">
              {Object.keys(nonB3SystemPositions).length} ativo
              {Object.keys(nonB3SystemPositions).length > 1 ? 's' : ''} internacional/cripto não constam na custódia B3
            </p>
            <p className="text-[10px] text-secondary leading-relaxed">
              Os ativos abaixo estão cadastrados no livro-razão mas não aparecem no arquivo de posição B3, pois são
              negociados em bolsas estrangeiras ou fora da B3. Verifique manualmente se as quantidades estão corretas.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {Object.entries(nonB3SystemPositions)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([ticker, qty]) => (
                  <span
                    key={ticker}
                    className="inline-flex items-center gap-1 bg-balance/10 border border-balance/20 rounded-lg px-2 py-0.5 text-[10px] font-mono"
                  >
                    <span className="font-bold text-balance">{ticker}</span>
                    <span className="text-secondary">{formatQuantityBR(qty)} un</span>
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <ShieldCheck size={18} className="text-income" />
        <h5 className="text-sm font-black text-primary">Posição oficial B3</h5>
      </div>

      <B3PositionValidationPanel
        positionFileName={positionFileName}
        positionParseStatus={positionParseStatus}
        positionDragActive={positionDragActive}
        positionValidation={positionValidation}
        adjustments={positionAdjustments}
        selectedAdjustmentTickers={selectedAdjustmentTickers}
        onToggleAdjustment={onToggleAdjustment}
        onSelectAllAdjustments={onSelectAllAdjustments}
        onPositionFileInputRef={onPositionFileInputRef}
        onPositionDragEnter={onPositionDragEnter}
        onPositionDragOver={onPositionDragOver}
        onPositionDragLeave={onPositionDragLeave}
        onPositionDrop={onPositionDrop}
        onPositionFileChange={onPositionFileChange}
        onApplyAdjustments={onApplyAdjustments}
        applyingAdjustments={loading}
        positionOnlyMode={positionOnlyMode}
        detectedManualPositionAssets={detectedManualPositionAssets}
      />
    </div>
  )
}
