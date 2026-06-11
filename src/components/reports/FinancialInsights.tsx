import { useMemo } from 'react'
import Card from '@/components/Card'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar, Target } from 'lucide-react'

interface CategorySummary {
  category_name: string
  total: number
}

interface WeekdayExpense {
  dia: string
  Despesas: number
}

interface FinancialInsightsProps {
  viewMode: 'month' | 'year'
  periodLabel: string
  incomeTotal: number
  expenseTotal: number
  savingsRate: number
  categoryExpenses: CategorySummary[]
  previousExpenseTotal: number
  weekdayExpenses?: WeekdayExpense[]
  limitsExceededCount?: number
  isSidebar?: boolean
}

export default function FinancialInsights({
  viewMode,
  periodLabel,
  incomeTotal,
  expenseTotal,
  savingsRate,
  categoryExpenses,
  previousExpenseTotal,
  weekdayExpenses,
  limitsExceededCount = 0,
  isSidebar = false,
}: FinancialInsightsProps) {
  const insights = useMemo(() => {
    const list: Array<{
      id: string
      type: 'success' | 'warning' | 'info' | 'danger'
      icon: React.ReactNode
      text: string
      highlight?: string
    }> = []

    // 1. Insight de Taxa de Poupança (Savings Rate)
    if (incomeTotal > 0) {
      if (savingsRate >= 20) {
        list.push({
          id: 'savings-rate',
          type: 'success',
          icon: <CheckCircle2 size={16} className="text-income" />,
          text: `Excelente! Você economizou ${formatNumberWithTwoDecimalsBR(savingsRate)}% da sua renda em ${periodLabel}, superando a taxa de poupança saudável recomendada de 20%.`,
          highlight: 'Poupança Saudável',
        })
      } else if (savingsRate > 0 && savingsRate < 20) {
        list.push({
          id: 'savings-rate',
          type: 'info',
          icon: <Target size={16} className="text-primary" />,
          text: `Você economizou ${formatNumberWithTwoDecimalsBR(savingsRate)}% da sua renda. Tente poupar pelo menos 20% estabelecendo limites de gastos em categorias não essenciais.`,
          highlight: 'Meta de Poupança',
        })
      } else if (savingsRate <= 0) {
        list.push({
          id: 'savings-rate',
          type: 'danger',
          icon: <AlertTriangle size={16} className="text-expense" />,
          text: `Atenção: Seu saldo líquido ficou negativo em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRate))}% em relação às receitas. Suas despesas e investimentos superaram seus ganhos.`,
          highlight: 'Saldo Negativo',
        })
      }
    }

    // 2. Insight de Variação de Despesas com Período Anterior
    if (previousExpenseTotal > 0 && expenseTotal > 0) {
      const diffPct = ((expenseTotal - previousExpenseTotal) / previousExpenseTotal) * 100
      if (diffPct < -5) {
        list.push({
          id: 'expense-variance',
          type: 'success',
          icon: <TrendingDown size={16} className="text-income" />,
          text: `Ótimo progresso! Suas despesas totais diminuíram ${formatNumberWithTwoDecimalsBR(Math.abs(diffPct))}% comparado ao período anterior. Continue assim!`,
          highlight: 'Redução de Despesas',
        })
      } else if (diffPct > 5) {
        list.push({
          id: 'expense-variance',
          type: 'warning',
          icon: <TrendingUp size={16} className="text-expense" />,
          text: `Aviso: Suas despesas aumentaram ${formatNumberWithTwoDecimalsBR(diffPct)}% comparado ao período anterior. Recomenda-se analisar quais categorias causaram essa alta.`,
          highlight: 'Alta de Despesas',
        })
      }
    }

    // 3. Insight de Categoria mais Relevante
    if (categoryExpenses.length > 0 && expenseTotal > 0) {
      const sorted = [...categoryExpenses].sort((a, b) => b.total - a.total)
      const topCat = sorted[0]
      const topPct = (topCat.total / expenseTotal) * 100
      if (topPct > 15) {
        list.push({
          id: 'top-category',
          type: 'info',
          icon: <Sparkles size={16} className="text-primary" />,
          text: `A categoria "${topCat.category_name}" foi o seu maior custo no período, representando ${formatNumberWithTwoDecimalsBR(topPct)}% do total de saídas (${formatCurrency(topCat.total)}).`,
          highlight: 'Maior Categoria',
        })
      }
    }

    // 4. Insight de Metas Excedidas
    if (limitsExceededCount > 0 && viewMode === 'month') {
      list.push({
        id: 'limits-exceeded',
        type: 'warning',
        icon: <AlertTriangle size={16} className="text-expense" />,
        text: `Você ultrapassou a meta de orçamento mensal em ${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'}. Considere reajustar seus hábitos.`,
        highlight: 'Metas Estouradas',
      })
    }

    // 5. Dia com Mais Despesas (Apenas no Mês)
    if (viewMode === 'month' && weekdayExpenses && weekdayExpenses.length > 0) {
      const sortedDays = [...weekdayExpenses].sort((a, b) => b.Despesas - a.Despesas)
      const peakDay = sortedDays[0]
      if (peakDay && peakDay.Despesas > 0) {
        const fullDayNames: Record<string, string> = {
          Seg: 'Segunda-feira',
          Ter: 'Terça-feira',
          Qua: 'Quarta-feira',
          Qui: 'Quinta-feira',
          Sex: 'Sexta-feira',
          Sáb: 'Sábado',
          Dom: 'Domingo',
        }
        list.push({
          id: 'peak-weekday',
          type: 'info',
          icon: <Calendar size={16} className="text-primary" />,
          text: `O dia da semana com maior volume de gastos foi ${fullDayNames[peakDay.dia] || peakDay.dia}, concentrando ${formatCurrency(peakDay.Despesas)} das saídas do mês.`,
          highlight: 'Pico de Gastos',
        })
      }
    }

    return list.slice(0, 3) // Mostrar no máximo 3 insights para não poluir
  }, [viewMode, periodLabel, incomeTotal, expenseTotal, savingsRate, categoryExpenses, previousExpenseTotal, weekdayExpenses, limitsExceededCount])

  if (insights.length === 0) return null

  return (
    <Card className="relative overflow-hidden border border-glass surface-glass-strong p-4 lg:p-5 shadow-lg group">
      {/* Detalhe luminoso no fundo */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none transition-all group-hover:bg-primary/10" />

      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-primary animate-pulse" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Insights Financeiros do Período</h3>
      </div>

      <div className={`grid grid-cols-1 ${isSidebar ? '' : 'md:grid-cols-3'} gap-3.5 mt-2`}>
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="flex items-start gap-3 p-3 rounded-xl border border-glass bg-secondary/15 transition-all hover:bg-secondary/25 hover:scale-[1.01]"
          >
            <div className="p-1.5 rounded-lg bg-secondary/35 flex-shrink-0 mt-0.5">
              {insight.icon}
            </div>
            <div className="min-w-0 flex-1">
              {insight.highlight && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary block mb-0.5">
                  {insight.highlight}
                </span>
              )}
              <p className="text-xs leading-relaxed text-primary">
                {insight.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
