import Card from '@/components/Card'
import { Eyebrow } from '@/components/ui/eyebrow'
import AmountText from '@/components/ui/amount-text'

interface ReportPendingDebtsWidgetProps {
  payables: number
  receivables: number
  balanceProj: number
  count: number
  periodLabel: string
}

export default function ReportPendingDebtsWidget({
  payables,
  receivables,
  balanceProj,
  count,
  periodLabel,
}: ReportPendingDebtsWidgetProps) {
  if (count === 0) return null

  return (
    <Card className="border border-glass surface-glass shadow-sm transition-all duration-300 p-4 sm:p-5">
      <div className="flex items-center gap-3 border-b border-glass/40 pb-3 mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
            Projeção de Pendências
          </h3>
          <p className="text-[10px] text-secondary mt-0.5">
            Valores em aberto com vencimento em {periodLabel}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col p-3 rounded-xl bg-expense/5 border border-expense/10">
          <Eyebrow tone="expense">
            A Pagar Pendente
          </Eyebrow>
          <AmountText value={payables} size="lg" weight="extrabold" tone="expense" className="mt-1 block" />
        </div>
        <div className="flex flex-col p-3 rounded-xl bg-income/5 border border-income/10">
          <Eyebrow tone="income">
            A Receber Pendente
          </Eyebrow>
          <AmountText value={receivables} size="lg" weight="extrabold" tone="income" className="mt-1 block" />
        </div>
        <div
          className={`flex flex-col p-3 rounded-xl border ${balanceProj >= 0
            ? 'bg-income/5 border-income/10'
            : 'bg-expense/5 border-expense/10'
            }`}
        >
          <Eyebrow>
            Impacto Projetado no Saldo
          </Eyebrow>
          <AmountText
            value={balanceProj}
            size="lg"
            weight="extrabold"
            tone={balanceProj >= 0 ? 'income' : 'expense'}
            forceSign
            className="mt-1 block"
          />
        </div>
      </div>
    </Card>
  )
}
