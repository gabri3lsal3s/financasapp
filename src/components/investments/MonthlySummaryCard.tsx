import { useMemo } from 'react'
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
} from 'lucide-react'

interface MonthlySummaryCardProps {
  transactions: PortfolioTransaction[]
  shareHistory: PortfolioShareDailyRow[]
}

/** Retorna 'yyyy-MM' do mês anterior */
function getPreviousMonthKey(): string {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Verifica se estamos nos primeiros 10 dias do mês corrente */
function isWithinFirstTenDays(): boolean {
  const now = new Date()
  return now.getDate() <= 10
}

export default function MonthlySummaryCard({
  transactions,
  shareHistory,
}: MonthlySummaryCardProps) {
  const shouldShow = useMemo(isWithinFirstTenDays, [])

  const prevMonthKey = useMemo(getPreviousMonthKey, [])

  const summary = useMemo(() => {
    if (!shouldShow) return null

    let totalInvested = 0 // compras + subscrições
    let totalWithdrawn = 0 // vendas
    let totalIncome = 0 // dividendos + JCP + FII yield

    for (const tx of transactions) {
      if (!tx.date || tx.date.slice(0, 7) !== prevMonthKey) continue
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

    // Rentabilidade do mês anterior baseada no shareHistory
    let monthlyReturn: number | null = null
    const monthRows = shareHistory.filter((h) => h.rate_date.slice(0, 7) === prevMonthKey)
    if (monthRows.length >= 2) {
      const first = monthRows[0]
      const last = monthRows[monthRows.length - 1]
      if (first.share_value > 0) {
        monthlyReturn = ((last.share_value - first.share_value) / first.share_value) * 100
      }
    } else if (monthRows.length === 1) {
      // Apenas um registro no mês — comparar com o último do mês anterior
      const prevMonthRows = shareHistory.filter((h) => h.rate_date.slice(0, 7) < prevMonthKey)
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
  }, [transactions, shareHistory, prevMonthKey, shouldShow])

  if (!shouldShow || !summary) return null
  if (
    summary.totalInvested === 0 &&
    summary.totalWithdrawn === 0 &&
    summary.totalIncome === 0 &&
    summary.monthlyReturn === null
  ) {
    return null
  }

  const netFlow = summary.totalInvested - summary.totalWithdrawn
  const hasActivity =
    summary.totalInvested > 0 ||
    summary.totalWithdrawn > 0 ||
    summary.totalIncome > 0

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 space-y-4 text-left overflow-hidden relative">
      {/* Glow decorativo */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-[0.06] bg-[var(--color-income)]" />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-glass/40 pb-3">
        <span className="text-lg">💰</span>
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">
            Resumo de {formatMonth(prevMonthKey)}
          </h4>
          <p className="text-[9px] text-secondary font-medium">
            Resumo das movimentações e performance do mês anterior
          </p>
        </div>
      </div>

      {/* Grid de indicadores */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Investido */}
        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <ArrowUpRight size={12} className="text-income" />
            <span>Total Investido</span>
          </div>
          <span className="text-lg font-black text-primary font-mono block">
            {formatCurrency(summary.totalInvested)}
          </span>
        </div>

        {/* Total Retirado */}
        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <ArrowDownRight size={12} className="text-expense" />
            <span>Total Retirado</span>
          </div>
          <span className="text-lg font-black text-primary font-mono block">
            {formatCurrency(summary.totalWithdrawn)}
          </span>
        </div>

        {/* Proventos */}
        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <DollarSign size={12} className="text-income" />
            <span>Proventos Recebidos</span>
          </div>
          <span className="text-lg font-black text-primary font-mono block">
            {formatCurrency(summary.totalIncome)}
          </span>
        </div>

        {/* Rentabilidade */}
        <div className="p-3 rounded-2xl border border-glass/30 bg-glass/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary uppercase tracking-wider">
            <BarChart3 size={12} className="text-primary" />
            <span>Rentabilidade</span>
          </div>
          <span
            className={`text-lg font-black font-mono block flex items-center gap-1 ${
              summary.monthlyReturn !== null && summary.monthlyReturn >= 0
                ? 'text-income'
                : 'text-expense'
            }`}
          >
            {summary.monthlyReturn !== null ? (
              <>
                {summary.monthlyReturn >= 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                {formatSignedPercentBR(summary.monthlyReturn)}
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
      <div className="border-t border-glass/40 pt-2 text-[8px] font-semibold text-secondary text-center">
        Dados calculados com base no livro-razão e cotas diárias do portfólio
      </div>
    </Card>
  )
}
