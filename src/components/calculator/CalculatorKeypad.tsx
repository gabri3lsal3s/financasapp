import { ArrowRight, Delete } from 'lucide-react'
import type { KeyboardEventHandler, PointerEventHandler } from 'react'

export interface CalculatorKeypadProps {
  isCompactPanel: boolean
  showScientificButtons: boolean
  showExtendedScientificButtons: boolean
  onAppend: (value: string) => void
  onAppendConstant: (constantValue: number) => void
  onClear: () => void
  onBackspace: () => void
  onEvaluate: () => string | null
  onUnary: (operation: (value: number) => number | null) => void
  onSendResult: () => void
  onResizeHandlePointerDown: PointerEventHandler<HTMLDivElement>
  onResizeHandleKeyDown: KeyboardEventHandler<HTMLDivElement>
}

const KEYPAD_ROWS = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '(', ')', '+'],
]

export default function CalculatorKeypad({
  isCompactPanel,
  showScientificButtons,
  showExtendedScientificButtons,
  onAppend,
  onAppendConstant,
  onClear,
  onBackspace,
  onEvaluate,
  onUnary,
  onSendResult,
  onResizeHandlePointerDown,
  onResizeHandleKeyDown,
}: CalculatorKeypadProps) {
  const keypadGridGapClass = isCompactPanel ? 'gap-1' : 'gap-2'
  const keypadGroupGapClass = isCompactPanel ? 'gap-1' : 'gap-1.5 sm:gap-2'
  const keypadButtonTextClass = isCompactPanel ? 'text-sm' : 'text-base'

  const keypadRowClass = `grid grid-cols-4 ${keypadGridGapClass} flex-1 min-h-0`
  const keypadSingleRowClass = `grid grid-cols-1 ${keypadGridGapClass} flex-1 min-h-0`
  const keypadButtonClass = `h-full min-h-0 rounded-xl flex items-center justify-center bg-secondary text-primary ${keypadButtonTextClass} leading-none font-medium motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] border border-glass hover:bg-accent/50`
  const keypadPrimaryButtonClass = `h-full min-h-0 rounded-xl flex items-center justify-center bg-[var(--color-primary)] text-[var(--color-button-text)] ${keypadButtonTextClass} leading-none font-medium motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] border border-[var(--ds-color-accent-primary)]/25 hover:opacity-90`

  return (
    <div className={`mt-3 flex-1 min-h-0 flex flex-col calculator-keypad ${keypadGroupGapClass}`}>
      <div className={`flex-1 min-h-0 flex flex-col ${keypadGroupGapClass}`}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <div key={`base-row-${rowIndex}`} className={keypadRowClass}>
            {row.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onAppend(value)}
                className={keypadButtonClass}
              >
                {value}
              </button>
            ))}
          </div>
        ))}

        {showScientificButtons && (
          <div className={keypadRowClass}>
            <button
              type="button"
              onClick={() => onUnary((value) => value / 100)}
              className={keypadButtonClass}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => onAppend('^')}
              className={keypadButtonClass}
            >
              xʸ
            </button>
            <button
              type="button"
              onClick={() => onAppendConstant(Math.PI)}
              className={keypadButtonClass}
            >
              π
            </button>
            <button
              type="button"
              onClick={() => onAppendConstant(Math.E)}
              className={keypadButtonClass}
            >
              e
            </button>
          </div>
        )}

        {showExtendedScientificButtons && (
          <div className={keypadRowClass}>
            <button
              type="button"
              onClick={() => onUnary((value) => -value)}
              className={keypadButtonClass}
            >
              +/−
            </button>
            <button
              type="button"
              onClick={() => onUnary((value) => (value === 0 ? null : 1 / value))}
              className={keypadButtonClass}
            >
              1/x
            </button>
            <button
              type="button"
              onClick={() => onUnary((value) => value * value)}
              className={keypadButtonClass}
            >
              x²
            </button>
            <button
              type="button"
              onClick={() => onUnary((value) => (value < 0 ? null : Math.sqrt(value)))}
              className={keypadButtonClass}
            >
              √x
            </button>
          </div>
        )}

        <div className={keypadRowClass}>
          <button
            type="button"
            onClick={onClear}
            className={keypadButtonClass}
          >
            C
          </button>
          <button
            type="button"
            onClick={onBackspace}
            aria-label="Apagar último caractere"
            className={keypadButtonClass}
          >
            <Delete size={16} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => onAppend('.')}
            className={keypadButtonClass}
          >
            .
          </button>
          <button
            type="button"
            onClick={onEvaluate}
            className={keypadPrimaryButtonClass}
          >
            =
          </button>
        </div>

        <div className={keypadSingleRowClass}>
          <button
            type="button"
            onClick={onSendResult}
            aria-label="Enviar resultado para o campo selecionado"
            className={keypadPrimaryButtonClass}
          >
            <ArrowRight size={16} className="mx-auto" />
          </button>
        </div>
      </div>

      <div className="pt-1">
        <div
          role="button"
          tabIndex={0}
          aria-label="Arraste para redimensionar ou toque rápido para resetar"
          onPointerDown={onResizeHandlePointerDown}
          onKeyDown={onResizeHandleKeyDown}
          className="mx-auto mt-1 h-1.5 w-16 rounded-full border border-primary/40 bg-tertiary/90 opacity-95 cursor-ns-resize focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] calculator-handle-idle touch-none"
        />
      </div>
    </div>
  )
}
