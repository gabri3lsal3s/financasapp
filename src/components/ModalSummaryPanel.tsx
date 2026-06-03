import { cn } from '@/lib/utils'

export type ModalSummaryIntent = 'balance' | 'income' | 'neutral'

export interface ModalSummaryRow {
  label: string
  value: string
  valueClassName?: string
}

interface ModalSummaryPanelProps {
  title: string
  intent?: ModalSummaryIntent
  rows: ModalSummaryRow[]
  total?: ModalSummaryRow
  note?: string
  className?: string
}

/** Painel L2 de resumo financeiro dentro de modais (ex.: cálculo de aporte). */
export default function ModalSummaryPanel({
  title,
  intent = 'balance',
  rows,
  total,
  note,
  className,
}: ModalSummaryPanelProps) {
  return (
    <div
      className={cn(
        'modal-summary-panel animate-page-enter',
        `modal-summary-panel--${intent}`,
        className
      )}
    >
      <h5 className="modal-summary-panel__title">{title}</h5>
      <div className="modal-summary-panel__rows">
        {rows.map((row) => (
          <div key={row.label} className="modal-summary-panel__row">
            <span>{row.label}</span>
            <span className={cn('font-bold text-primary', row.valueClassName)}>{row.value}</span>
          </div>
        ))}
        {total ? (
          <>
            <div className="modal-summary-panel__divider" aria-hidden />
            <div className="modal-summary-panel__row modal-summary-panel__total">
              <span>{total.label}</span>
              <span className={cn(total.valueClassName ?? 'text-income')}>{total.value}</span>
            </div>
          </>
        ) : null}
      </div>
      {note ? <p className="modal-summary-panel__note">{note}</p> : null}
    </div>
  )
}
