import { useMemo } from 'react'
import Card from '@/components/Card'
import { formatCurrency, formatMonth, formatNumberBR } from '@/utils/format'
import { CalendarDays, AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown } from 'lucide-react'

interface Expense {
  date: string
  amount: number
  report_weight?: number | null
}

interface DailyBudgetAdvisorProps {
  currentMonth: string
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
  expenses: Expense[]
}

export default function DailyBudgetAdvisor({
  currentMonth,
  totalIncomes,
  totalExpenses,
  totalInvestments,
  expenses
}: DailyBudgetAdvisorProps) {
  const calculations = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const currentDay = today.getDate()

    const systemMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const isPast = currentMonth < systemMonthStr
    const isFuture = currentMonth > systemMonthStr

    const [selYear, selMonth] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(selYear, selMonth, 0).getDate()

    const netBalance = totalIncomes - totalInvestments - totalExpenses

    if (isPast) {
      const averageDailySpent = daysInMonth > 0 ? totalExpenses / daysInMonth : 0
      const savingsRate = totalIncomes > 0 ? (netBalance / totalIncomes) * 100 : 0

      return {
        mode: 'past' as const,
        title: 'Mês Encerrado',
        description: `O mês de ${formatMonth(currentMonth)} foi concluído.`,
        daysInMonth,
        averageDailySpent,
        savingsRate,
        netBalance,
      }
    }

    if (isFuture) {
      const projectedDaily = daysInMonth > 0 ? Math.max(0, (totalIncomes - totalInvestments) / daysInMonth) : 0
      return {
        mode: 'future' as const,
        title: 'Próximo Mês',
        description: `Planejamento para ${formatMonth(currentMonth)}.`,
        daysInMonth,
        projectedDaily,
      }
    }

    // Current month calculations
    const remainingDays = daysInMonth - currentDay + 1
    const todayStr = `${currentMonth}-${String(currentDay).padStart(2, '0')}`

    const spentToday = expenses
      .filter((e) => e.date === todayStr)
      .reduce((sum, e) => sum + e.amount * (e.report_weight ?? 1), 0)

    // Pool of money left for today + remaining days
    const totalRemainingPool = netBalance + spentToday
    const suggestedDaily = remainingDays > 0 ? Math.max(0, totalRemainingPool / remainingDays) : 0
    const isExceeded = spentToday > suggestedDaily

    return {
      mode: 'current' as const,
      title: 'Acompanhamento Diário',
      currentDay,
      daysInMonth,
      remainingDays,
      spentToday,
      suggestedDaily,
      isExceeded,
      totalRemainingPool,
    }
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments, expenses])

  return (
    <Card className="h-full relative overflow-hidden flex flex-col p-5 border border-glass surface-glass transition-all hover:border-glass-strong hover:shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="text-primary" size={20} />
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
          {calculations.title}
        </h3>
      </div>

      {calculations.mode === 'current' && (
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs text-secondary">
              Hoje é dia <span className="font-bold text-primary">{calculations.currentDay}</span> de <span className="font-bold text-primary">{calculations.daysInMonth}</span> ({calculations.remainingDays} dias restantes)
            </p>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="rounded-xl border border-glass p-3 bg-secondary/5">
                <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Gasto hoje</p>
                <p className={`text-base font-extrabold font-mono mt-1 ${calculations.isExceeded && calculations.spentToday > 0 ? 'text-expense' : 'text-primary'}`}>
                  {formatCurrency(calculations.spentToday)}
                </p>
              </div>

              <div className="rounded-xl border border-glass p-3 bg-secondary/5">
                <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Orçamento / Dia</p>
                <p className="text-base font-extrabold font-mono mt-1 text-balance">
                  {formatCurrency(calculations.suggestedDaily)}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {calculations.totalRemainingPool <= 0 ? (
              <div className="rounded-xl p-3 border border-expense/20 bg-expense/5 flex gap-2.5 items-start">
                <AlertTriangle className="text-expense shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-expense">Saldo de Gastos Esgotado</p>
                  <p className="text-secondary mt-0.5 leading-relaxed">
                    Você já utilizou todo o saldo projetado para gastos livres neste mês. Evite novos gastos se possível.
                  </p>
                </div>
              </div>
            ) : calculations.isExceeded ? (
              <div className="rounded-xl p-3 border border-expense/20 bg-expense/5 flex gap-2.5 items-start">
                <AlertTriangle className="text-expense shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-expense">Atenção: Excedeu o Dia</p>
                  <p className="text-secondary mt-0.5 leading-relaxed">
                    Seus gastos hoje ultrapassaram o orçamento diário sugerido de {formatCurrency(calculations.suggestedDaily)}. Tente compensar amanhã!
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-3 border border-income/20 bg-income/5 flex gap-2.5 items-start">
                <CheckCircle2 className="text-income shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-income">Meta Diária Saudável</p>
                  <p className="text-secondary mt-0.5 leading-relaxed">
                    Excelente! Seus gastos de hoje estão sob controle. Você ainda possui {formatCurrency(calculations.totalRemainingPool)} livres para o restante do mês.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {calculations.mode === 'past' && (
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs text-secondary leading-relaxed">
              Este mês está concluído. Aqui está um resumo rápido do seu ritmo financeiro:
            </p>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="rounded-xl border border-glass p-3 bg-secondary/5">
                <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Média Diária Gasta</p>
                <p className="text-base font-extrabold font-mono mt-1 text-primary">
                  {formatCurrency(calculations.averageDailySpent ?? 0)}
                </p>
              </div>

              <div className="rounded-xl border border-glass p-3 bg-secondary/5">
                <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Taxa de Saldo Final</p>
                <p className={`text-base font-extrabold font-mono mt-1 ${(calculations.savingsRate ?? 0) >= 0 ? 'text-income' : 'text-expense'}`}>
                  {formatNumberBR(calculations.savingsRate ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {(calculations.netBalance ?? 0) >= 0 ? (
              <div className="rounded-xl p-3 border border-income/20 bg-income/5 flex gap-2.5 items-start">
                <TrendingUp className="text-income shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-income">Resultado Positivo</p>
                  <p className="text-secondary mt-0.5 leading-relaxed">
                    Parabéns! Você encerrou este mês com saldo positivo de {formatCurrency(calculations.netBalance ?? 0)}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-3 border border-expense/20 bg-expense/5 flex gap-2.5 items-start">
                <TrendingDown className="text-expense shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-expense">Déficit no Mês</p>
                  <p className="text-secondary mt-0.5 leading-relaxed">
                    Você encerrou o mês gastando {formatCurrency(Math.abs(calculations.netBalance ?? 0))} a mais do que sua renda líquida.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {calculations.mode === 'future' && (
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div>
            <p className="text-xs text-secondary leading-relaxed">
              Este mês ainda não começou. Prepare seu planejamento orçamentário.
            </p>

            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="rounded-xl border border-glass p-3 bg-secondary/5">
                <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Limite Diário Projetado</p>
                <p className="text-base font-extrabold font-mono mt-1 text-primary">
                  {formatCurrency(calculations.projectedDaily ?? 0)}
                </p>
                <p className="text-[10px] text-secondary mt-1">
                  Baseado nas receitas projetadas menos aportes programados.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3 border border-glass bg-secondary/5 flex gap-2.5 items-start">
            <Info className="text-primary shrink-0 mt-0.5" size={16} />
            <div className="text-xs text-secondary leading-relaxed">
              Você pode definir suas expectativas de rendas e limites de gastos antecipadamente na página de Categorias.
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
