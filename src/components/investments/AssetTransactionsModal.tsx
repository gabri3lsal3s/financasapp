import { useState, useEffect, useMemo, useRef } from 'react'
import {
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
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatCurrencyByCode, formatQuantityBR, formatSignedPercentBR } from '@/utils/format'
import type { PortfolioTransaction, PortfolioOperationType } from '@/types'
import type { AssetPosition } from '@/services/investmentEngine'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import PortfolioTransactionFormModal from './PortfolioTransactionFormModal'
import { deleteCashOffsetTransactions, fetchPortfolioCashContext } from '@/services/cashOffsetService'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import { isPortfolioIncomeType, PORTFOLIO_OPERATION_OPTIONS } from '@/utils/portfolioOperations'
import { cn } from '@/lib/utils'

const OP_CONFIG: Record<PortfolioOperationType, {
  label: string
  textCls: string
  bgCls: string
  borderCls: string
  icon: React.ReactNode
}> = {
  buy: {
    label: 'Compra',
    textCls: 'text-balance',
    bgCls: 'bg-balance/10',
    borderCls: 'border-glass',
    icon: <ArrowUpRight size={13} />,
  },
  sell: {
    label: 'Venda',
    textCls: 'text-expense',
    bgCls: 'bg-expense/10',
    borderCls: 'border-glass',
    icon: <ArrowDownRight size={13} />,
  },
  dividend: {
    label: 'Dividendo',
    textCls: 'text-income',
    bgCls: 'bg-income/10',
    borderCls: 'border-glass',
    icon: <Gift size={13} />,
  },
  jcp: {
    label: 'JCP',
    textCls: 'text-income',
    bgCls: 'bg-income/10',
    borderCls: 'border-glass',
    icon: <Gift size={13} />,
  },
  fii_yield: {
    label: 'Rendimento (FII)',
    textCls: 'text-income',
    bgCls: 'bg-income/10',
    borderCls: 'border-glass',
    icon: <Gift size={13} />,
  },
  split: {
    label: 'Desdobramento',
    textCls: 'text-secondary',
    bgCls: 'bg-accent',
    borderCls: 'border-glass',
    icon: <Scissors size={13} />,
  },
  reverse_split: {
    label: 'Grupamento',
    textCls: 'text-secondary',
    bgCls: 'bg-accent',
    borderCls: 'border-glass',
    icon: <Scissors size={13} />,
  },
  subscription: {
    label: 'Subscrição',
    textCls: 'text-balance',
    bgCls: 'bg-balance/10',
    borderCls: 'border-glass',
    icon: <BarChart2 size={13} />,
  },
}

const OP_OPTIONS = PORTFOLIO_OPERATION_OPTIONS

const inlineInputClass =
  'w-full rounded-lg border border-glass bg-[var(--glass-input-bg)] px-2.5 py-1.5 text-xs font-mono text-primary outline-none transition-colors focus:ring-2 focus:ring-ring motion-standard'

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

interface InlineEditFormProps {
  tx: PortfolioTransaction
  portfolioId: string
  currency?: 'BRL' | 'USD'
  onSaved: () => void
  onCancel: () => void
}

function InlineEditForm({ tx, portfolioId, currency, onSaved, onCancel }: InlineEditFormProps) {
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

  return (
    <div className="overflow-hidden">
      <div className="mx-3 mb-2 rounded-xl border border-glass modal-panel-glass p-3">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-secondary">
              Operação
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as PortfolioOperationType)}
              disabled={saving}
              className={cn(inlineInputClass, 'appearance-none')}
            >
              {OP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-secondary">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              className={inlineInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-secondary">
              Quantidade
            </label>
            <input
              ref={quantityRef}
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={saving}
              className={inlineInputClass}
              placeholder="Ex: 100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-secondary">
              Preço unitário
            </label>
            <input
              type="number"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={saving}
              className={inlineInputClass}
              placeholder="Ex: 22,50"
            />
          </div>
        </div>

        {quantity && price && parseFloat(quantity) > 0 && parseFloat(price) > 0 && (
          <p className="mb-2 text-right font-mono text-[10px] text-secondary">
            Total:{' '}
            <span className="font-bold text-primary">
              {formatCurrencyByCode(parseFloat(quantity) * parseFloat(price), currency)}
            </span>
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg border border-glass px-3 py-1.5 text-[11px] font-semibold text-secondary motion-standard hover:bg-accent hover:text-primary"
          >
            <X size={11} />
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg border border-[var(--ds-color-accent-primary)]/25 bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Check size={11} />
            )}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

interface AssetTransactionsModalProps {
  isOpen: boolean
  onClose: () => void
  position: AssetPosition | null
  allTransactions: PortfolioTransaction[]
  portfolioId: string
  onSaved: () => void
}

export default function AssetTransactionsModal({
  isOpen,
  onClose,
  position,
  allTransactions,
  portfolioId,
  onSaved,
}: AssetTransactionsModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [isTxFormOpen, setIsTxFormOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<PortfolioTransaction | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteId(null)
      setInlineEditId(null)
      setIsTxFormOpen(false)
      setEditingTx(null)
    }
  }, [isOpen])

  const assetTxs = useMemo(() => {
    if (!position) return []
    return allTransactions
      .filter(
        (tx) =>
          tx.ticker.toUpperCase() === position.ticker.toUpperCase() && !tx.cash_offset_source_id
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [allTransactions, position])

  const metrics = useMemo(() => {
    const buys = assetTxs.filter(
      (t) => t.operation_type === 'buy' || t.operation_type === 'subscription'
    )
    const divs = assetTxs.filter((t) => isPortfolioIncomeType(t.operation_type))
    const totalDivs = divs.reduce((s, t) => s + t.quantity * t.price, 0)
    return { buys: buys.length, divs: divs.length, totalDivs }
  }, [assetTxs])

  const handleDelete = async (tx: PortfolioTransaction) => {
    if (confirmDeleteId !== tx.id) {
      setConfirmDeleteId(tx.id)
      return
    }
    setDeletingId(tx.id)
    setConfirmDeleteId(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      await deleteCashOffsetTransactions(portfolioId, tx.id)
      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', tx.id)
        .eq('portfolio_id', portfolioId)
      if (error) throw error
      const ctx = await fetchPortfolioCashContext(portfolioId)
      const finalCash = calculateLedgerCashBalance(ctx.transactions, ctx.definitions)
      await supabase.from('portfolios').update({ cash_balance: finalCash }).eq('id', portfolioId)
      await cleanupOrphanPortfolioTickers(portfolioId, [tx.ticker])
      window.dispatchEvent(
        new CustomEvent('local-data-changed', { detail: { entity: 'portfolio_transactions' } })
      )
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

  const handleAddNew = () => {
    setEditingTx(null)
    setIsTxFormOpen(true)
  }

  const handleFormSaved = () => {
    setIsTxFormOpen(false)
    setEditingTx(null)
    onSaved()
  }

  if (!position) return null

  const isPositive = (position.gross_yield_pct ?? 0) >= 0
  const gainLoss = position.total_value - position.cost_basis
  const accentBg = isPositive ? 'bg-income/10' : 'bg-expense/10'
  const accentBorder = 'border-glass'
  const accentText = isPositive ? 'text-income' : 'text-expense'
  const accentIcon = isPositive ? 'text-income' : 'text-expense'
  const gradientBar = isPositive
    ? 'from-[var(--color-balance)] via-[var(--color-income)] to-[var(--color-balance)]'
    : 'from-[var(--color-expense)] via-[var(--color-expense)]/60 to-[var(--color-expense)]'

  const modalHeader = (
    <div className="relative">
      <div className={cn('absolute inset-x-0 -top-3 h-0.5 bg-gradient-to-r', gradientBar)} aria-hidden />
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            accentBg,
            accentBorder
          )}
        >
          <Activity size={17} className={accentIcon} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-black leading-none tracking-tight text-primary">
              {position.ticker}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                accentBg,
                accentBorder,
                accentText
              )}
            >
              {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {formatSignedPercentBR(position.gross_yield_pct)}
            </span>
          </div>
          <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-secondary">
            {[position.asset_class, position.sector].filter(Boolean).join('  ·  ') || 'Não classificado'}
          </p>
        </div>
      </div>
    </div>
  )

  const modalFooter = (
    <div className="modal-footer-info">
      <p className="text-[11px] text-secondary">
        {assetTxs.length} transaç{assetTxs.length === 1 ? 'ão' : 'ões'}
        {metrics.buys > 0 && (
          <span className="ml-1.5 opacity-60">
            · {metrics.buys} compra{metrics.buys !== 1 ? 's' : ''}
          </span>
        )}
      </p>
      <Button type="button" size="sm" variant="outline" onClick={handleAddNew} className="gap-1.5">
        <Plus size={12} strokeWidth={2.5} />
        Novo lançamento
      </Button>
    </div>
  )

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${position.ticker} — histórico de transações`}
        header={modalHeader}
        footer={modalFooter}
        size="xl"
        bodyClassName="flex flex-col"
      >
        <div className="mb-3.5 grid w-full shrink-0 grid-cols-3 overflow-hidden rounded-xl border border-glass">
          <div className="relative border-glass modal-panel-glass px-3 py-2.5 text-center">
            <div className="absolute bottom-[20%] right-0 top-[20%] w-px bg-[var(--glass-border)]" />
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-secondary">Posição</p>
            <p className="font-mono text-sm font-black text-primary">
              {formatCurrencyByCode(position.total_value, position.currency)}
            </p>
            <p className="text-[10px] text-secondary">{formatQuantityBR(position.quantity)} cotas</p>
          </div>
          <div className="relative border-glass modal-panel-glass px-3 py-2.5 text-center">
            <div className="absolute bottom-[20%] right-0 top-[20%] w-px bg-[var(--glass-border)]" />
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-secondary">Resultado</p>
            <p
              className={cn(
                'font-mono text-sm font-black',
                gainLoss >= 0 ? 'text-income' : 'text-expense'
              )}
            >
              {gainLoss >= 0 ? '+' : ''}
              {formatCurrencyByCode(gainLoss, position.currency)}
            </p>
            <p className="text-[10px] text-secondary">
              custo {formatCurrencyByCode(position.cost_basis, position.currency)}
            </p>
          </div>
          <div className="modal-panel-glass px-3 py-2.5 text-center">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-secondary">Proventos</p>
            <p className="font-mono text-sm font-black text-income">
              {formatCurrencyByCode(metrics.totalDivs, position.currency)}
            </p>
            <p className="text-[10px] text-secondary">
              {metrics.divs} evento{metrics.divs !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="mb-1.5 flex w-full shrink-0 items-center gap-2.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-secondary">
            Histórico de transações
          </span>
          <div className="h-px flex-1 bg-[var(--glass-border)]" />
          <span className="rounded-full border border-glass modal-panel-glass px-1.5 py-0.5 text-[9px] font-bold text-secondary">
            {assetTxs.length}
          </span>
        </div>

        {assetTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-glass modal-panel-glass">
              <Wallet size={22} className="text-secondary" />
            </div>
            <div>
              <p className="mb-1 text-sm font-bold text-secondary">Nenhum lançamento</p>
              <p className="max-w-[200px] text-xs text-secondary opacity-80">
                Clique em &quot;Novo lançamento&quot; para registrar o primeiro evento
              </p>
            </div>
            <Button type="button" size="sm" onClick={handleAddNew} className="gap-1.5">
              <Plus size={13} />
              Lançar transação
            </Button>
          </div>
        ) : (
          <div className="pb-2">
            {assetTxs.map((tx, idx) => {
              const cfg = OP_CONFIG[tx.operation_type]
              const total = tx.quantity * tx.price
              const isDeleting = deletingId === tx.id
              const isConfirming = confirmDeleteId === tx.id
              const isEditing = inlineEditId === tx.id

              return (
                <div key={tx.id}>
                  <div
                    className={cn(
                      'group flex items-center gap-3 px-4 py-3 motion-standard',
                      isEditing && 'bg-accent/40',
                      !isEditing && 'hover:bg-accent/30',
                      isDeleting && 'pointer-events-none opacity-40',
                      isConfirming && 'bg-expense/10'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                        cfg.bgCls,
                        cfg.borderCls,
                        cfg.textCls
                      )}
                    >
                      {cfg.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-bold uppercase tracking-wider', cfg.textCls)}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-secondary">{formatDateBR(tx.date)}</span>
                      </div>
                      {tx.operation_type === 'split' ? (
                        <p className="font-mono text-xs text-secondary">
                          +{' '}
                          <span className="font-bold text-primary">
                            {formatQuantityBR(tx.quantity, 6)}
                          </span>{' '}
                          cotas creditadas
                        </p>
                      ) : tx.operation_type === 'reverse_split' ? (
                        <p className="font-mono text-xs text-secondary">
                          −{' '}
                          <span className="font-bold text-primary">
                            {formatQuantityBR(tx.quantity, 6)}
                          </span>{' '}
                          cotas canceladas
                        </p>
                      ) : (
                        <p className="truncate font-mono text-xs text-secondary">
                          <span className="font-semibold text-primary">
                            {formatQuantityBR(tx.quantity, 6)}
                          </span>
                          <span className="mx-1 opacity-40">×</span>
                          {formatCurrencyByCode(tx.price, position.currency)}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="mr-1 text-right">
                        <p
                          className={cn(
                            'font-mono text-sm font-black leading-none',
                            tx.operation_type === 'sell'
                              ? 'text-expense'
                              : isPortfolioIncomeType(tx.operation_type)
                                ? 'text-income'
                                : 'text-primary'
                          )}
                        >
                          {tx.operation_type === 'sell'
                            ? '−'
                            : isPortfolioIncomeType(tx.operation_type)
                              ? '+'
                              : ''}
                          {formatCurrencyByCode(total, position.currency)}
                        </p>
                        <p className="text-[9px] uppercase tracking-wide text-secondary">total</p>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(tx)}
                            className="flex items-center gap-1 rounded-lg bg-expense px-2 py-1 text-[10px] font-bold text-primary-foreground motion-standard hover:opacity-90"
                          >
                            <Trash2 size={9} />
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-secondary motion-standard hover:bg-accent hover:text-primary"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setInlineEditId(isEditing ? null : tx.id)}
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-lg motion-standard',
                              isEditing
                                ? 'bg-accent text-primary'
                                : 'text-secondary hover:bg-accent hover:text-primary'
                            )}
                            title={isEditing ? 'Fechar edição' : 'Edição rápida'}
                          >
                            {isEditing ? <ChevronDown size={12} /> : <Edit2 size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tx)}
                            disabled={isDeleting}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary motion-standard hover:bg-expense/10 hover:text-expense"
                            title="Excluir"
                          >
                            {isDeleting ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-expense border-t-transparent" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <InlineEditForm
                      tx={tx}
                      portfolioId={portfolioId}
                      currency={position.currency}
                      onSaved={handleInlineSaved}
                      onCancel={() => setInlineEditId(null)}
                    />
                  )}

                  {idx < assetTxs.length - 1 && (
                    <div className="mx-4 h-px bg-[var(--glass-border)] opacity-50" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      {portfolioId && (
        <PortfolioTransactionFormModal
          isOpen={isTxFormOpen}
          onClose={() => {
            setIsTxFormOpen(false)
            setEditingTx(null)
          }}
          portfolioId={portfolioId}
          editingTransaction={editingTx}
          onSaved={handleFormSaved}
          defaultTicker={position.ticker}
          zIndexClass="z-[1200]"
        />
      )}
    </>
  )
}
