import { AlertTriangle, FileCheck } from 'lucide-react'
import Button from '@/components/Button'
import ReconciliationKpiGrid from '@/components/creditCards/ReconciliationKpiGrid'
import type { ReconciliationResult } from '@/utils/creditCardCsvReconciliation'

interface CsvSummaryStepProps {
  card: { name: string }
  currentMonth: string
  reconciliation: ReconciliationResult
  suspiciousCount: number
  competenceMismatch: {
    csvCompetence: string
    relation: 'anterior' | 'posterior'
  } | null
  onStart: () => void
}

export default function CsvSummaryStep({
  card,
  currentMonth,
  reconciliation,
  suspiciousCount,
  competenceMismatch,
  onStart,
}: CsvSummaryStepProps) {
  const hasNextStep =
    reconciliation.conflicts.length > 0 ||
    reconciliation.missing.length > 0 ||
    suspiciousCount > 0

  return (
    <div className="modal-panel-glass border-glass rounded-2xl p-6 space-y-4 text-center animate-page-enter shadow-lg">
      <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--glass-layer-panel))] flex items-center justify-center mx-auto text-primary border border-[color-mix(in_srgb,var(--color-primary)_24%,var(--glass-border))] shadow-inner">
        <FileCheck size={24} className="text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-primary">Arquivo CSV Importado com Sucesso!</h3>
        <p className="text-xs text-secondary max-w-sm mx-auto leading-relaxed">
          Analisamos a fatura de <strong>{currentMonth}</strong> do cartão <strong>{card.name}</strong> e identificamos o seguinte diagnóstico:
        </p>
      </div>

      <ReconciliationKpiGrid
        items={[
          { label: 'Conciliados', value: reconciliation.matched.length, tone: 'income' },
          { label: 'Faltando', value: reconciliation.missing.length, tone: 'expense' },
          { label: 'Conflitos', value: reconciliation.conflicts.length, tone: 'warning' },
        ]}
      />

      {competenceMismatch && (
        <div className="bg-[color-mix(in_srgb,var(--color-warning)_8%,var(--glass-layer-panel))] border border-[color-mix(in_srgb,var(--color-warning)_25%,var(--glass-border))] p-4 rounded-2xl max-w-md mx-auto text-left flex gap-3 items-start shadow-sm">
          <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black text-warning uppercase tracking-wider">Aviso de Fatura Incorreta</p>
            <p className="text-[11px] text-secondary leading-relaxed">
              A planilha adicionada é referente à fatura de <strong className="text-primary font-bold">{competenceMismatch.csvCompetence}</strong>, mas você selecionou a fatura de <strong className="text-primary font-bold">{currentMonth}</strong> ({competenceMismatch.relation} à planilha).
            </p>
          </div>
        </div>
      )}

      {suspiciousCount > 0 && (
        <div className="bg-[color-mix(in_srgb,var(--color-warning)_6%,var(--glass-layer-panel))] border border-[color-mix(in_srgb,var(--color-warning)_20%,var(--glass-border))] p-3.5 rounded-2xl max-w-md mx-auto shadow-sm">
          <p className="text-xs text-warning leading-normal font-bold">
            <AlertTriangle size={14} className="inline-block align-text-top mr-1 text-warning" /> Identificamos {suspiciousCount} lançamentos no sistema que não constam no arquivo oficial.
          </p>
        </div>
      )}

      <div className="pt-2">
        <Button type="button" variant="primary" className="px-6" onClick={onStart}>
          {hasNextStep ? 'Iniciar Conciliação Guiada' : 'Ir para Revisão Final'}
        </Button>
      </div>
    </div>
  )
}
