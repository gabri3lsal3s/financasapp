import { Calculator, ChevronDown } from 'lucide-react'
import type { PointerEventHandler } from 'react'
import IconButton from '@/components/IconButton'
import CalculatorKeypad, { type CalculatorKeypadProps } from '@/components/calculator/CalculatorKeypad'
import { cn } from '@/lib/utils'
import { Z_INDEX } from '@/constants/zIndex'

interface CalculatorPanelProps extends CalculatorKeypadProps {
  selectedFieldName: string
  displayExpression: string
  displayLastResult: string
  hasError: boolean
  isCompactPanel: boolean
  panelOpenClass: string
  rect: { left: number; top: number; width: number; height: number }
  onMinimize: () => void
  onPanelPointerDown: PointerEventHandler<HTMLDivElement>
}

export default function CalculatorPanel({
  selectedFieldName,
  displayExpression,
  displayLastResult,
  hasError,
  isCompactPanel,
  panelOpenClass,
  rect,
  onMinimize,
  onPanelPointerDown,
  ...keypadProps
}: CalculatorPanelProps) {
  const resultMinHeightClass = isCompactPanel ? 'min-h-[10px]' : 'min-h-[12px]'
  const resultTextClass = isCompactPanel ? 'text-[10px]' : 'text-[11px]'

  return (
    <div
      className={cn(
        `fixed ${Z_INDEX.CALCULATOR} rounded-2xl border border-glass surface-glass-strong p-3 shadow-2xl motion-emphasis overflow-hidden pointer-events-auto calculator-element`,
        panelOpenClass
      )}
      onPointerDown={onPanelPointerDown}
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        touchAction: 'none',
      }}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 select-none">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-primary">Calculadora</h3>
              <p className="text-[10px] text-secondary">Campo: {selectedFieldName}</p>
            </div>
          </div>
          <IconButton
            type="button"
            size="sm"
            icon={<ChevronDown size={20} />}
            onClick={onMinimize}
            label="Minimizar calculadora"
            onPointerDown={(event) => event.stopPropagation()}
            title="Minimizar"
          />
        </div>

        <div className={`w-full rounded-lg border px-3 py-2 text-right ${isCompactPanel ? 'text-base' : 'text-lg'} font-semibold animate-calculator-display ${hasError ? 'border-[var(--ds-color-intent-danger)] text-[var(--ds-color-intent-danger)]' : 'border-primary text-primary'
          }`}>
          {displayExpression}
        </div>

        <div className={`mt-0.5 ${resultMinHeightClass} flex items-center justify-end`}>
          <p className={`${resultTextClass} text-secondary text-right transition-opacity duration-150 ${displayLastResult && !hasError ? 'opacity-100' : 'opacity-0'}`}>
            Resultado: {displayLastResult || '0'}
          </p>
        </div>

        <CalculatorKeypad isCompactPanel={isCompactPanel} {...keypadProps} />
      </div>
    </div>
  )
}
