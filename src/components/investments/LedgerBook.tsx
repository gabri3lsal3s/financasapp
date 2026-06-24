import { useState, useMemo, useEffect } from 'react'
import Card from '@/components/Card'
import Select from '@/components/Select'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency, formatQuantityBR, formatDate } from '@/utils/format'
import type { PortfolioTransaction } from '@/types'
import { Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'

const PAGE_SIZE = 25

interface LedgerBookProps {
  transactions: PortfolioTransaction[]
  onDeleteTransaction: () => void
  initialSearchTerm?: string
  onEditTransaction?: (tx: PortfolioTransaction) => void
}

export default function LedgerBook({ 
  transactions, 
  onDeleteTransaction,
  initialSearchTerm = '',
  onEditTransaction
}: LedgerBookProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [opFilter, setOpFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setSearchTerm(initialSearchTerm)
  }, [initialSearchTerm])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [searchTerm, opFilter])

  // Resetar página para 1 quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, opFilter])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Filtrar transações
  const filteredTxs = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Ocultar TODOS os lançamentos de caixa automáticos (seja contrapartida de
        // aporte, venda ou provento) para manter o livro-razão limpo.
        // O vínculo via cash_offset_source_id garante que a exclusão do lançamento
        // original também remova o offset automaticamente.
        if (tx.cash_offset_source_id) {
          return false
        }

        const matchesSearch = tx.ticker.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesOp = opFilter === 'all' || tx.operation_type === opFilter
        return matchesSearch && matchesOp
      })
      .sort((a, b) => b.date.localeCompare(a.date)) // Mais recentes primeiro
  }, [transactions, searchTerm, opFilter])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedTxs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredTxs.slice(start, start + PAGE_SIZE)
  }, [filteredTxs, safePage])

  const startItem = (safePage - 1) * PAGE_SIZE + 1
  const endItem = Math.min(safePage * PAGE_SIZE, filteredTxs.length)

  // Sincronizar página atual se exceder o total de páginas
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Deseja realmente excluir os ${selectedIds.size} lançamentos selecionados?`)) return
    
    setIsBulkDeleting(true)
    try {
      const txsToDelete = transactions.filter((t) => selectedIds.has(t.id))
      const tickersToCheck = Array.from(new Set(txsToDelete.map((t) => t.ticker)))
      const portfolioId = txsToDelete[0]?.portfolio_id

      const idArray = Array.from(selectedIds)
      const batchSize = 100
      for (let i = 0; i < idArray.length; i += batchSize) {
        const batch = idArray.slice(i, i + batchSize)
        const { error } = await supabase
          .from('portfolio_transactions')
          .delete()
          .in('id', batch)

        if (error) throw error
      }

      if (portfolioId && tickersToCheck.length > 0) {
        try {
          await cleanupOrphanPortfolioTickers(portfolioId, tickersToCheck)
        } catch (cleanupErr) {
          console.warn('[LedgerBook] Error cleaning up bulk orphan tickers:', cleanupErr)
        }
      }

      toast.success(`${selectedIds.size} transações excluídas!`)
      setSelectedIds(new Set())
      
      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_transactions' }
      }))

      onDeleteTransaction()
    } catch (err) {
      console.error('[LedgerBook] Erro ao deletar em massa:', err)
      toast.error('Erro ao excluir as transações.')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Componente de navegação de páginas
  const PaginationBar = () => {
    if (totalPages <= 1) return null

    // Gerar lista de páginas visíveis (máx 7)
    const pageNumbers: (number | string)[] = []
    const maxVisible = 7
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
    } else {
      pageNumbers.push(1)
      if (safePage > 3) pageNumbers.push('...')
      const startPage = Math.max(2, safePage - 1)
      const endPage = Math.min(totalPages - 1, safePage + 1)
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i)
      if (safePage < totalPages - 2) pageNumbers.push('...')
      pageNumbers.push(totalPages)
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-glass/20 text-xs">
        {/* Contagem */}
        <span className="text-[10px] text-secondary font-medium font-mono">
          Mostrando {startItem}–{endItem} de {filteredTxs.length} lançamentos
        </span>

        {/* Navegação */}
        <div className="flex items-center gap-1">
          {/* Anterior */}
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-glass/30 hover:bg-glass/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Páginas */}
          {pageNumbers.map((p, i) =>
            typeof p === 'string' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-secondary">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => setCurrentPage(p)}
                className={`min-w-[28px] h-7 rounded-lg text-[10px] font-bold transition-all ${
                  p === safePage
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-glass/30 hover:bg-glass/10 text-secondary'
                }`}
              >
                {p}
              </button>
            )
          )}

          {/* Próximo */}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-glass/30 hover:bg-glass/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  const opLabelMap: Record<string, string> = {
    buy: 'Compra',
    sell: 'Venda',
    dividend: 'Dividendo',
    jcp: 'JCP',
    fii_yield: 'Rend. FII',
    subscription: 'Subscrição',
    split: 'Desdobro',
    reverse_split: 'Grupamento',
  }

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-4 text-left">
      {/* Header & Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-primary/5">
        {/* Left: Title */}
        <div className="flex items-center justify-between w-full lg:w-auto shrink-0">
          <div>
            <h4 className="text-sm font-black text-primary uppercase tracking-wider">Histórico de Lançamentos</h4>
            <p className="text-[10px] text-secondary font-medium">Lista completa do livro-razão de investimentos</p>
          </div>
        </div>

        {/* Right: Bulk delete + Search + Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto lg:max-w-[600px]">
          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="expense"
              size="sm"
              disabled={isBulkDeleting}
              onClick={handleBulkDelete}
              className="font-bold flex items-center gap-1.5 py-1 px-3 shrink-0"
            >
              <Trash2 size={13} />
              Excluir {selectedIds.size}
            </Button>
          )}
          {/* Barra de pesquisa - flexível */}
          <div className="relative flex-1 min-w-0">
            <span className="absolute inset-y-0 left-3 flex items-center text-secondary pointer-events-none z-10">
              <Search size={14} />
            </span>
            <Input
              type="text"
              placeholder="Buscar por ticker..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-9 h-10 w-full"
            />
          </div>
          {/* Select Operação */}
          <div className="w-full sm:w-36 shrink-0">
            <Select
              value={opFilter}
              onChange={(e) => setOpFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'buy', label: 'Compra' },
                { value: 'sell', label: 'Venda' },
                { value: 'dividend', label: 'Dividendo' },
                { value: 'jcp', label: 'JCP' },
                { value: 'fii_yield', label: 'Rend. FII' },
                { value: 'split', label: 'Desdobro' },
                { value: 'reverse_split', label: 'Grupamento' },
                { value: 'subscription', label: 'Subscrição' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Tabela de lançamentos */}
      {filteredTxs.length === 0 ? (
        <div className="py-12 text-center text-xs font-semibold text-secondary">
          Nenhuma movimentação encontrada com os filtros aplicados.
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-glass/40 text-secondary font-bold select-none bg-glass/5 text-[9px] uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12 select-none">
                    <Checkbox
                      checked={paginatedTxs.length > 0 && selectedIds.size === filteredTxs.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(filteredTxs.map((tx) => tx.id)))
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                    />
                  </th>
                  <th className="py-2.5 px-3 font-bold">Data</th>
                  <th className="py-2.5 px-3 font-bold">Ticker</th>
                  <th className="py-2.5 px-3 font-bold">Operação</th>
                  <th className="py-2.5 px-3 text-right font-bold">Qtd</th>
                  <th className="py-2.5 px-3 text-right font-bold">Preço</th>
                  <th className="py-2.5 px-4 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTxs.map((tx) => {
                  const isBuy = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                  const isSell = tx.operation_type === 'sell'
                  const isIncome = ['dividend', 'jcp', 'fii_yield'].includes(tx.operation_type)
                  
                  const total = Number(tx.quantity) * Number(tx.price)
                  const opLabel = opLabelMap[tx.operation_type] || tx.operation_type

                  const opColor = isBuy
                    ? 'text-balance bg-balance/10'
                    : isSell
                      ? 'text-expense bg-expense/10'
                      : isIncome
                        ? 'text-income bg-income/10'
                        : 'text-secondary bg-glass/10'

                   return (
                     <tr 
                       key={tx.id} 
                       onClick={() => onEditTransaction?.(tx)}
                       className="border-b border-glass/20 hover:bg-glass/10 transition-colors font-semibold cursor-pointer"
                     >
                       <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                           checked={selectedIds.has(tx.id)}
                           onCheckedChange={(checked) => {
                             setSelectedIds((prev) => {
                               const next = new Set(prev)
                               if (checked) next.add(tx.id)
                               else next.delete(tx.id)
                               return next
                             })
                           }}
                         />
                       </td>
                       <td className="py-3 px-3 font-mono text-secondary">{formatDate(tx.date)}</td>
                       <td className="py-3 px-3 font-black text-primary font-mono text-sm">{tx.ticker}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${opColor}`}>
                          {opLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-secondary">
                        {formatQuantityBR(Number(tx.quantity), 6)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-secondary">
                        {formatCurrency(Number(tx.price))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-primary font-black">
                        {formatCurrency(total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-glass/20">
            {/* Select-all header for mobile */}
            <div
              onClick={() => {
                if (selectedIds.size === paginatedTxs.length) {
                  setSelectedIds(new Set())
                } else {
                  setSelectedIds(new Set(paginatedTxs.map((tx) => tx.id)))
                }
              }}
              className="flex items-center gap-2 px-2 py-2.5 bg-glass/5 rounded-xl mb-1 cursor-pointer hover:bg-glass/10 transition-colors"
            >
              <Checkbox
                checked={paginatedTxs.length > 0 && selectedIds.size === paginatedTxs.length}
              />
              <span className="text-[10px] font-bold text-secondary select-none">Selecionar todos</span>
              {selectedIds.size > 0 && (
                <span className="text-[9px] font-bold text-primary font-mono ml-auto">
                  {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {paginatedTxs.map((tx) => {
              const isBuy = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
              const isSell = tx.operation_type === 'sell'
              const isIncome = ['dividend', 'jcp', 'fii_yield'].includes(tx.operation_type)
              
              const total = Number(tx.quantity) * Number(tx.price)
              const opLabel = opLabelMap[tx.operation_type] || tx.operation_type

              const opColor = isBuy
                ? 'text-balance bg-balance/10'
                : isSell
                  ? 'text-expense bg-expense/10'
                  : isIncome
                    ? 'text-income bg-income/10'
                    : 'text-secondary bg-glass/10'

              return (
                <div 
                  key={tx.id}
                  className="py-2.5 flex items-center gap-2 text-left animate-fade-in px-2 rounded-xl hover:bg-glass/5 transition-colors"
                >
                  {/* Checkbox visível e clicável */}
                  <div className="flex items-center shrink-0">
                    <div
                      onClick={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(tx.id)) next.delete(tx.id)
                          else next.add(tx.id)
                          return next
                        })
                      }}
                      className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-glass/10 active:bg-glass/20 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.has(tx.id)}
                      />
                    </div>
                  </div>

                  {/* Dados da transação */}
                  <button
                    type="button"
                    onClick={() => onEditTransaction?.(tx)}
                    className="flex items-center justify-between gap-2 flex-1 min-w-0 cursor-pointer hover:bg-glass/5 active:scale-[0.99] transition-all rounded-xl py-2 px-2.5 text-left"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-primary font-mono text-sm">{tx.ticker}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${opColor}`}>
                          {opLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-secondary font-medium font-mono truncate">
                        {formatDate(tx.date)} • {formatQuantityBR(Number(tx.quantity), 4)} un x {formatCurrency(Number(tx.price))}
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-primary font-mono block">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Barra de Paginação */}
          <PaginationBar />
        </>
      )}
    </Card>
  )
}
