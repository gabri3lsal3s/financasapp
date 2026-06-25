import { Check, AlertCircle } from 'lucide-react'
import type { InvestmentReconciliationResult, PositionValidationResult } from '@/utils/investmentExcelReconciliation'
import type { ConflictDraft } from '@/hooks/useReconciliationState'

interface StepReviewProps {
  reconciliation: InvestmentReconciliationResult
  conflictDrafts: ConflictDraft[]
  positionValidation: PositionValidationResult | null
}

export default function StepReview({
  reconciliation,
  conflictDrafts,
  positionValidation,
}: StepReviewProps) {
  return (
    <div className="space-y-5 text-center animate-page-enter max-w-xl mx-auto py-4 text-left">
      {/* Animated Celebration Gauge */}
      <div className="flex flex-col items-center justify-center text-center space-y-3">
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-income to-income/80 text-white flex items-center justify-center shadow-lg shadow-income/20 animate-scale-fade-in scale-105">
          <Check size={32} className="animate-pulse" />
          <span
            className="absolute -inset-2 rounded-full border border-income/20 animate-ping opacity-60"
            style={{ animationDuration: '3s' }}
          />
        </div>

        <div className="space-y-1">
          <h4 className="text-base font-black text-primary uppercase tracking-tight">Conciliação Concluída!</h4>
          <p className="text-xs text-secondary max-w-xs mx-auto leading-relaxed">
            {positionValidation?.allOk
              ? 'Excelente! Seu Livro-Razão está 100% auditado e sincronizado com os dados oficiais da B3.'
              : 'Processo de auditoria contábil finalizado com sucesso.'}
          </p>
        </div>
      </div>

      {/* Financial Receipt Summary */}
      <div className="modal-panel-glass relative overflow-hidden rounded-3xl p-5 space-y-4 group">
        <h5 className="font-black text-xs text-primary uppercase tracking-widest border-b modal-section-divider pb-2 flex items-center justify-between">
          <span>Relatório Consolidado de Auditoria</span>
          <span className="text-[9px] font-mono text-secondary opacity-60">
            Hash: {crypto.randomUUID().slice(0, 8).toUpperCase()}
          </span>
        </h5>

        <div className="space-y-2.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-secondary opacity-70 uppercase text-[10px]">Total de Lançamentos Analisados:</span>
            <span className="font-bold text-primary">
              {reconciliation.matched.length + reconciliation.conflicts.length + reconciliation.missing.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary opacity-70 uppercase text-[10px]">Lançamentos Conciliados (OK):</span>
            <span className="font-bold text-income">
              {reconciliation.matched.length + conflictDrafts.filter((c) => c.applied).length}
            </span>
          </div>
          {positionValidation && (
            <div className="flex justify-between border-t modal-section-divider pt-2.5">
              <span className="text-secondary opacity-70 uppercase text-[10px]">Auditoria de Custódia:</span>
              <span
                className={`font-black flex items-center gap-1 uppercase text-[10px] ${
                  positionValidation.allOk ? 'text-income' : 'text-warning'
                }`}
              >
                {positionValidation.allOk ? (
                  <>
                    <Check size={13} /> Sem Divergências
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} /> {positionValidation.mismatchCount} Diferença(s)
                  </>
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-balance/15 pt-3 font-sans font-black text-[13px] text-primary mt-3">
            <span>Auditoria Geral:</span>
            <span
              className={`flex items-center gap-1 uppercase tracking-tight ${
                positionValidation?.allOk !== false ? 'text-income' : 'text-warning'
              }`}
            >
              {positionValidation?.allOk !== false ? 'Totalmente Sincronizado' : 'Concluído com Ressalvas'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
