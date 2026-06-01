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
  const N = steps.length
  
  // Calculate exact percentage-based offsets for mathematical centering
  const offsetPercent = N > 0 ? 100 / (2 * N) : 0
  const activeWidthPercent = N > 1 ? 100 * (N - 1) / N : 0
  const activeWidth = N > 1 && currentIndex >= 0
    ? (currentIndex / (N - 1)) * activeWidthPercent
    : 0

  return (
    <div className="relative border-b border-border/40 pb-4 mb-2 space-y-3">
      <div className="relative flex items-start justify-between w-full py-1">
        {/* Connector Line Background - Mathematically Centered */}
        <div 
          className="absolute h-[3px] bg-border/20 -z-10 rounded-full top-[20px]"
          style={{ left: `${offsetPercent}%`, right: `${offsetPercent}%` }}
        />
        
        {/* Connector Line Active Progress - Mathematically Centered */}
        <div 
          className="absolute h-[3px] bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 -z-10 rounded-full transition-all duration-500 ease-out top-[20px]"
          style={{ 
            left: `${offsetPercent}%`, 
            width: `${activeWidth}%` 
          }}
        />

        {steps.map((step, index) => {
          const isActive = step.id === currentStepId
          const isDone = currentIndex > index
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick(step.id)}
              className={`flex-1 flex flex-col items-center gap-2 p-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 hover-lift-subtle press-subtle group ${
                isActive
                  ? 'text-primary'
                  : isDone
                    ? 'text-emerald-500'
                    : 'text-secondary hover:text-primary'
              }`}
            >
              {/* Step Circle */}
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 shadow-sm border shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-br from-indigo-500 to-sky-500 text-white border-transparent scale-110 shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/10'
                    : isDone
                      ? 'bg-emerald-500 text-white border-transparent scale-100'
                      : 'bg-card text-secondary border-border/60 group-hover:border-primary/50 group-hover:text-primary'
                }`}
              >
                {isDone ? '✓' : index + 1}
              </span>

              {/* Label and Badge Container */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <span className="whitespace-nowrap tracking-tight transition-colors duration-200 group-hover:text-primary text-center">
                  {step.label}
                </span>
                
                {step.badge !== undefined && step.badge > 0 && (
                  <span
                    className={`min-w-[1.2rem] h-[1.2rem] px-1.5 rounded-full text-[9px] font-black flex items-center justify-center transition-all duration-300 ${
                      isActive 
                        ? 'bg-indigo-500/20 text-indigo-400' 
                        : isDone
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-500'
                    }`}
                  >
                    {step.badge}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {footer}
    </div>
  )
}

