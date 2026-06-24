import { useMemo, useState } from 'react'
import Card from '@/components/Card'
import { formatCurrency, formatSignedPercentBR, formatMonth } from '@/utils/format'
import type { PortfolioTransaction, PortfolioShareDailyRow } from '@/types'
import { isPortfolioIncomeType } from '@/utils/portfolioOperations'
import { isCashTicker } from '@/utils/assetClassifier'
import { transactionInvestmentAmount } from '@/utils/portfolioMonthlyFlow'
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface MonthlySummaryCardProps {
  transactions: PortfolioTransaction[]
  shareHistory: PortfolioShareDailyRow[]
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlySummaryCard({
  transactions,
  shareHistory,
}: MonthlySummaryCardProps) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey)

  const summary = useMemo(() => {
    let totalInvested = 0
    let totalWithdrawn = 0
    let totalIncome = 0

    for (const tx of transactions) {
      if (!tx.date || tx.date.slice(0, 7) !== selectedMonth) continue
      if (isCashTicker(tx.ticker)) continue

      const flowAmount = transactionInvestmentAmount(
        tx.operation_type,
        Number(tx.quantity),
        Number(tx.price)
      )

      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        totalInvested += Math.abs(flowAmount)
      } else if (tx.operation_type === 'sell') {
        totalWithdrawn += Math.abs(flowAmount)
      } else if (isPortfolioIncomeType(tx.operation_type)) {
        totalIncome += Math.abs(flowAmount)
      }
    }

    // Rentabilidade do mês selecionado baseada no shareHistory
    let monthlyReturn: number | null = null
    const monthRows = shareHistory.filter((h) => h.rate_date.slice(0, 7) === selectedMonth)
    if (monthRows.length >= 2) {
      const first = monthRows[0]
      const last = monthRows[monthRows.length - 1]
      if (first.share_value > 0) {
        monthlyReturn = ((last.share_value - first.share_value) / first.share_value) * 100
      }
    } else if (monthRows.length === 1) {
      const prevMonthRows = shareHistory.filter((h) => h.rate_date.slice(0, 7) < selectedMonth)
      if (prevMonthRows.length >= 1) {
        const first = prevMonthRows[prevMonthRows.length - 1]
        const last = monthRows[0]
        if (first.share_value > 0) {
          monthlyReturn = ((last.share_value - first.share_value) / first.share_value) * 100
        }
      }
    }

    return {
      totalInvested,
      totalWithdrawn,
      totalIncome,
      monthlyReturn,
    }
  }, [transactions, shareHistory, selectedMonth])

  const hasActivity = summary
    ? summary.totalInvested > 0 ||
      summary.totalWithdrawn > 0 ||
      summary.totalIncome > 0
    : false
  const hasReturn = summary?.monthlyReturn !== null
  const isEmpty = !summary || (!hasActivity && !hasReturn)

  const canGoPrev = true
  const canGoNext = selectedMonth < getCurrentMonthKey()

  const handlePrev = () => setSelectedMonth(addMonths(selectedMonth, -1))
  const handleNext = () => {
    const next = addMonths(selectedMonth, 1)
    if (next <= getCurrentMonthKey()) setSelectedMonth(next)
  }

  const headerContent = (title: string, subtitle: string) => (
    <div className="flex items-center justify-between border-b border-glass/40 pb-3">
      <div className="flex items-center gap-2">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">
            {title}
          </h4>
          <p className="text-[10px] text-secondary font-medium">{subtitle}</p>
        </div>
      </div>
      {/* Navegação de meses */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="w-7 h-7 rounded-lg flex items-center justify-center border border-glass/30 hover:bg-glass/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-secondary"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[10px] font-black text-primary font-mono min-w-[80px] text-center select-none">
          {formatMonth(selectedMonth)}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          className="w-7 h-7 rounded-lg flex items-center justify-center border border-glass/30 hover:bg-glass/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-secondary"
          aria-label="Próximo mês"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )

  if (isEmpty) {
    return (
      <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-4 text-left overflow-hidden relative">
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-[0.06] bg-[var(--color-income)]" />
        {headerContent(
          `Resumo Mensal`,
          `Nenhuma movimentação registrada em ${formatMonth(selectedMonth)}`
        )}
        <div className="py-8 text-center text-xs font-semibold text-secondary">
          Nenhuma movimentação ou dado de rentabilidade disponível para {formatMonth(selectedMonth)}.
        </div>
      </Card>
    )
  }

  const netFlow = summary!.totalInvested - summary!.totalWithdrawn

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-4 text-left overflow-hidden relative">
      {/* Glow decorativo */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-[0.06] bg-[var(--color-income)]" />

      {/* Header com navegação */}
      {headerContent('Resumo Mensal', 'Movimentações e performance do período')}

      {/* Grid de indicadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <ArrowUpRight size={12} className="text-income" />
            <span>Total Investido</span>
          </div>
          <span className="text-lg font-black text-primary font-mono block">
            {formatCurrency(summary!.totalInvested)}
          </span>
        </div>

        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <ArrowDownRight size={12} className="text-expense" />
            <span>Total Retirado</span>
          </div>
          <span className="text-lg font-black text-primary font-mono block">
            {formatCurrency(summary!.totalWithdrawn)}
          </span>
        </div>

        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <DollarSign size={12} className="text-income" />
            <span>Proventos Recebidos</span>
          </div>
          <span className="text-lg font-black text-primary font-mono block">
            {formatCurrency(summary!.totalIncome)}
          </span>
        </div>

        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <BarChart3 size={12} className="text-primary" />
            <span>Rentabilidade</span>
          </div>
          <span
            className={`text-lg font-black font-mono block flex items-center gap-1 ${
              summary!.monthlyReturn !== null && summary!.monthlyReturn >= 0
                ? 'text-income'
                : 'text-expense'
            }`}
          >
            {summary!.monthlyReturn !== null ? (
              <>
                {summary!.monthlyReturn >= 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                {formatSignedPercentBR(summary!.monthlyReturn)}
              </>
            ) : (
              <span className="text-secondary">—</span>
            )}
          </span>
        </div>
      </div>

      {/* Fluxo líquido */}
      {hasActivity && (
        <div className="flex items-center justify-between p-3 rounded-2xl border border-glass/30 bg-glass/5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-secondary uppercase tracking-wider">
            <PiggyBank size={14} className="text-primary" />
            <span>Fluxo Líquido do Mês</span>
          </div>
          <span
            className={`font-black font-mono ${
              netFlow >= 0 ? 'text-income' : 'text-expense'
            }`}
          >
            {netFlow >= 0 ? '+' : ''}
            {formatCurrency(netFlow)}
          </span>
        </div>
      )}

      {/* Subtítulo de rodapé */}
      <div className="border-t border-glass/40 pt-2 text-[9px] font-semibold text-secondary text-center">
        Dados calculados com base no livro-razão e cotas diárias do portfólio
      </div>
    </Card>
  )
}
