import { useMemo } from 'react'
import { useDashboardFinances, useDashboardBudget } from '@/contexts/DashboardDataContext'
import { formatCurrency, formatNumberWithTwoDecimalsBR, formatMonth } from '@/utils/format'
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar, Target } from 'lucide-react'

interface InsightItem {
  id: string
  type: 'success' | 'warning' | 'info' | 'danger'
  icon: React.ReactNode
  text: string
  highlight: string
}

export default function InsightsDetail() {
  const { totalIncomes, totalExpenses, savingsRate, currentMonth } = useDashboardFinances()
  const { expenseByCategory, categoriesAttentionList } = useDashboardBudget()
  const { previousMonthExpenseTotal, weekdayExpenseData } = useDashboardFinances()

  const periodLabel = formatMonth(currentMonth)
  const limitsExceededCount = categoriesAttentionList?.filter((item) => item.isExceeded).length ?? 0

  const insights = useMemo((): InsightItem[] => {
    const list: InsightItem[] = []

    // 1. Taxa de Poupança
    if (totalIncomes > 0) {
      if (savingsRate >= 20) {
        list.push({
          id: 'savings-rate',
          type: 'success',
          icon: <CheckCircle2 size={16} className="text-income" />,
          text: `Excelente! Você economizou ${formatNumberWithTwoDecimalsBR(savingsRate)}% da sua renda em ${periodLabel}.`,
          highlight: 'Poupança Saudável',
        })
      } else if (savingsRate > 0) {
        list.push({
          id: 'savings-rate',
          type: 'info',
          icon: <Target size={16} className="text-primary" />,
          text: `Você economizou ${formatNumberWithTwoDecimalsBR(savingsRate)}% da sua renda. Tente poupar pelo menos 20%.`,
          highlight: 'Meta de Poupança',
        })
      } else {
        list.push({
          id: 'savings-rate',
          type: 'danger',
          icon: <AlertTriangle size={16} className="text-expense" />,
          text: `Seu saldo líquido ficou negativo em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRate))}% em relação às receitas.`,
          highlight: 'Saldo Negativo',
        })
      }
    }

    // 2. Variação com mês anterior
    if (previousMonthExpenseTotal && previousMonthExpenseTotal > 0 && totalExpenses > 0) {
      const diffPct = ((totalExpenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100
      if (diffPct < -5) {
        list.push({
          id: 'expense-variance',
          type: 'success',
          icon: <TrendingDown size={16} className="text-income" />,
          text: `Despesas diminuíram ${formatNumberWithTwoDecimalsBR(Math.abs(diffPct))}% comparado ao mês anterior.`,
          highlight: 'Redução de Despesas',
        })
      } else if (diffPct > 5) {
        list.push({
          id: 'expense-variance',
          type: 'warning',
          icon: <TrendingUp size={16} className="text-expense" />,
          text: `Despesas aumentaram ${formatNumberWithTwoDecimalsBR(diffPct)}% comparado ao mês anterior. Reveja seus gastos.`,
          highlight: 'Alta de Despesas',
        })
      }
    }

    // 3. Categoria mais relevante
    if (expenseByCategory && expenseByCategory.length > 0 && totalExpenses > 0) {
      const sorted = [...expenseByCategory].sort((a, b) => b.value - a.value)
      const topCat = sorted[0]
      const topPct = (topCat.value / totalExpenses) * 100
      if (topPct > 15) {
        list.push({
          id: 'top-category',
          type: 'info',
          icon: <Sparkles size={16} className="text-primary" />,
          text: `"${topCat.name}" foi seu maior custo: ${formatNumberWithTwoDecimalsBR(topPct)}% do total (${formatCurrency(topCat.value)}).`,
          highlight: 'Maior Categoria',
        })
      }
    }

    // 4. Limites excedidos
    if (limitsExceededCount > 0) {
      list.push({
        id: 'limits-exceeded',
        type: 'warning',
        icon: <AlertTriangle size={16} className="text-expense" />,
        text: `Você ultrapassou o orçamento em ${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'}.`,
        highlight: 'Metas Estouradas',
      })
    }

    // 5. Dia com mais gastos
    if (weekdayExpenseData && weekdayExpenseData.length > 0) {
      const sortedDays = [...weekdayExpenseData].sort((a, b) => b.Despesas - a.Despesas)
      const peakDay = sortedDays[0]
      if (peakDay && peakDay.Despesas > 0) {
        const dayNames: Record<string, string> = {
          Seg: 'Segunda', Ter: 'Terça', Qua: 'Quarta',
          Qui: 'Quinta', Sex: 'Sexta', Sáb: 'Sábado', Dom: 'Domingo',
        }
        list.push({
          id: 'peak-weekday',
          type: 'info',
          icon: <Calendar size={16} className="text-primary" />,
          text: `${dayNames[peakDay.dia] || peakDay.dia} foi o dia de maior gasto: ${formatCurrency(peakDay.Despesas)}.`,
          highlight: 'Pico de Gastos',
        })
      }
    }

    return list.slice(0, 3)
  }, [totalIncomes, totalExpenses, savingsRate, periodLabel, expenseByCategory, previousMonthExpenseTotal, limitsExceededCount, weekdayExpenseData])

  if (insights.length === 0) {
    return (
      <div className="py-4 text-center">
        <Sparkles size={20} className="text-secondary/40 mx-auto mb-1" />
        <p className="text-[10px] text-secondary">Insights aparecerão conforme você registrar seus gastos.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="flex items-start gap-3 p-3 rounded-xl border border-glass bg-secondary/15 transition-all hover:bg-secondary/25"
        >
          <div className="p-1.5 rounded-lg bg-secondary/35 flex-shrink-0 mt-0.5">
            {insight.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary block mb-0.5">
              {insight.highlight}
            </span>
            <p className="text-xs leading-relaxed text-primary line-clamp-3 sm:line-clamp-none">
              {insight.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
