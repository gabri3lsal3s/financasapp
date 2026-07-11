import Card from '@/components/Card'
import { formatCurrency } from '@/utils/format'

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
          <span className="text-[10px] uppercase font-bold text-expense/80 tracking-wider">
            A Pagar Pendente
          </span>
          <span className="text-lg font-extrabold text-expense font-mono mt-1">
            {formatCurrency(payables)}
          </span>
        </div>
        <div className="flex flex-col p-3 rounded-xl bg-income/5 border border-income/10">
          <span className="text-[10px] uppercase font-bold text-income/80 tracking-wider">
            A Receber Pendente
          </span>
          <span className="text-lg font-extrabold text-income font-mono mt-1">
            {formatCurrency(receivables)}
          </span>
        </div>
        <div
          className={`flex flex-col p-3 rounded-xl border ${balanceProj >= 0
            ? 'bg-income/5 border-income/10'
            : 'bg-expense/5 border-expense/10'
            }`}
        >
          <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">
            Impacto Projetado no Saldo
          </span>
          <span
            className={`text-lg font-extrabold font-mono mt-1 ${balanceProj >= 0 ? 'text-income' : 'text-expense'
              }`}
          >
            {balanceProj >= 0 ? '+' : ''}
            {formatCurrency(balanceProj)}
          </span>
        </div>
      </div>
    </Card>
  )
}
