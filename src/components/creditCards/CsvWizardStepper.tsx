import { Check } from 'lucide-react'
import { REVIEW_STEPS, type ReconciliationWizardStep } from '@/utils/csvReconciliationUi'

interface CsvWizardStepperProps {
  currentStep: ReconciliationWizardStep
  conflictCount: number
  missingCount: number
  suspiciousCount: number
  onStepChange: (step: ReconciliationWizardStep) => void
}

export default function CsvWizardStepper({
  currentStep,
  conflictCount,
  missingCount,
  suspiciousCount,
  onStepChange,
}: CsvWizardStepperProps) {
  const steps = [
    { id: 'summary' as const, label: 'Resumo', count: undefined as number | undefined },
    { id: 'conflicts' as const, label: 'Conflitos', count: conflictCount },
    { id: 'missing' as const, label: 'Faltando', count: missingCount },
    { id: 'suspicious' as const, label: 'Alertas', count: suspiciousCount },
    { id: 'review' as const, label: 'Revisão Final', count: undefined as number | undefined },
  ]

  return (
    <div className="flex flex-col gap-2 border-b border-glass pb-4 mb-2">
      <div className="flex items-center justify-between overflow-x-auto gap-2 pb-1.5 scrollbar-none">
        {steps.map((stepItem, index) => {
          const isActive = currentStep === stepItem.id
          const currentIdx = REVIEW_STEPS.indexOf(currentStep)
          const itemIdx = REVIEW_STEPS.indexOf(stepItem.id)
          const isCompleted = itemIdx < currentIdx

          return (
            <button
              key={stepItem.id}
              type="button"
              onClick={() => onStepChange(stepItem.id)}
              className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
                isActive
                  ? 'bg-secondary text-primary border-primary'
                  : isCompleted
                  ? 'bg-income/10 text-income border-income/20 hover:bg-income/20'
                  : 'bg-primary/10 text-secondary border-transparent hover:bg-primary/20 hover:text-primary'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                isActive ? 'bg-primary text-secondary' : isCompleted ? 'bg-income text-white' : 'bg-secondary text-secondary border border-primary'
              }`}>
                {isCompleted ? <Check size={10} className="inline-block" /> : index + 1}
              </span>
              <span>{stepItem.label}</span>
              {stepItem.count !== undefined && stepItem.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  isActive ? 'bg-primary text-secondary' : 'bg-secondary text-secondary'
                }`}>
                  {stepItem.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
