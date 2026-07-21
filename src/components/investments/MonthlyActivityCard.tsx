import { useMemo } from 'react'
import Card from '@/components/Card'
import { formatCurrency, formatMonth } from '@/utils/format'
import type { PortfolioTransaction } from '@/types'
import { isPortfolioIncomeType } from '@/utils/portfolioOperations'
import { isCashTicker } from '@/utils/assetClassifier'
import { transactionInvestmentAmount } from '@/utils/portfolioMonthlyFlow'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MonthlyActivityCardProps {
  transactions: PortfolioTransaction[]
  monthNavDate: string
  onPrevMonth: () => void
  onNextMonth: () => void
  canNavNext: boolean
  cashValue?: number
}

export default function MonthlyActivityCard({
  transactions,
  monthNavDate,
  onPrevMonth,
  onNextMonth,
  canNavNext,
  cashValue = 0
}: MonthlyActivityCardProps) {
  const summary = useMemo(() => {
    let monthInvested = 0
    let monthWithdrawn = 0
    let monthIncome = 0

    for (const tx of transactions) {
      if (!tx.date || tx.date.slice(0, 7) !== monthNavDate) continue
      if (isCashTicker(tx.ticker)) continue

      const flow = transactionInvestmentAmount(
        tx.operation_type,
        Number(tx.quantity),
        Number(tx.price)
      )

      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        monthInvested += Math.abs(flow)
      } else if (tx.operation_type === 'sell') {
        monthWithdrawn += Math.abs(flow)
      } else if (isPortfolioIncomeType(tx.operation_type)) {
        monthIncome += Math.abs(flow)
      }
    }

    const netFlow = monthInvested - monthWithdrawn
    const hasActivity = monthInvested > 0 || monthWithdrawn > 0 || monthIncome > 0

    return { monthInvested, monthWithdrawn, monthIncome, netFlow, hasActivity }
  }, [transactions, monthNavDate])

  return (
    <Card className="w-full border border-glass bg-glass/5 rounded-3xl p-4 lg:p-5 flex flex-col gap-3 text-left">
      {/* Header com navegação e caixa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-glass/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-secondary tracking-wider">
            Atividade Mensal
          </span>
          <span className="text-[10px] text-secondary font-medium">|</span>
          <span className="text-[10px] font-bold text-primary font-mono">
            Caixa em Custódia: <span className="text-income font-black">{formatCurrency(cashValue)}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            onClick={onPrevMonth}
            className="w-6 h-6 rounded-lg flex items-center justify-center border border-glass/30 hover:bg-glass/10 transition-all text-secondary"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="text-[10px] font-black text-primary font-mono min-w-[72px] text-center select-none">
            {formatMonth(monthNavDate)}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={!canNavNext}
            className="w-6 h-6 rounded-lg flex items-center justify-center border border-glass/30 hover:bg-glass/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-secondary"
            aria-label="Próximo mês"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {!summary.hasActivity ? (
        <p className="text-[10px] text-secondary font-medium py-1">
          Nenhuma movimentação de investimentos neste mês.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 rounded-xl border border-glass/30 bg-glass/5">
            <span className="text-[8px] font-bold text-secondary uppercase tracking-wider block leading-tight">
              Investido
            </span>
            <span className="text-xs font-black text-primary font-mono block mt-0.5">
              {formatCurrency(summary.monthInvested)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-glass/30 bg-glass/5">
            <span className="text-[8px] font-bold text-secondary uppercase tracking-wider block leading-tight">
              Retirado
            </span>
            <span className="text-xs font-black text-primary font-mono block mt-0.5">
              {formatCurrency(summary.monthWithdrawn)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-glass/30 bg-glass/5">
            <span className="text-[8px] font-bold text-secondary uppercase tracking-wider block leading-tight">
              Proventos
            </span>
            <span className="text-xs font-black text-income font-mono block mt-0.5">
              {formatCurrency(summary.monthIncome)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-glass/30 bg-glass/5">
            <span className="text-[8px] font-bold text-secondary uppercase tracking-wider block leading-tight">
              Fluxo Líquido
            </span>
            <span
              className={`text-xs font-black font-mono block mt-0.5 ${
                summary.netFlow >= 0 ? 'text-income' : 'text-expense'
              }`}
            >
              {summary.netFlow >= 0 ? '+' : ''}
              {formatCurrency(summary.netFlow)}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
