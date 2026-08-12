import Button from '@/components/Button'
import { REVIEW_STEPS, type ReconciliationWizardStep } from '@/utils/csvReconciliationUi'

interface CsvStepFooterProps {
  currentStep: ReconciliationWizardStep
  onNavigate: (step: ReconciliationWizardStep) => void
}

export default function CsvStepFooter({ currentStep, onNavigate }: CsvStepFooterProps) {
  const currentIdx = REVIEW_STEPS.indexOf(currentStep)
  const isFirst = currentIdx <= 0
  const isLast = currentStep === 'review'

  return (
    <div className="flex items-center justify-between border-t border-glass pt-4 mt-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          if (currentIdx > 0) onNavigate(REVIEW_STEPS[currentIdx - 1])
        }}
        disabled={isFirst}
        className="text-secondary hover:text-primary"
      >
        ← Voltar
      </Button>

      <div className="flex gap-2">
        {!isLast ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (currentIdx < REVIEW_STEPS.length - 1) onNavigate(REVIEW_STEPS[currentIdx + 1])
            }}
          >
            Pular / Avançar →
          </Button>
        ) : (
          <div className="text-xs font-semibold text-income flex items-center gap-1 bg-income/10 px-3 py-1.5 rounded-lg border border-income/20 font-sans">
            ✓ Pronto para Fechar
          </div>
        )}
      </div>
    </div>
  )
}
