import { useState, useMemo } from 'react'
import { PortfolioTransaction } from '@/types'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { Wallet, Plus, FileSpreadsheet, Trash2, CheckSquare, Square, X, Check, Search, BookOpen } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { supabase } from '@/lib/supabase'
import { deleteCashOffsetTransactionsMultiple, fetchPortfolioCashContext } from '@/services/cashOffsetService'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import { isPortfolioIncomeType, portfolioOperationLabel } from '@/utils/portfolioOperations'
import toast from 'react-hot-toast'
import Input from '@/components/Input'
import Select from '@/components/Select'

interface LedgerBookProps {
  transactions: PortfolioTransaction[]
  onOpenTxModal: (tx?: PortfolioTransaction) => void
  onOpenReconciliation?: () => void
  portfolioId?: string
  onSaved?: () => void
}

function LedgerBook({
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

  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerOpType, setLedgerOpType] = useState('all')
  const [ledgerMonth, setLedgerMonth] = useState('all')

  // Filtra as transações para exibir apenas movimentações manuais no livro-razão
  const visibleTransactions = useMemo(() => {
    return transactions.filter((tx) => !tx.cash_offset_source_id)
  }, [transactions])

  const filteredVisibleTransactions = useMemo(() => {
    return visibleTransactions.filter((tx) => {
      // 1. Filtro por ticker
      if (ledgerSearch.trim() !== '') {
        const query = ledgerSearch.toLowerCase().trim()
        if (!tx.ticker.toLowerCase().includes(query)) return false
      }

      // 2. Filtro por tipo de operação
      if (ledgerOpType !== 'all') {
        if (tx.operation_type !== ledgerOpType) return false
      }

      // 3. Filtro por mês/ano
      if (ledgerMonth !== 'all') {
        if (!tx.date || !tx.date.startsWith(ledgerMonth)) return false
      }

      return true
    })
  }, [visibleTransactions, ledgerSearch, ledgerOpType, ledgerMonth])

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
    const matches = filteredVisibleTransactions.filter((tx) => tx.date.startsWith(monthYear)).map((tx) => tx.id)
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
    if (selectedIds.size === filteredVisibleTransactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredVisibleTransactions.map((tx) => tx.id)))
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
      const TX_CHUNK_SIZE = 100
      const txChunks: string[][] = []
      for (let i = 0; i < txIds.length; i += TX_CHUNK_SIZE) {
        txChunks.push(txIds.slice(i, i + TX_CHUNK_SIZE))
      }

      await Promise.all(
        txChunks.map(async (chunk) => {
          const { error: chunkDeleteError } = await supabase
            .from('portfolio_transactions')
            .delete()
            .in('id', chunk)
            .eq('portfolio_id', portfolioId)
          if (chunkDeleteError) throw chunkDeleteError
        })
      )

      // Recalcular saldo de caixa total e atualizar o portfolio
      setDeletingProgress('Atualizando saldo de caixa...')
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)

      const { error: updatePortError } = await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      if (updatePortError) throw updatePortError

      setDeletingProgress('Limpando ativos órfãos...')
      await cleanupOrphanPortfolioTickers(portfolioId, uniqueTickers)

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

  const isAllSelected = filteredVisibleTransactions.length > 0 && selectedIds.size === filteredVisibleTransactions.length

  return (
    <Card className="p-5 lg:p-6 text-left relative overflow-hidden">
      {deleting && (
        <div className="absolute inset-0 bg-secondary/65 backdrop-blur-[1px] flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-4 border-balance border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-primary animate-pulse">{deletingProgress || 'Excluindo transações...'}</span>
          </div>
        </div>
      )}

      {/* Header principal */}
      <div className="flex flex-row items-center justify-between gap-2 mb-4 pb-3 border-b border-primary/5">
        <h3 className="font-bold text-base text-primary flex items-center gap-2 select-none min-w-0 truncate">
          <Wallet size={18} className="text-income shrink-0" />
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
                className="hidden sm:flex items-center gap-1 text-xs py-1 px-2.5 border-income/20 text-income hover:bg-income/10 dark:hover:text-income font-semibold"
              >
                <FileSpreadsheet size={12} />
                Conciliar B3
              </Button>
            )}
            {/* Excluir em Massa — visível apenas em desktop no header */}
            {portfolioId && filteredVisibleTransactions.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSelectionMode(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs py-1 px-2.5 border-expense/10 text-expense hover:bg-expense/10 dark:hover:text-expense font-semibold"
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
              className="flex items-center gap-1 text-xs py-1 px-3 border-balance/30 bg-balance/10 text-balance hover:bg-balance/20 dark:text-balance dark:hover:text-balance font-bold"
            >
              <Plus size={13} />
              Lançar
            </Button>
          </div>
        ) : (
          /* Em modo seleção: o header só mostra o título (controles ficam no bloco abaixo) */
          <span className="text-[10px] font-black font-mono text-expense bg-expense/10 px-2 py-1 rounded-lg shrink-0">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Barra de Filtros do Livro-Razão */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/60 pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar por ticker..."
            value={ledgerSearch}
            onChange={(e) => setLedgerSearch(e.target.value)}
            className="!pl-9 text-xs font-semibold !py-2 w-full bg-secondary/20"
          />
          {ledgerSearch && (
            <button
              type="button"
              onClick={() => setLedgerSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-0.5 rounded-md hover:bg-secondary/60 transition-colors"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <Select
          value={ledgerOpType}
          onChange={(e) => setLedgerOpType(e.target.value)}
          options={[
            { value: 'all', label: 'Todas as Operações' },
            { value: 'buy', label: 'Compra' },
            { value: 'sell', label: 'Venda' },
            { value: 'subscription', label: 'Subscrição' },
            { value: 'dividend', label: 'Dividendos' },
            { value: 'jcp', label: 'JCP' },
            { value: 'yield', label: 'Rendimentos' },
          ]}
          placeholder="Filtrar por operação..."
          className="text-xs !py-0"
        />

        <Select
          value={ledgerMonth}
          onChange={(e) => setLedgerMonth(e.target.value)}
          options={[
            { value: 'all', label: 'Todos os Meses' },
            ...distinctMonths.map((m) => ({ value: m.value, label: m.label })),
          ]}
          placeholder="Filtrar por mês..."
          className="text-xs !py-0"
        />
      </div>

      {/* Bloco de controle de exclusão em massa */}
      {isSelectionMode && (
        <div className="mb-3 border border-expense/20 rounded-2xl overflow-hidden animate-page-enter">

          {/* Cabeçalho do bloco */}
          <div className="flex items-center justify-between px-3 py-2 bg-expense/[0.06] border-b border-expense/10">
            <div className="flex items-center gap-1.5">
              <Trash2 size={12} className="text-expense" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-expense">Selecionar para excluir</span>
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
            <div className="px-3 py-2 border-b border-expense/10">
              <p className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-1.5">Marcar por mês</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                {distinctMonths.map((m) => {
                  const monthTxs = filteredVisibleTransactions.filter(tx => tx.date.startsWith(m.value))
                  const allSelected = monthTxs.every(tx => selectedIds.has(tx.id))
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => handleSelectMonthYear(m.value)}
                      className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-center transition-all ${
                        allSelected
                          ? 'bg-balance border-balance text-white'
                          : 'border-primary/25 bg-primary hover:border-balance/40 hover:bg-balance/5 hover:text-balance text-secondary'
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
          <div className="flex items-center gap-2 px-3 py-2 bg-expense/[0.03]">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                isAllSelected
                  ? 'bg-balance border-balance text-white'
                  : 'border-balance/30 text-balance bg-balance/5 hover:bg-balance/10'
              }`}
            >
              {isAllSelected ? <CheckSquare size={11} /> : <Square size={11} />}
              {isAllSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>

            <div className="ml-auto flex items-center gap-2">
              {selectedIds.size > 0 && (
                <span className="text-[10px] font-black text-expense font-mono bg-expense/10 px-2 py-1 rounded-lg">
                  {selectedIds.size} de {filteredVisibleTransactions.length}
                </span>
              )}
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-expense/25 bg-expense text-white hover:bg-expense/80 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Trash2 size={11} />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de transações */}
      <div className="space-y-1.5 max-h-[520px] lg:max-h-[620px] overflow-y-auto pr-1 custom-scrollbar">
        {filteredVisibleTransactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-secondary">
            <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
              <BookOpen size={20} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Nenhuma transação encontrada</p>
              <p className="text-xs opacity-70 mt-0.5">Ajuste os filtros ou lance uma nova transação</p>
            </div>
          </div>
        ) : (
          [...filteredVisibleTransactions].sort((a, b) => b.date.localeCompare(a.date)).map(tx => {
            const isSelected = selectedIds.has(tx.id)
            const isExpanded = expandedId === tx.id && !isSelectionMode
            const isCash = tx.ticker === 'SALDO_INV' || tx.ticker === 'CAIXA' || tx.ticker === 'SALDO EM CAIXA' || tx.ticker === 'SALDO_EM_CAIXA'
            const displayTicker = isCash ? 'Caixa' : tx.ticker
            const total = Number(tx.quantity) * Number(tx.price)

            const opLabel = portfolioOperationLabel(tx.operation_type)

            const opColor = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
              ? 'bg-income/10 text-income'
              : isPortfolioIncomeType(tx.operation_type)
              ? 'bg-balance/10 text-balance'
              : 'bg-expense/10 text-expense'

            const borderColor = isSelected
              ? 'border-balance bg-balance/5'
              : isExpanded
              ? 'border-balance/40 bg-secondary/40'
              : 'border-glass hover:border-glass'

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
                      isSelected ? 'bg-balance border-balance text-white' : 'border-primary/40'
                    }`}>
                      {isSelected && <Check size={9} strokeWidth={4} />}
                    </div>
                  )}

                  {/* Badge de operação (bolinha colorida) */}
                  {!isSelectionMode && (
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                      tx.operation_type === 'buy' || tx.operation_type === 'subscription' ? 'bg-income'
                      : isPortfolioIncomeType(tx.operation_type) ? 'bg-balance'
                      : 'bg-expense'
                    }`} />
                  )}

                  {/* Ticker */}
                  <span className="font-bold font-mono text-sm text-primary truncate flex-1 min-w-0">
                    {displayTicker}
                  </span>

                  {/* Badge tipo operação */}
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${opColor}`}>
                    {opLabel}
                  </span>

                  {/* Data (pill compacta) */}
                  <span className="font-mono text-[9px] text-secondary bg-secondary/60 px-1.5 py-0.5 rounded-md shrink-0">
                    {tx.date.split('-').reverse().slice(0, 2).join('/')}
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
                        <div className="surface-glass border border-glass rounded-xl p-2 text-center">
                          <div className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-0.5">Quantidade</div>
                          <div className="font-mono font-bold text-xs text-primary">{formatNumberBR(tx.quantity)}</div>
                        </div>
                        <div className="surface-glass border border-glass rounded-xl p-2 text-center">
                          <div className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-0.5">Preço unit.</div>
                          <div className="font-mono font-bold text-xs text-primary">{formatCurrency(tx.price)}</div>
                        </div>
                        <div className="surface-glass border border-glass rounded-xl p-2 text-center">
                          <div className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-0.5">Data</div>
                          <div className="font-mono font-bold text-xs text-primary">
                            {tx.date.split('-').reverse().join('/')}
                          </div>
                        </div>
                      </div>

                      {/* Total destacado */}
                      <div className="flex items-center justify-between surface-glass border border-glass rounded-xl px-3 py-1.5">
                        <span className="text-[10px] font-bold text-secondary">Total movimentado</span>
                        <span className="font-mono font-black text-sm text-primary">{formatCurrency(total)}</span>
                      </div>

                      {/* Botão editar */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenTxModal(tx) }}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 rounded-xl border border-balance/25 text-balance hover:bg-balance/10 transition-all"
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
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-xl border border-income/25 bg-income/5 text-income hover:bg-income/10 transition-all"
            >
              <FileSpreadsheet size={13} />
              Conciliar B3
            </button>
          )}
          {portfolioId && filteredVisibleTransactions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSelectionMode(true)}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 px-3 rounded-xl border border-expense/15 bg-expense/5 text-expense hover:bg-expense/10 transition-all"
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

export default LedgerBook
