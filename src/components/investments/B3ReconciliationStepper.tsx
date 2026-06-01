import type { ReactNode } from 'react'

export interface B3WizardStep {
  id: string
  label: string
  badge?: number
}

interface B3ReconciliationStepperProps {
  steps: B3WizardStep[]
  currentStepId: string
  onStepClick: (stepId: string) => void
  footer?: ReactNode
}

export default function B3ReconciliationStepper({
  steps,
  currentStepId,
  onStepClick,
  footer,
}: B3ReconciliationStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId)

  return (
    <div className="border-b border-border/50 pb-3 mb-1 space-y-2">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId
          const isDone = currentIndex > index
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick(step.id)}
              className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-secondary'
                  : isDone
                    ? 'text-emerald-600 hover:bg-emerald-500/10'
                    : 'text-secondary hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                  isActive
                    ? 'bg-secondary text-primary'
                    : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'border border-border/60 text-secondary'
                }`}
              >
                {isDone ? '✓' : index + 1}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
              {step.badge !== undefined && step.badge > 0 && (
                <span
                  className={`min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                    isActive ? 'bg-secondary/20 text-secondary' : 'bg-amber-500/15 text-amber-600'
                  }`}
                >
                  {step.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {footer}
    </div>
  )
}
