import { useMemo, useState } from 'react'
import { Search, TrendingDown, TrendingUp } from 'lucide-react'
import { useDashboardData } from '@/contexts/DashboardDataContext'
import { formatCurrency } from '@/utils/format'
import { applyReportWeight } from '@/utils/reportWeight'
import Modal from '@/components/Modal'
import TransactionRow from '@/components/TransactionRow'
import Input from '@/components/Input'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DashboardCategoryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  categoryId: string
  categoryName: string
  color: string
  type?: 'expense' | 'income'
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function DashboardCategoryDetailModal({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  color,
  type = 'expense',
}: DashboardCategoryDetailModalProps) {
  const ctx = useDashboardData()
  const [search, setSearch] = useState('')

  // Filtra os lançamentos da categoria
  const items = useMemo(() => {
    if (!isOpen) return []

    if (type === 'expense') {
      return ctx.expenses
        .filter((e) => (e.category?.id || e.category_id) === categoryId)
        .map((e) => ({
          id: e.id,
          description: e.description || e.category?.name || 'Despesa',
          date: e.date,
          amount: applyReportWeight(e.amount, e.report_weight),
          originalAmount: e.amount,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    return ctx.incomes
      .filter((i) => (i.income_category?.id || i.income_category_id) === categoryId)
      .map((i) => ({
        id: i.id,
        description: i.description || i.income_category?.name || 'Renda',
        date: i.date,
        amount: applyReportWeight(i.amount, i.report_weight),
        originalAmount: i.amount,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [ctx, isOpen, categoryId, type])

  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items])

  // Percentual sobre o total geral
  const grandTotal = type === 'expense' ? ctx.totalExpenses : ctx.totalIncomes
  const pctOfTotal = grandTotal > 0 ? (total / grandTotal) * 100 : 0

  // Filtro por busca textual
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.description.toLowerCase().includes(q))
  }, [items, search])

  const Icon = type === 'expense' ? TrendingDown : TrendingUp

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { setSearch(''); onClose() }}
      title={`${type === 'expense' ? 'Despesas' : 'Rendas'} • ${categoryName}`}
      header={
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon size={12} style={{ color }} />
          </div>
          <span className="text-base font-bold uppercase tracking-tight text-primary">
            {type === 'expense' ? 'Despesas' : 'Rendas'} • {categoryName}
          </span>
        </div>
      }
    >
      <div className="modal-body-stack">
        {/* Card de Total */}
        <div className="rounded-xl border border-glass surface-glass p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-secondary uppercase font-bold tracking-wider">
                Total em {ctx.currentMonth}
              </p>
              <p className="text-lg font-extrabold text-primary font-mono mt-0.5">
                {formatCurrency(total)}
              </p>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-full"
              style={{
                backgroundColor: `${color}15`,
                color,
              }}
            >
              {pctOfTotal.toFixed(1)}% do total
            </span>
          </div>
          <p className="text-[10px] text-secondary mt-2">
            {items.length} lançamento{items.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Busca */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
            Buscar lançamentos
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50 pointer-events-none"
            />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite parte da descrição..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-secondary py-8 text-center">
              {search
                ? 'Nenhum lançamento encontrado para esta busca.'
                : 'Nenhum lançamento registrado.'}
            </p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="animate-stagger-item"
              >
                <TransactionRow
                  description={item.description}
                  date={item.date}
                  amount={item.amount}
                  originalAmount={item.originalAmount}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
