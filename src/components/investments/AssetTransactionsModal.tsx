import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  Scissors,
  BarChart2,
  Wallet,
  Activity,
  Check,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/utils/format'
import type { PortfolioTransaction, PortfolioOperationType } from '@/types'
import type { AssetPosition } from '@/services/investmentEngine'
import PortfolioTransactionFormModal from './PortfolioTransactionFormModal'
import { deleteCashOffsetTransactions, fetchPortfolioCashContext } from '@/services/cashOffsetService'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const OP_CONFIG: Record<PortfolioOperationType, {
  label: string
  textCls: string
  bgCls: string
  borderCls: string
  icon: React.ReactNode
}> = {
  buy: {
    label: 'Compra',
    textCls: 'text-indigo-600 dark:text-indigo-400',
    bgCls: 'bg-indigo-50 dark:bg-indigo-500/10',
    borderCls: 'border-indigo-200 dark:border-indigo-500/25',
    icon: <ArrowUpRight size={13} />,
  },
  sell: {
    label: 'Venda',
    textCls: 'text-rose-600 dark:text-rose-400',
    bgCls: 'bg-rose-50 dark:bg-rose-500/10',
    borderCls: 'border-rose-200 dark:border-rose-500/25',
    icon: <ArrowDownRight size={13} />,
  },
  dividend: {
    label: 'Provento',
    textCls: 'text-emerald-700 dark:text-emerald-400',
    bgCls: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderCls: 'border-emerald-200 dark:border-emerald-500/25',
    icon: <Gift size={13} />,
  },
  split: {
    label: 'Desdobramento',
    textCls: 'text-amber-700 dark:text-amber-400',
    bgCls: 'bg-amber-50 dark:bg-amber-500/10',
    borderCls: 'border-amber-200 dark:border-amber-500/25',
    icon: <Scissors size={13} />,
  },
  subscription: {
    label: 'Subscrição',
    textCls: 'text-violet-700 dark:text-violet-400',
    bgCls: 'bg-violet-50 dark:bg-violet-500/10',
    borderCls: 'border-violet-200 dark:border-violet-500/25',
    icon: <BarChart2 size={13} />,
  },
}

const OP_OPTIONS: { value: PortfolioOperationType; label: string }[] = [
  { value: 'buy', label: 'Compra' },
  { value: 'sell', label: 'Venda' },
  { value: 'dividend', label: 'Provento' },
  { value: 'split', label: 'Desdobramento' },
  { value: 'subscription', label: 'Subscrição' },
]

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/* ─── Inline Edit Form ───────────────────────────────────────────────────── */

interface InlineEditFormProps {
  tx: PortfolioTransaction
  portfolioId: string
  onSaved: () => void
  onCancel: () => void
}

function InlineEditForm({ tx, portfolioId, onSaved, onCancel }: InlineEditFormProps) {
  const [operationType, setOperationType] = useState<PortfolioOperationType>(tx.operation_type)
  const [quantity, setQuantity] = useState(String(tx.quantity))
  const [price, setPrice] = useState(String(tx.price))
  const [date, setDate] = useState(tx.date)
  const [saving, setSaving] = useState(false)
  const quantityRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    quantityRef.current?.focus()
    quantityRef.current?.select()
  }, [])

  const handleSave = async () => {
    const qty = parseFloat(quantity)
    const unitPrice = parseFloat(price)
    if (!qty || !unitPrice || qty <= 0 || unitPrice <= 0) {
      toast.error('Quantidade e preço devem ser positivos')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('portfolio_transactions')
        .update({ operation_type: operationType, quantity: qty, price: unitPrice, date })
        .eq('id', tx.id)
        .eq('portfolio_id', portfolioId)
      if (error) throw error
      toast.success('Transação atualizada!')
      onSaved()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = `
    w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border
    bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]
    border-[var(--color-border)] focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30
    outline-none transition-colors
  `

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div className="mx-3 mb-2 p-3 rounded-xl border border-indigo-300/40 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/5">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Operação */}
          <div>
            <label className="text-[9px] uppercase font-bold text-[var(--color-text-secondary)] tracking-wider block mb-1">
              Operação
            </label>
            <select
              value={operationType}
              onChange={e => setOperationType(e.target.value as PortfolioOperationType)}
              disabled={saving}
              className={inputCls + ' appearance-none'}
            >
              {OP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="text-[9px] uppercase font-bold text-[var(--color-text-secondary)] tracking-wider block mb-1">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              disabled={saving}
              className={inputCls}
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="text-[9px] uppercase font-bold text-[var(--color-text-secondary)] tracking-wider block mb-1">
              Quantidade
            </label>
            <input
              ref={quantityRef}
              type="number"
              step="any"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              disabled={saving}
              className={inputCls}
              placeholder="Ex: 100"
            />
          </div>

          {/* Preço */}
          <div>
            <label className="text-[9px] uppercase font-bold text-[var(--color-text-secondary)] tracking-wider block mb-1">
              Preço unitário
            </label>
            <input
              type="number"
              step="any"
              value={price}
              onChange={e => setPrice(e.target.value)}
              disabled={saving}
              className={inputCls}
              placeholder="Ex: 22,50"
            />
          </div>
        </div>

        {/* Preview total */}
        {quantity && price && parseFloat(quantity) > 0 && parseFloat(price) > 0 && (
          <p className="text-[10px] text-[var(--color-text-secondary)] font-mono mb-2 text-right">
            Total: <span className="font-bold text-[var(--color-text-primary)]">
              {formatCurrency(parseFloat(quantity) * parseFloat(price))}
            </span>
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={11} />
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-sm disabled:opacity-60"
          >
            {saving ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={11} />
            )}
            Salvar
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface AssetTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  position: AssetPosition | null
  allTransactions: PortfolioTransaction[]
  portfolioId: string
  onSaved: () => void
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function AssetTransactionsModal({
  isOpen,
  onClose,
  position,
  allTransactions,
  portfolioId,
  onSaved,
}: AssetTransactionsModalProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)

  // Sub-modal de lançamento completo
  const [isTxFormOpen, setIsTxFormOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<PortfolioTransaction | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
      setConfirmDeleteId(null)
      setInlineEditId(null)
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isTxFormOpen) { e.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose, isTxFormOpen])

  const assetTxs = useMemo(() => {
    if (!position) return []
    return allTransactions
      .filter(tx =>
        tx.ticker.toUpperCase() === position.ticker.toUpperCase() &&
        !tx.cash_offset_source_id
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [allTransactions, position])

  const metrics = useMemo(() => {
    const buys  = assetTxs.filter(t => t.operation_type === 'buy' || t.operation_type === 'subscription')
    const divs  = assetTxs.filter(t => t.operation_type === 'dividend')
    const totalDivs = divs.reduce((s, t) => s + t.quantity * t.price, 0)
    return { buys: buys.length, divs: divs.length, totalDivs }
  }, [assetTxs])

  const handleDelete = async (tx: PortfolioTransaction) => {
    if (confirmDeleteId !== tx.id) { setConfirmDeleteId(tx.id); return }
    setDeletingId(tx.id)
    setConfirmDeleteId(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      await deleteCashOffsetTransactions(portfolioId, tx.id)
      const { error } = await supabase.from('portfolio_transactions')
        .delete().eq('id', tx.id).eq('portfolio_id', portfolioId)
      if (error) throw error
      const ctx = await fetchPortfolioCashContext(portfolioId)
      const finalCash = calculateLedgerCashBalance(ctx.transactions, ctx.definitions)
      await supabase.from('portfolios').update({ cash_balance: finalCash }).eq('id', portfolioId)
      const { data: remaining } = await supabase.from('portfolio_transactions')
        .select('id').eq('portfolio_id', portfolioId).eq('ticker', tx.ticker.toUpperCase())
      if (!remaining || remaining.length === 0) {
        await supabase.from('portfolio_asset_definitions').delete()
          .eq('portfolio_id', portfolioId).eq('ticker', tx.ticker.toUpperCase())
        await supabase.from('target_allocations').delete()
          .eq('portfolio_id', portfolioId).eq('ticker', tx.ticker.toUpperCase())
      }
      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'portfolio_transactions' } }))
      toast.success('Transação excluída!')
      onSaved()
    } catch {
      toast.error('Erro ao excluir transação')
    } finally {
      setDeletingId(null)
    }
  }

  const handleInlineSaved = () => {
    setInlineEditId(null)
    onSaved()
  }

  const handleAddNew = () => { setEditingTx(null); setIsTxFormOpen(true) }
  const handleFormSaved = () => { setIsTxFormOpen(false); setEditingTx(null); onSaved() }

  const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
  const panelVariants = isMobile
    ? { hidden: { y: '100%' }, visible: { y: 0 }, exit: { y: '100%' } }
    : { hidden: { opacity: 0, scale: 0.97, y: 20 }, visible: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 20 } }

  if (!position) return null

  const isPositive = (position.gross_yield_pct ?? 0) >= 0
  const gainLoss = position.total_value - position.cost_basis

  // Accent color classes based on trend — using semantic CSS variables for cyber-compat
  const accentBg = isPositive
    ? 'bg-emerald-50 dark:bg-emerald-500/10'
    : 'bg-rose-50 dark:bg-rose-500/10'
  const accentBorder = isPositive
    ? 'border-emerald-200 dark:border-emerald-500/25'
    : 'border-rose-200 dark:border-rose-500/25'
  const accentText = isPositive
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-rose-700 dark:text-rose-400'
  const accentIcon = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400'
  const gradientBar = isPositive
    ? 'from-indigo-400 via-emerald-400 to-indigo-400'
    : 'from-rose-400 via-rose-300 to-rose-400'

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          /* Z-index set to 1000 so the floating calculator (z-1001) can appear above */
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              variants={overlayVariants}
              initial="hidden" animate="visible" exit="exit"
              transition={{ duration: 0.22 }}
              className="fixed inset-0 bg-black/55 dark:bg-black/70 backdrop-blur-[2px]"
              onClick={onClose}
            />

            {/* Panel */}
            <motion.div
              variants={panelVariants}
              initial="hidden" animate="visible" exit="exit"
              transition={isMobile
                ? { type: 'spring', damping: 30, stiffness: 280 }
                : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
              }
              role="dialog"
              aria-modal="true"
              onClick={e => e.stopPropagation()}
              className={[
                'relative flex flex-col z-[1001] w-full overflow-hidden',
                'max-h-[92vh] sm:max-h-[calc(100vh-2.5rem)]',
                // ─ Use CSS vars so ALL themes (default, cyber light/dark) work ─
                'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]',
                'shadow-[0_24px_56px_-10px_rgba(0,0,0,0.28)]',
                isMobile
                  ? 'rounded-t-[1.75rem] border-t border-[var(--color-border)]'
                  : 'rounded-2xl border border-[var(--color-border)] max-w-[640px]',
              ].join(' ')}
            >
              {/* Mobile pill */}
              {isMobile && (
                <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 shrink-0 bg-[var(--color-border)]" />
              )}

              {/* Gradient accent top bar */}
              <div className={`absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r ${gradientBar}`} />

              {/* ── Header ─────────────────────────────────────────────── */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4 shrink-0 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${accentBg} ${accentBorder}`}>
                    <Activity size={17} className={accentIcon} />
                  </div>

                  {/* Text */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-black tracking-tight font-mono leading-none text-[var(--color-text-primary)]">
                        {position.ticker}
                      </h2>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${accentBg} ${accentBorder} ${accentText}`}>
                        {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {isPositive ? '+' : ''}{position.gross_yield_pct.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 truncate max-w-[260px] text-[var(--color-text-secondary)]">
                      {[position.asset_class, position.sector].filter(Boolean).join('  ·  ') || 'Não classificado'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* ── KPI Strip ──────────────────────────────────────────── */}
              <div className="mx-4 mb-3.5 grid grid-cols-3 rounded-xl overflow-hidden border border-[var(--color-border)] shrink-0">
                <div className="px-3 py-2.5 text-center bg-[var(--color-bg-secondary)] relative">
                  <div className="absolute right-0 top-[20%] bottom-[20%] w-px bg-[var(--color-border)]" />
                  <p className="text-[9px] uppercase font-bold tracking-widest mb-0.5 text-[var(--color-text-secondary)]">Posição</p>
                  <p className="font-mono font-black text-sm text-[var(--color-text-primary)]">{formatCurrency(position.total_value)}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">{position.quantity.toLocaleString('pt-BR')} cotas</p>
                </div>
                <div className="px-3 py-2.5 text-center bg-[var(--color-bg-secondary)] relative">
                  <div className="absolute right-0 top-[20%] bottom-[20%] w-px bg-[var(--color-border)]" />
                  <p className="text-[9px] uppercase font-bold tracking-widest mb-0.5 text-[var(--color-text-secondary)]">Resultado</p>
                  <p className={`font-mono font-black text-sm ${gainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">custo {formatCurrency(position.cost_basis)}</p>
                </div>
                <div className="px-3 py-2.5 text-center bg-[var(--color-bg-secondary)]">
                  <p className="text-[9px] uppercase font-bold tracking-widest mb-0.5 text-[var(--color-text-secondary)]">Proventos</p>
                  <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(metrics.totalDivs)}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">{metrics.divs} evento{metrics.divs !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* ── Section label ──────────────────────────────────────── */}
              <div className="flex items-center gap-2.5 px-5 mb-1.5 shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                  Histórico de Transações
                </span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-[9px] font-bold text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  {assetTxs.length}
                </span>
              </div>

              {/* ── Transaction List ────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto pb-2">
                {assetTxs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <Wallet size={22} className="text-[var(--color-text-secondary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-secondary)] mb-1">Nenhum lançamento</p>
                      <p className="text-xs text-[var(--color-text-secondary)] opacity-60 max-w-[200px]">
                        Clique em "Novo" para registrar o primeiro lançamento
                      </p>
                    </div>
                    <button
                      onClick={handleAddNew}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      <Plus size={13} />
                      Lançar Transação
                    </button>
                  </div>
                ) : (
                  <div>
                    {assetTxs.map((tx, idx) => {
                      const cfg = OP_CONFIG[tx.operation_type]
                      const total = tx.quantity * tx.price
                      const isDeleting = deletingId === tx.id
                      const isConfirming = confirmDeleteId === tx.id
                      const isEditing = inlineEditId === tx.id

                      return (
                        <div key={tx.id}>
                          {/* ─ Row ─ */}
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.025, duration: 0.15 }}
                            className={[
                              'group flex items-center gap-3 px-4 py-3 transition-colors',
                              isEditing
                                ? 'bg-indigo-50/40 dark:bg-indigo-500/5'
                                : 'hover:bg-[var(--color-bg-secondary)]',
                              isDeleting ? 'opacity-40 pointer-events-none' : '',
                              isConfirming ? 'bg-rose-50/40 dark:bg-rose-500/5' : '',
                            ].join(' ')}
                          >
                            {/* Op icon */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bgCls} ${cfg.borderCls} ${cfg.textCls}`}>
                              {cfg.icon}
                            </div>

                            {/* Main info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textCls}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-secondary)]">
                                  {formatDateBR(tx.date)}
                                </span>
                              </div>
                              {tx.operation_type === 'split' ? (
                                <p className="text-xs font-mono text-[var(--color-text-secondary)]">
                                  Fator <span className="font-bold text-[var(--color-text-primary)]">{tx.quantity}×</span>
                                </p>
                              ) : (
                                <p className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
                                  <span className="font-semibold text-[var(--color-text-primary)]">
                                    {tx.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                                  </span>
                                  <span className="opacity-40 mx-1">×</span>
                                  {formatCurrency(tx.price)}
                                </p>
                              )}
                            </div>

                            {/* Total + actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="text-right mr-1">
                                <p className={`text-sm font-black font-mono leading-none ${
                                  tx.operation_type === 'sell'     ? 'text-rose-600 dark:text-rose-400' :
                                  tx.operation_type === 'dividend' ? 'text-emerald-600 dark:text-emerald-400' :
                                  'text-[var(--color-text-primary)]'
                                }`}>
                                  {tx.operation_type === 'sell' ? '−' :
                                   tx.operation_type === 'dividend' ? '+' : ''}
                                  {formatCurrency(total)}
                                </p>
                                <p className="text-[9px] text-[var(--color-text-secondary)] uppercase tracking-wide">
                                  total
                                </p>
                              </div>

                              {/* Confirm delete */}
                              {isConfirming ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(tx)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                                  >
                                    <Trash2 size={9} />
                                    Excluir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                                  {/* Inline edit toggle */}
                                  <button
                                    type="button"
                                    onClick={() => setInlineEditId(isEditing ? null : tx.id)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                                      isEditing
                                        ? 'bg-indigo-500/15 text-indigo-500'
                                        : 'text-[var(--color-text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10'
                                    }`}
                                    title={isEditing ? 'Fechar edição' : 'Edição rápida'}
                                  >
                                    {isEditing ? <ChevronDown size={12} /> : <Edit2 size={12} />}
                                  </button>
                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(tx)}
                                    disabled={isDeleting}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                    title="Excluir"
                                  >
                                    {isDeleting
                                      ? <div className="w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                      : <Trash2 size={12} />
                                    }
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>

                          {/* ─ Inline edit form ─ */}
                          <AnimatePresence>
                            {isEditing && (
                              <InlineEditForm
                                key={`edit-${tx.id}`}
                                tx={tx}
                                portfolioId={portfolioId}
                                onSaved={handleInlineSaved}
                                onCancel={() => setInlineEditId(null)}
                              />
                            )}
                          </AnimatePresence>

                          {/* Divider */}
                          {idx < assetTxs.length - 1 && (
                            <div className="mx-4 h-px bg-[var(--color-border)] opacity-50" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Footer ─────────────────────────────────────────────── */}
              <div className="px-5 py-3 border-t border-[var(--color-border)] shrink-0 flex items-center justify-between gap-3 bg-[var(--color-bg-secondary)]">
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {assetTxs.length} transaç{assetTxs.length === 1 ? 'ão' : 'ões'}
                  {metrics.buys > 0 && (
                    <span className="opacity-60 ml-1.5">· {metrics.buys} compra{metrics.buys !== 1 ? 's' : ''}</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/20 rounded-xl transition-colors"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Novo Lançamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sub-modal de lançamento completo — z-[1200] para ficar acima de tudo */}
      {portfolioId && (
        <PortfolioTransactionFormModal
          isOpen={isTxFormOpen}
          onClose={() => { setIsTxFormOpen(false); setEditingTx(null) }}
          portfolioId={portfolioId}
          editingTransaction={editingTx}
          onSaved={handleFormSaved}
          defaultTicker={position.ticker}
          zIndexClass="z-[1200]"
        />
      )}
    </>,
    document.body
  )
}
