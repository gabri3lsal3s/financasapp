import { useState } from 'react'
import { PortfolioTransaction } from '@/types'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { Wallet, Plus, FileSpreadsheet, Trash2, CheckSquare, Square, X, Check } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { deleteLegacyInvestmentsForTransaction } from '@/utils/legacyInvestmentMigration'
import { deleteCashOffsetTransactions, fetchPortfolioCashContext } from '@/services/cashOffsetService'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import toast from 'react-hot-toast'

interface LedgerBookProps {
  transactions: PortfolioTransaction[]
  onOpenTxModal: (tx?: PortfolioTransaction) => void
  onOpenReconciliation?: () => void
  portfolioId?: string
  onSaved?: () => void
}

export default function LedgerBook({
  transactions,
  onOpenTxModal,
  onOpenReconciliation,
  portfolioId,
  onSaved,
}: LedgerBookProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // Toggle selection for a single transaction
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Toggle select all
  const handleToggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)))
    }
  }

  // Batch delete logic
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !portfolioId) return
    
    const count = selectedIds.size
    const confirmMsg = count === 1 
      ? 'Tem certeza que deseja excluir esta transação do Livro-Razão?' 
      : `Tem certeza que deseja excluir as ${count} transações selecionadas do Livro-Razão?`
      
    if (!confirm(confirmMsg)) return

    setDeleting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // Identificar transações para limpar legados e definições órfãs
      const txsToDelete = transactions.filter(t => selectedIds.has(t.id))
      const uniqueTickers = Array.from(new Set(txsToDelete.map(t => t.ticker.toUpperCase())))

      for (const tx of txsToDelete) {
        // Excluir registros legados
        await deleteLegacyInvestmentsForTransaction(supabase, user.id, tx)
        // Excluir offsets de caixa correspondentes
        await deleteCashOffsetTransactions(portfolioId, tx.id)
      }

      // Excluir transações em lote no Supabase
      const { error: deleteError } = await supabase
        .from('portfolio_transactions')
        .delete()
        .in('id', Array.from(selectedIds))
        .eq('portfolio_id', portfolioId)

      if (deleteError) throw deleteError

      // Recalcular saldo de caixa total e atualizar o portfolio
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)

      const { error: updatePortError } = await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      if (updatePortError) throw updatePortError

      // Limpar definições e metas que ficaram órfãs
      for (const tickerUpper of uniqueTickers) {
        const { data: remaining } = await supabase
          .from('portfolio_transactions')
          .select('id')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)

        if (!remaining || remaining.length === 0) {
          await supabase
            .from('portfolio_asset_definitions')
            .delete()
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)

          await supabase
            .from('target_allocations')
            .delete()
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)
        }
      }

      // Disparar atualizações de dados locais
      window.dispatchEvent(
        new CustomEvent('local-data-changed', { detail: { entity: 'investments' } })
      )
      window.dispatchEvent(
        new CustomEvent('local-data-changed', { detail: { entity: 'portfolio_transactions' } })
      )

      toast.success(count === 1 ? 'Transação excluída!' : `${count} transações excluídas!`)
      setSelectedIds(new Set())
      setIsSelectionMode(false)
      
      if (onSaved) {
        onSaved()
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao efetuar exclusão em lote.')
    } finally {
      setDeleting(false)
    }
  }

  const isAllSelected = transactions.length > 0 && selectedIds.size === transactions.length

  return (
    <Card className="p-5 lg:p-6 text-left border border-border/40 shadow-sm relative overflow-hidden">
      {deleting && (
        <div className="absolute inset-0 bg-secondary/65 backdrop-blur-[1px] flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-primary animate-pulse">Excluindo transações...</span>
          </div>
        </div>
      )}

      {/* Header com os controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-primary/5">
        <h3 className="font-bold text-base text-primary flex items-center gap-2 select-none">
          <Wallet size={18} className="text-emerald-500" />
          Livro-Razão (Transações)
        </h3>

        {!isSelectionMode ? (
          <div className="flex flex-wrap gap-2">
            {portfolioId && transactions.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSelectionMode(true)}
                className="flex items-center gap-1.5 text-xs py-1 px-2.5 transition-all border-red-500/10 text-red-500 hover:bg-red-500/10 dark:hover:text-red-300 font-semibold"
              >
                <Trash2 size={12} />
                Excluir em Massa
              </Button>
            )}
            {onOpenReconciliation && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenReconciliation}
                className="flex items-center gap-1 text-xs py-1 px-2.5 transition-all border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 dark:hover:text-emerald-300 font-semibold"
              >
                <FileSpreadsheet size={12} />
                Conciliar B3
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenTxModal()}
              className="flex items-center gap-1 text-xs py-1 px-2.5 transition-all border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 dark:hover:text-indigo-300 font-semibold"
            >
              <Plus size={12} />
              Lançar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 bg-secondary/40 p-1.5 rounded-2xl border border-primary/20 animate-page-enter">
            <span className="text-[10px] font-black font-mono text-secondary px-2 border-r border-primary/15">
              {selectedIds.size} de {transactions.length} selecionados
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1 text-[10px] py-1 px-2 transition-all font-bold border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/10"
            >
              {isAllSelected ? <CheckSquare size={11} /> : <Square size={11} />}
              {isAllSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={selectedIds.size === 0}
              onClick={handleBulkDelete}
              className="flex items-center gap-1 text-[10px] py-1 px-2 transition-all font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              <Trash2 size={11} />
              Excluir ({selectedIds.size})
            </Button>
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set())
                setIsSelectionMode(false)
              }}
              className="text-secondary hover:text-primary transition-colors p-1 rounded-lg hover:bg-secondary/80 flex items-center justify-center"
              title="Cancelar seleção"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Lista recente de transações */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {transactions.length === 0 ? (
          <p className="text-center py-6 text-xs text-secondary italic">Nenhuma transação registrada no livro-razão.</p>
        ) : (
          [...transactions].sort((a, b) => b.date.localeCompare(a.date)).map(tx => {
            const isSelected = selectedIds.has(tx.id)

            return (
              <div
                key={tx.id}
                onClick={() => {
                  if (isSelectionMode) {
                    handleToggleSelect(tx.id)
                  } else {
                    onOpenTxModal(tx)
                  }
                }}
                className={`w-full p-2.5 bg-background border rounded-xl flex items-center gap-3 text-xs transition-all text-left cursor-pointer font-sans select-none ${
                  isSelectionMode 
                    ? isSelected 
                      ? 'border-indigo-500 bg-indigo-500/5' 
                      : 'border-border/30 hover:border-indigo-500/15'
                    : 'border-border/30 hover:border-indigo-500/20 hover:bg-secondary/50'
                }`}
              >
                {/* Checkbox circular estiloso quando em seleção */}
                {isSelectionMode && (
                  <div className="shrink-0 flex items-center justify-center">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isSelected 
                        ? 'bg-indigo-500 border-indigo-500 text-white' 
                        : 'border-primary/40 bg-primary/20'
                    }`}>
                      {isSelected && <Check size={10} strokeWidth={4} />}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-primary font-mono truncate">
                      {tx.ticker === 'SALDO_INV' || tx.ticker === 'CAIXA' || tx.ticker === 'SALDO EM CAIXA' || tx.ticker === 'SALDO_EM_CAIXA'
                        ? 'Saldo em caixa'
                        : tx.ticker}
                    </strong>
                    <span
                      className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${
                        tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : tx.operation_type === 'dividend'
                          ? 'bg-indigo-500/10 text-indigo-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {tx.operation_type === 'buy' ? 'Compra' : tx.operation_type === 'sell' ? 'Venda' : tx.operation_type === 'dividend' ? 'Provento' : tx.operation_type === 'subscription' ? 'Subscrição' : 'Desdobro'}
                    </span>
                  </div>
                  <div className="text-[10px] text-secondary mt-0.5 flex items-center gap-1.5 font-sans">
                    <span className="font-mono">{formatNumberBR(tx.quantity)} un</span>
                    <span>•</span>
                    <span className="font-mono">{formatCurrency(tx.price)}</span>
                    <span>•</span>
                    <span className="font-mono">Total: {formatCurrency(Number(tx.quantity) * Number(tx.price))}</span>
                  </div>
                </div>
                <span className="text-[10px] text-secondary font-medium font-mono shrink-0 select-none">{tx.date}</span>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
