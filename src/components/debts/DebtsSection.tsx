import { cn } from '@/lib/utils'
import { Eyebrow } from '@/components/ui/eyebrow'
import {
  Plus, Scale, Check, Pencil, Trash2, CheckCircle2, Link2, ChevronUp, ChevronDown,
} from 'lucide-react'
import Button from '@/components/Button'
import EmptyState from '@/components/EmptyState'
import { formatDate, formatMonth } from '@/utils/format'
import AmountText from '@/components/ui/amount-text'
import { getDebtDueStatus, DEBT_DUE_STATUS_LABEL, type DebtDueStatus } from '@/utils/debtStatus'
import { CARD_BASE, CARD_PADDING } from '@/constants/layout'
import type { Debt } from '@/types'

const DUE_STATUS_CLASSES: Record<DebtDueStatus, string> = {
  paid: 'bg-income/10 border-income/20 text-income',
  overdue: 'bg-expense/10 border-expense/20 text-expense',
  due_today: 'bg-warning/10 border-warning/20 text-warning',
  due_soon: 'bg-warning/10 border-warning/20 text-warning',
  pending: 'bg-secondary/10 border-primary/20 text-secondary',
}

type DebtFilter = 'all' | 'payable' | 'receivable'

interface DebtsSectionProps {
  pendingDebts: Debt[]
  payablePendingCount: number
  receivablePendingCount: number
  filteredPendingDebts: Debt[]
  confirmedDebts: Debt[]
  debtFilter: DebtFilter
  onDebtFilterChange: (filter: DebtFilter) => void
  expandedItems: Record<string, boolean>
  onToggleExpand: (id: string) => void
  onCreateDebt: () => void
  onEditDebt: (debt: Debt) => void
  onDeleteDebt: (debtId: string) => void
  onToggleDebtStatus: (debt: Debt) => void
}

/**
 * SEÇÃO 2 — Pendências (a pagar e a receber) — extraída de Contas.tsx.
 *
 * Filtros rápidos, lista de pendências em accordion (com despesa integrada),
 * ações de confirmação/edição/exclusão e o bloco de confirmadas do mês.
 */
export default function DebtsSection({
  pendingDebts,
  payablePendingCount,
  receivablePendingCount,
  filteredPendingDebts,
  confirmedDebts,
  debtFilter,
  onDebtFilterChange,
  expandedItems,
  onToggleExpand,
  onCreateDebt,
  onEditDebt,
  onDeleteDebt,
  onToggleDebtStatus,
}: DebtsSectionProps) {
  return (
    <section className={cn('space-y-3', CARD_BASE, CARD_PADDING)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-glass pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Scale size={16} className="shrink-0 text-primary/60 sm:text-primary/70" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate flex items-center gap-1.5">
              Pendências
              <span className="text-xs font-medium text-secondary font-sans">
                ({pendingDebts.length})
              </span>
            </h2>
            <p className="text-xs text-secondary mt-0.5 truncate">Dívidas a pagar e créditos a receber</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
          {/* Filtros rápidos em Chips/Pills */}
          <div className="flex items-center gap-1 p-1 bg-secondary/30 rounded-xl border border-glass text-xs font-semibold">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDebtFilterChange('all')}
              className={`h-auto min-h-0 px-2.5 py-1 rounded-lg transition-all ${
                debtFilter === 'all'
                  ? 'bg-primary text-white shadow-sm font-bold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Todas ({pendingDebts.length})
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDebtFilterChange('payable')}
              className={`h-auto min-h-0 px-2.5 py-1 rounded-lg transition-all ${
                debtFilter === 'payable'
                  ? 'bg-expense text-white shadow-sm font-bold'
                  : 'text-secondary hover:text-expense'
              }`}
            >
              Pagar ({payablePendingCount})
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDebtFilterChange('receivable')}
              className={`h-auto min-h-0 px-2.5 py-1 rounded-lg transition-all ${
                debtFilter === 'receivable'
                  ? 'bg-income text-white shadow-sm font-bold'
                  : 'text-secondary hover:text-income'
              }`}
            >
              Receber ({receivablePendingCount})
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={onCreateDebt}
            className="h-8 px-3 text-xs font-semibold flex items-center gap-1.5 bg-secondary/20 hover:bg-secondary/40 border border-glass shrink-0"
          >
            <Plus size={14} />
            Nova Pendência
          </Button>
        </div>
      </div>

      {filteredPendingDebts.length === 0 ? (
        <EmptyState
          icon={<Scale size={28} />}
          title={debtFilter === 'all' ? 'Nenhuma pendência ativa' : debtFilter === 'payable' ? 'Nenhuma conta a pagar' : 'Nenhum valor a receber'}
          description={
            debtFilter === 'all'
              ? 'Você não possui dívidas ou contas a receber pendentes para este período.'
              : debtFilter === 'payable'
              ? 'Você não possui contas a pagar pendentes.'
              : 'Você não possui valores a receber pendentes.'
          }
          action={{
            label: 'Nova Pendência',
            onClick: onCreateDebt,
            variant: 'primary',
          }}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredPendingDebts.map((debt) => {
            const isExpanded = !!expandedItems[debt.id]
            const isPayable = debt.type === 'payable'
            const isPaid = debt.status === 'paid'

            const dueStatus = getDebtDueStatus(debt)

            return (
              <div key={debt.id} id={`item-${debt.id}`} className="p-0 overflow-hidden rounded-2xl border border-glass surface-glass shadow-sm transition-all duration-300 relative">
                {/* Color bar indicator for type */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isPayable ? 'bg-expense' : 'bg-income'}`} />

                {/* Accordion Header */}
                <div
                  className="p-3 sm:p-4 pl-4 sm:pl-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                  onClick={() => onToggleExpand(debt.id)}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs sm:text-sm font-bold text-primary truncate max-w-[180px] sm:max-w-none">{debt.name}</p>
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                        isPayable ? 'bg-expense/10 border-expense/20 text-expense' : 'bg-income/10 border-income/20 text-income'
                      }`}>
                        {isPayable ? 'A Pagar' : 'A Receber'}
                      </span>
                      {debt.expense_id && (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider bg-balance/10 border border-balance/20 text-balance px-2 py-0.5 rounded-md shrink-0 cursor-help"
                          title="Esta pendência está integrada a uma despesa e as alterações serão sincronizadas."
                        >
                          <Link2 size={10} className="stroke-[3]" />
                          Integrada
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-secondary mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono">Vencimento: {formatDate(debt.due_date)}</span>
                      <span className="text-xs bg-secondary/80 text-secondary px-1.5 py-0.5 rounded font-sans font-bold">
                        Ref: {formatMonth(debt.due_date.substring(0, 7))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border block text-center ${DUE_STATUS_CLASSES[dueStatus]}`}>
                        {DEBT_DUE_STATUS_LABEL[dueStatus]}
                      </span>
                      <p className="mt-1"><AmountText value={debt.amount} size="sm" /></p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                    ) : (
                      <ChevronDown size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                    )}
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 pl-5 border-t border-glass bg-secondary/5 space-y-4 animate-surface-enter text-left">
                    {debt.description && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-secondary uppercase tracking-wider">Descrição</p>
                        <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">{debt.description}</p>
                      </div>
                    )}

                    {debt.expense && (
                      <div className="rounded-xl overflow-hidden border border-balance/20 bg-balance/5 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-balance" />
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-balance/10 bg-balance/5">
                          <Link2 size={13} className="text-balance shrink-0 stroke-[2.5]" />
                          <span className="text-xs uppercase font-bold tracking-wider text-balance">
                            Despesa Integrada Relacionada
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 px-4 py-3 text-xs">
                          <div className="space-y-0.5">
                            <Eyebrow>Descrição original</Eyebrow>
                            <p className="text-xs font-semibold text-primary">{debt.expense.description || 'Sem descrição'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <Eyebrow>Valor da despesa</Eyebrow>
                            <p><AmountText value={debt.expense.amount} size="sm" tone="expense" /></p>
                          </div>
                          <div className="space-y-0.5">
                            <Eyebrow>Data de lançamento</Eyebrow>
                            <p className="text-xs font-mono text-primary">{formatDate(debt.expense.date)}</p>
                          </div>
                          <div className="space-y-0.5">
                            <Eyebrow>Meio / Categoria</Eyebrow>
                            <p className="text-primary truncate" title={
                              debt.expense.payment_method === 'credit_card'
                                ? `Cartão de Crédito (${debt.expense.credit_card?.name || 'Crédito'})${debt.expense.category?.name ? ` • ${debt.expense.category.name}` : ''}`
                                : `${debt.expense.payment_method || 'Outro'}${debt.expense.category?.name ? ` • ${debt.expense.category.name}` : ''}`
                            }>
                              {debt.expense.payment_method === 'credit_card'
                                ? `Cartão (${debt.expense.credit_card?.name || 'Crédito'})`
                                : debt.expense.payment_method === 'pix' ? 'Pix'
                                : debt.expense.payment_method === 'cash' ? 'Dinheiro'
                                : debt.expense.payment_method === 'debit' ? 'Débito'
                                : debt.expense.payment_method === 'transfer' ? 'Transferência'
                                : debt.expense.payment_method || 'Outro'}
                              {debt.expense.category?.name ? ` • ${debt.expense.category.name}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-glass/50">
                      <div className="w-full sm:w-auto">
                        <Button
                          size="sm"
                          variant={isPaid ? 'outline' : isPayable ? 'expense' : 'income'}
                          onClick={() => onToggleDebtStatus(debt)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 font-bold"
                        >
                          <Check size={14} />
                          {isPaid ? 'Marcar como Pendente' : isPayable ? 'Confirmar Pagamento' : 'Confirmar Recebimento'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:items-center sm:w-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditDebt(debt)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5"
                        >
                          <Pencil size={13} />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDeleteDebt(debt.id)}
                          className="text-expense border-expense/20 hover:bg-expense/10 w-full sm:w-auto flex items-center justify-center gap-1.5"
                        >
                          <Trash2 size={13} />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {confirmedDebts.length > 0 && (
        <div className="space-y-2.5 pt-3.5 border-t border-glass mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-income" />
              Confirmadas no Mês ({confirmedDebts.length})
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {confirmedDebts.map((debt) => (
              <div
                key={debt.id}
                id={`item-${debt.id}`}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-income/5 border border-income/10 text-xs hover:bg-income/10 hover:border-income/20 transition-all select-none cursor-pointer"
                title="Clique para reabrir esta pendência"
                onClick={() => onToggleDebtStatus(debt)}
              >
                <CheckCircle2 size={13} className="text-income shrink-0 group-hover:scale-110 transition-transform stroke-[2.5]" />
                <span className="font-semibold text-primary truncate max-w-[140px]">{debt.name}</span>
                <span><AmountText value={debt.amount} size="xs" tone="income" /></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
