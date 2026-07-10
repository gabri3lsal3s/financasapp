import { useMemo, useState, useCallback } from 'react'
import { X, Check, Undo2, Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { useDashboardData } from '@/contexts/DashboardDataContext'
import { formatCurrency, formatDate } from '@/utils/format'
import { cn } from '@/lib/utils'
import Modal from '@/components/Modal'
import {
  dismissOccurrence,
  confirmOccurrence,
  clearOccurrenceFeedback,
  getDismissedIds,
  getConfirmedIds,
} from '@/utils/recurringExpenseLearning'
import type { RecurringExpenseInfo } from '@/services/insightsEngine'
import { applyReportWeight } from '@/utils/reportWeight'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Normaliza descrição para matching entre meses */
const normalizeDesc = (desc: string) =>
  desc.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, '').trim()

/** Mapa de meses disponíveis no contexto */
interface MonthExpenses {
  month: string
  expenses: { id: string; description: string; amount: number; date: string; categoryName: string }[]
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface RecurringExpenseDetailModalProps {
  isOpen: boolean
  onClose: () => void
  item: RecurringExpenseInfo
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function RecurringExpenseDetailModal({
  isOpen,
  onClose,
  item,
}: RecurringExpenseDetailModalProps) {
  const ctx = useDashboardData()
  const [, forceUpdate] = useState(0)
  const refresh = useCallback(() => forceUpdate((n) => n + 1), [])

  const recurringKey = normalizeDesc(item.description)

  // Coleta ocorrências da despesa em todos os meses disponíveis
  const occurrences = useMemo(() => {
    if (!isOpen) return []

    // Monta lista de meses: current + previous + additional
    const monthsData: MonthExpenses[] = [
      { month: ctx.currentMonth, expenses: ctx.expenses.map(e => ({
        id: e.id,
        description: e.description || '',
        amount: applyReportWeight(e.amount, e.report_weight),
        date: e.date,
        categoryName: e.category?.name || '',
      }))},
      { month: 'previous', expenses: [] }, // Será populado abaixo
    ]

    // Collect from previous months via insights recurringExpenses
    const allOccurrences: Array<{
      month: string
      expenseId: string
      amount: number
      date: string
      description: string
      categoryName: string
      isDismissed: boolean
      isConfirmed: boolean
    }> = []

    // Procura em cada mês por despesas com descrição similar
    const dismissedIds = getDismissedIds(recurringKey)
    const confirmedIds = getConfirmedIds(recurringKey)

    for (const monthData of monthsData) {
      for (const exp of monthData.expenses) {
        const expKey = normalizeDesc(exp.description)
        const itemKey = normalizeDesc(item.description)
        if (expKey === itemKey) {
          allOccurrences.push({
            month: monthData.month,
            expenseId: exp.id,
            amount: exp.amount,
            date: exp.date,
            description: exp.description,
            categoryName: exp.categoryName,
            isDismissed: dismissedIds.includes(exp.id),
            isConfirmed: confirmedIds.includes(exp.id),
          })
        }
      }
    }

    // Ordena por data (mais recente primeiro)
    return allOccurrences.sort((a, b) => b.date.localeCompare(a.date))
  }, [ctx, isOpen, item, recurringKey])

  const handleDismiss = (expenseId: string) => {
    dismissOccurrence(recurringKey, expenseId)
    refresh()
  }

  const handleConfirm = (expenseId: string) => {
    confirmOccurrence(recurringKey, expenseId)
    refresh()
  }

  const handleClear = (expenseId: string) => {
    clearOccurrenceFeedback(recurringKey, expenseId)
    refresh()
  }

  const Icon = item.recurrenceType === 'subscription' ? TrendingDown : TrendingUp

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalhes • ${item.description}`}
    >
      <div className="modal-body-stack">
        {/* Cabeçalho informativo */}
        <div className="rounded-xl border border-glass surface-glass p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold',
                item.recurrenceType === 'subscription' ? 'bg-balance/10 text-balance' :
                item.recurrenceType === 'recurring' ? 'bg-warning/10 text-warning' : 'bg-secondary/10 text-secondary',
              )}>
                <Icon size={13} />
              </span>
              <div>
                <p className="text-xs font-bold text-primary">{item.description}</p>
                <p className="text-[9px] text-secondary">{item.categoryName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-primary font-mono">{formatCurrency(item.monthlyAmount)}</p>
              <p className="text-[8px] text-secondary/60">Confiança: {Math.round(item.confidence * 100)}%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-secondary pt-1 border-t border-glass/30">
            <span className="flex items-center gap-1"><Calendar size={10} /> {item.monthsFound} {item.monthsFound === 1 ? 'mês' : 'meses'}</span>
            <span>{item.recurrenceType === 'subscription' ? 'Assinatura' : item.recurrenceType === 'recurring' ? 'Recorrente' : 'Padrão'}</span>
            <span className={item.tier === 'can_cut' ? 'text-income' : 'text-secondary'}>
              {item.tier === 'can_cut' ? 'Cortável' : item.tier === 'essential' ? 'Essencial' : 'Opcional'}
            </span>
          </div>
        </div>

        {/* Ocorrências */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
            Ocorrências encontradas ({occurrences.length})
          </p>

          {occurrences.length === 0 ? (
            <p className="text-[10px] text-secondary text-center py-4">
              Nenhuma ocorrência encontrada para esta despesa.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {occurrences.map((occ) => (
                <div
                  key={`${occ.expenseId}-${occ.date}`}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all',
                    occ.isDismissed
                      ? 'border-glass/20 opacity-40'
                      : occ.isConfirmed
                      ? 'border-income/30 bg-income/5'
                      : 'border-glass',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-primary truncate">{occ.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] text-secondary/60">{formatDate(occ.date)}</span>
                      <span className="text-[8px] text-secondary/40">{occ.categoryName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-primary font-mono">{formatCurrency(occ.amount)}</span>
                    {occ.isDismissed ? (
                      <button
                        type="button"
                        onClick={() => handleClear(occ.expenseId)}
                        className="w-6 h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-secondary/40 hover:text-primary"
                        title="Restaurar"
                      >
                        <Undo2 size={11} />
                      </button>
                    ) : occ.isConfirmed ? (
                      <button
                        type="button"
                        onClick={() => handleClear(occ.expenseId)}
                        className="w-6 h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-income/60 hover:text-income"
                        title="Remover confirmação"
                      >
                        <Undo2 size={11} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDismiss(occ.expenseId)}
                          className="w-6 h-6 rounded-lg hover:bg-expense/10 flex items-center justify-center text-secondary/40 hover:text-expense"
                          title="Não é recorrência"
                        >
                          <X size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirm(occ.expenseId)}
                          className="w-6 h-6 rounded-lg hover:bg-income/10 flex items-center justify-center text-secondary/40 hover:text-income"
                          title="Confirmar como recorrência"
                        >
                          <Check size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dica */}
        <p className="text-[9px] text-secondary/50 text-center pt-1">
          Use os botões ✓ e ✗ para ensinar o app a identificar melhor esta recorrência.
        </p>
      </div>
    </Modal>
  )
}
