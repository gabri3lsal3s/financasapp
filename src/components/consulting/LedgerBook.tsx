import { useState, useMemo } from 'react'
import { PortfolioTransaction } from '@/types'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { Wallet, Plus, FileSpreadsheet, Trash2, CheckSquare, Square, X, Check } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { deleteCashOffsetTransactionsMultiple, fetchPortfolioCashContext } from '@/services/cashOffsetService'
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingProgress, setDeletingProgress] = useState('')

  // Filtra as transações para exibir apenas movimentações manuais no livro-razão
  const visibleTransactions = useMemo(() => {
    return transactions.filter((tx) => !tx.cash_offset_source_id)
  }, [transactions])

  const distinctMonths = useMemo(() => {
    const months = new Set<string>()
    visibleTransactions.forEach((tx) => {
      if (tx.date) {
        months.add(tx.date.slice(0, 7)) // YYYY-MM
      }
    })
    return Array.from(months)
      .sort((a, b) => b.localeCompare(a))
      .map((m) => {
        const [year, month] = m.split('-')
        return {
          value: m,
          label: `${month}/${year}`,
        }
      })
  }, [visibleTransactions])

  const handleSelectMonthYear = (monthYear: string) => {
    if (!monthYear) return
    const matches = visibleTransactions.filter((tx) => tx.date.startsWith(monthYear)).map((tx) => tx.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      matches.forEach((id) => next.add(id))
      return next
    })
  }

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
    if (selectedIds.size === visibleTransactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleTransactions.map((tx) => tx.id)))
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
    setDeletingProgress('Lendo dados do usuário...')
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) throw new Error('Usuário não autenticado')

      // Identificar transações para limpar legados e definições órfãs
      const txsToDelete = transactions.filter(t => selectedIds.has(t.id))
      const uniqueTickers = Array.from(new Set(txsToDelete.map(t => t.ticker.toUpperCase())))
      const txIds = Array.from(selectedIds)

      // 1. Excluir offsets de caixa correspondentes em lote
      setDeletingProgress(`Excluindo offsets de caixa (Etapa 1 de 2)...`)
      await deleteCashOffsetTransactionsMultiple(portfolioId, txIds)

      // 2. Excluir transações principais em lote no Supabase
      setDeletingProgress(`Excluindo do Livro-Razão (Etapa 2 de 2)...`)
      const { error: deleteError } = await supabase
        .from('portfolio_transactions')
        .delete()
        .in('id', txIds)
        .eq('portfolio_id', portfolioId)

      if (deleteError) throw deleteError

      // Recalcular saldo de caixa total e atualizar o portfolio
      setDeletingProgress('Atualizando saldo de caixa...')
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)

      const { error: updatePortError } = await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      if (updatePortError) throw updatePortError

      // Limpar definições e metas que ficaram órfãs
      setDeletingProgress('Limpando ativos órfãos...')
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
      setDeletingProgress('')
    }
  }

  const isAllSelected = visibleTransactions.length > 0 && selectedIds.size === visibleTransactions.length

  return (
    <Card className="p-5 lg:p-6 text-left border border-border/40 shadow-sm relative overflow-hidden">
      {deleting && (
        <div className="absolute inset-0 bg-secondary/65 backdrop-blur-[1px] flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-primary animate-pulse">{deletingProgress || 'Excluindo transações...'}</span>
          </div>
        </div>
      )}

      {/* Header principal */}
      <div className="flex flex-row items-center justify-between gap-2 mb-4 pb-3 border-b border-primary/5">
        <h3 className="font-bold text-base text-primary flex items-center gap-2 select-none min-w-0 truncate">
          <Wallet size={18} className="text-emerald-500 shrink-0" />
          <span className="truncate">Livro-Razão</span>
        </h3>

        {!isSelectionMode ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Conciliar B3 — visível apenas em desktop no header */}
            {onOpenReconciliation && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenReconciliation}
                className="hidden sm:flex items-center gap-1 text-xs py-1 px-2.5 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 dark:hover:text-emerald-300 font-semibold"
              >
                <FileSpreadsheet size={12} />
                Conciliar B3
              </Button>
            )}
            {/* Excluir em Massa — visível apenas em desktop no header */}
            {portfolioId && visibleTransactions.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSelectionMode(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs py-1 px-2.5 border-red-500/10 text-red-500 hover:bg-red-500/10 dark:hover:text-red-300 font-semibold"
              >
                <Trash2 size={12} />
                Excluir em Massa
              </Button>
            )}
            {/* Lançar — sempre visível */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenTxModal()}
              className="flex items-center gap-1 text-xs py-1 px-3 border-indigo-500/30 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold"
            >
              <Plus size={13} />
              Lançar
            </Button>
          </div>
        ) : (
          /* Em modo seleção: o header só mostra o título (controles ficam no bloco abaixo) */
          <span className="text-[10px] font-black font-mono text-red-500 bg-red-500/10 px-2 py-1 rounded-lg shrink-0">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Bloco de controle de exclusão em massa */}
      {isSelectionMode && (
        <div className="mb-3 border border-red-500/20 rounded-2xl overflow-hidden animate-page-enter">

          {/* Cabeçalho do bloco */}
          <div className="flex items-center justify-between px-3 py-2 bg-red-500/[0.06] border-b border-red-500/10">
            <div className="flex items-center gap-1.5">
              <Trash2 size={12} className="text-red-500" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-500">Selecionar para excluir</span>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false) }}
              className="flex items-center gap-1 text-[10px] font-bold text-secondary hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-secondary/80"
            >
              <X size={12} />
              Cancelar
            </button>
          </div>

          {/* Chips de mês com scroll horizontal */}
          {distinctMonths.length > 0 && (
            <div className="px-3 py-2 border-b border-red-500/10">
              <p className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-1.5">Marcar por mês</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                {distinctMonths.map((m) => {
                  const monthTxs = visibleTransactions.filter(tx => tx.date.startsWith(m.value))
                  const allSelected = monthTxs.every(tx => selectedIds.has(tx.id))
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => handleSelectMonthYear(m.value)}
                      className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-center transition-all ${
                        allSelected
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : 'border-primary/25 bg-primary hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-500 text-secondary'
                      }`}
                    >
                      <span className="text-[10px] font-black font-mono leading-none">{m.label}</span>
                      <span className={`text-[8px] font-semibold mt-0.5 ${ allSelected ? 'text-white/70' : 'text-secondary/70' }`}>
                        {monthTxs.length} tx
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rodapé do bloco: selecionar todos + excluir */}
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/[0.03]">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                isAllSelected
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-indigo-500/30 text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10'
              }`}
            >
              {isAllSelected ? <CheckSquare size={11} /> : <Square size={11} />}
              {isAllSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>

            <div className="ml-auto flex items-center gap-2">
              {selectedIds.size > 0 && (
                <span className="text-[10px] font-black text-red-500 font-mono bg-red-500/10 px-2 py-1 rounded-lg">
                  {selectedIds.size} de {visibleTransactions.length}
                </span>
              )}
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <Trash2 size={11} />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de transações */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-0.5">
        {visibleTransactions.length === 0 ? (
          <p className="text-center py-6 text-xs text-secondary italic">Nenhuma transação registrada no livro-razão.</p>
        ) : (
          [...visibleTransactions].sort((a, b) => b.date.localeCompare(a.date)).map(tx => {
            const isSelected = selectedIds.has(tx.id)
            const isExpanded = expandedId === tx.id && !isSelectionMode
            const isCash = tx.ticker === 'SALDO_INV' || tx.ticker === 'CAIXA' || tx.ticker === 'SALDO EM CAIXA' || tx.ticker === 'SALDO_EM_CAIXA'
            const displayTicker = isCash ? 'Caixa' : tx.ticker
            const total = Number(tx.quantity) * Number(tx.price)

            const opLabel = tx.operation_type === 'buy' ? 'Compra'
              : tx.operation_type === 'sell' ? 'Venda'
              : tx.operation_type === 'dividend' ? 'Provento'
              : tx.operation_type === 'subscription' ? 'Subscrição'
              : 'Desdobro'

            const opColor = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : tx.operation_type === 'dividend'
              ? 'bg-indigo-500/10 text-indigo-500'
              : 'bg-red-500/10 text-red-500'

            const borderColor = isSelected
              ? 'border-indigo-500 bg-indigo-500/5'
              : isExpanded
              ? 'border-indigo-500/40 bg-secondary/40'
              : 'border-border/30 hover:border-border/60'

            return (
              <div
                key={tx.id}
                className={`border rounded-xl transition-all overflow-hidden ${borderColor}`}
              >
                {/* Linha compacta principal */}
                <div
                  onClick={() => {
                    if (isSelectionMode) {
                      handleToggleSelect(tx.id)
                    } else {
                      setExpandedId(isExpanded ? null : tx.id)
                    }
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none"
                >
                  {/* Checkbox em modo seleção */}
                  {isSelectionMode && (
                    <div className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-primary/40'
                    }`}>
                      {isSelected && <Check size={9} strokeWidth={4} />}
                    </div>
                  )}

                  {/* Badge de operação (bolinha colorida) */}
                  {!isSelectionMode && (
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                      tx.operation_type === 'buy' || tx.operation_type === 'subscription' ? 'bg-emerald-500'
                      : tx.operation_type === 'dividend' ? 'bg-indigo-500'
                      : 'bg-red-500'
                    }`} />
                  )}

                  {/* Ticker */}
                  <span className="font-bold font-mono text-xs text-primary truncate flex-1 min-w-0">
                    {displayTicker}
                  </span>

                  {/* Badge tipo operação */}
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${opColor}`}>
                    {opLabel}
                  </span>

                  {/* Valor total */}
                  <span className="font-mono font-bold text-[11px] text-primary shrink-0">
                    {formatCurrency(total)}
                  </span>

                  {/* Indicador de expandir */}
                  {!isSelectionMode && (
                    <svg
                      className={`w-3 h-3 text-secondary shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>

                {/* Painel de detalhes expansível */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 animate-page-enter">
                    <div className="border-t border-primary/8 pt-2.5 space-y-2">
                      {/* Grade de detalhes */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-secondary/50 rounded-lg p-2 text-center">
                          <div className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-0.5">Quantidade</div>
                          <div className="font-mono font-bold text-xs text-primary">{formatNumberBR(tx.quantity)}</div>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2 text-center">
                          <div className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-0.5">Preço unit.</div>
                          <div className="font-mono font-bold text-xs text-primary">{formatCurrency(tx.price)}</div>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2 text-center">
                          <div className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-0.5">Data</div>
                          <div className="font-mono font-bold text-xs text-primary">
                            {tx.date.split('-').reverse().join('/')}
                          </div>
                        </div>
                      </div>

                      {/* Total destacado */}
                      <div className="flex items-center justify-between bg-indigo-500/5 border border-indigo-500/10 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] font-bold text-secondary">Total movimentado</span>
                        <span className="font-mono font-black text-sm text-primary">{formatCurrency(total)}</span>
                      </div>

                      {/* Botão editar */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenTxModal(tx) }}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar lançamento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Rodapé mobile: ações secundárias (só aparece em mobile, fora do modo seleção) */}
      {!isSelectionMode && (
        <div className="mt-4 pt-3 border-t border-primary/5 flex sm:hidden items-center gap-2">
          {onOpenReconciliation && (
            <button
              type="button"
              onClick={onOpenReconciliation}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all"
            >
              <FileSpreadsheet size={13} />
              Conciliar B3
            </button>
          )}
          {portfolioId && visibleTransactions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSelectionMode(true)}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-xl border border-red-500/15 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={13} />
              Excluir
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
