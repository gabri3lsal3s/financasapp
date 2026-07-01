import { useMemo } from 'react'
import Card from '@/components/Card'
import { formatCurrency, formatMonth } from '@/utils/format'
import { Wallet, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

interface AvailableSpendingCardProps {
  currentMonth: string
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
}

export default function AvailableSpendingCard({
  currentMonth,
  totalIncomes,
  totalExpenses,
  totalInvestments
}: AvailableSpendingCardProps) {
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

    // Monthly Available Spending: Incomes - Investments - Expenses
    const monthlyAvailable = totalIncomes - totalInvestments - totalExpenses

    if (isPast) {
      return {
        mode: 'past' as const,
        title: 'Gasto Disponível (Mês Encerrado)',
        monthlyAvailable,
        dailyAvailable: 0,
        daysInMonth,
        description: `O mês de ${formatMonth(currentMonth)} foi concluído com saldo final de ${formatCurrency(monthlyAvailable)} para gastos livres.`
      }
    }

    if (isFuture) {
      // Total projected spending / days in month
      const totalProjected = totalIncomes - totalInvestments
      const dailyAvailable = daysInMonth > 0 ? Math.max(0, totalProjected / daysInMonth) : 0
      return {
        mode: 'future' as const,
        title: 'Gasto Disponível Projetado',
        monthlyAvailable: totalProjected,
        dailyAvailable,
        daysInMonth,
        description: `Planejamento para ${formatMonth(currentMonth)}.`
      }
    }

    // Current month calculations
    const remainingDays = daysInMonth - currentDay + 1
    const dailyAvailable = remainingDays > 0 ? Math.max(0, monthlyAvailable / remainingDays) : 0

    return {
      mode: 'current' as const,
      title: 'Gasto Disponível',
      currentDay,
      daysInMonth,
      remainingDays,
      monthlyAvailable,
      dailyAvailable
    }
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments])

  return (
    <Card className="h-full relative overflow-hidden flex flex-col p-5 border border-glass surface-glass transition-all hover:border-glass-strong hover:shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="text-primary" size={20} />
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
          {calculations.title}
        </h3>
      </div>

      <div className="flex-1 flex flex-col justify-between space-y-4">
        <div>
          {calculations.mode === 'current' && (
            <p className="text-xs text-secondary mb-3">
              Hoje é dia <span className="font-bold text-primary">{calculations.currentDay}</span> de <span className="font-bold text-primary">{calculations.daysInMonth}</span> ({calculations.remainingDays} dias restantes)
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-glass p-3.5 bg-secondary/5">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Mensal Disponível</p>
              <p className={`text-lg font-extrabold font-mono mt-1 ${calculations.monthlyAvailable < 0 ? 'text-expense' : 'text-income'}`}>
                {formatCurrency(calculations.monthlyAvailable)}
              </p>
            </div>

            <div className="rounded-xl border border-glass p-3.5 bg-secondary/5">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Diário Disponível</p>
              <p className={`text-lg font-extrabold font-mono mt-1 ${calculations.monthlyAvailable < 0 ? 'text-expense' : 'text-primary'}`}>
                {formatCurrency(calculations.dailyAvailable)}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          {calculations.mode === 'past' ? (
            calculations.monthlyAvailable >= 0 ? (
              <div className="rounded-xl p-3 border border-income/20 bg-income/5 flex gap-2.5 items-start">
                <CheckCircle2 className="text-income shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-income">Saldo Final Positivo</p>
                  <p className="text-secondary mt-0.5 leading-relaxed">
                    Você encerrou o período com um saldo positivo disponível de {formatCurrency(calculations.monthlyAvailable)}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-3 border border-expense/20 bg-expense/5 flex gap-2.5 items-start">
                <AlertTriangle className="text-expense shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                  <p className="font-bold text-expense">Saldo Final Negativo</p>
                  <p className="text-secondary mt-0.5 leading-relaxed">
                    Suas despesas e investimentos superaram as receitas deste mês em {formatCurrency(Math.abs(calculations.monthlyAvailable))}.
                  </p>
                </div>
              </div>
            )
          ) : calculations.mode === 'future' ? (
            <div className="rounded-xl p-3 border border-glass bg-secondary/5 flex gap-2.5 items-start">
              <Info className="text-primary shrink-0 mt-0.5" size={16} />
              <div className="text-xs text-secondary leading-relaxed">
                Este mês possui um limite diário projetado de {formatCurrency(calculations.dailyAvailable)} com base nas receitas previstas.
              </div>
            </div>
          ) : calculations.monthlyAvailable <= 0 ? (
            <div className="rounded-xl p-3 border border-expense/20 bg-expense/5 flex gap-2.5 items-start">
              <AlertTriangle className="text-expense shrink-0 mt-0.5" size={16} />
              <div className="text-xs">
                <p className="font-bold text-expense">Orçamento Esgotado</p>
                <p className="text-secondary mt-0.5 leading-relaxed">
                  Você já consumiu todo o saldo disponível para gastos livres este mês. Tente conter despesas.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-3 border border-income/20 bg-income/5 flex gap-2.5 items-start">
              <CheckCircle2 className="text-income shrink-0 mt-0.5" size={16} />
              <div className="text-xs">
                <p className="font-bold text-income">Orçamento sob Controle</p>
                <p className="text-secondary mt-0.5 leading-relaxed">
                  Você tem {formatCurrency(calculations.monthlyAvailable)} livres para gastar até o fim do mês (média de {formatCurrency(calculations.dailyAvailable)} por dia).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
