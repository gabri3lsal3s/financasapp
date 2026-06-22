import { useState, useMemo, useEffect } from 'react'
import Card from '@/components/Card'
import Select from '@/components/Select'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { formatCurrency, formatQuantityBR, formatDate } from '@/utils/format'
import type { PortfolioTransaction } from '@/types'
import { Search, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'

interface LedgerBookProps {
  transactions: PortfolioTransaction[]
  onDeleteTransaction: () => void
  initialSearchTerm?: string
}

export default function LedgerBook({ 
  transactions, 
  onDeleteTransaction,
  initialSearchTerm = ''
}: LedgerBookProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [opFilter, setOpFilter] = useState('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  useEffect(() => {
    setSearchTerm(initialSearchTerm)
  }, [initialSearchTerm])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [searchTerm, opFilter])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Filtrar transações
  const filteredTxs = useMemo(() => {
    return transactions
      .filter((tx) => {
        const matchesSearch = tx.ticker.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesOp = opFilter === 'all' || tx.operation_type === opFilter
        return matchesSearch && matchesOp
      })
      .sort((a, b) => b.date.localeCompare(a.date)) // Mais recentes primeiro
  }, [transactions, searchTerm, opFilter])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const txToDelete = transactions.find((t) => t.id === id)
      const tickerToCheck = txToDelete?.ticker

      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', id)

      if (error) throw error

      if (txToDelete && tickerToCheck) {
        try {
          await cleanupOrphanPortfolioTickers(txToDelete.portfolio_id, [tickerToCheck])
        } catch (cleanupErr) {
          console.warn('[LedgerBook] Error cleaning up orphan tickers:', cleanupErr)
        }
      }

      toast.success('Transação excluída!')
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      
      // Disparar evento local de alteração
      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_transactions' }
      }))

      onDeleteTransaction()
    } catch (err) {
      console.error('[LedgerBook] Erro ao deletar:', err)
      toast.error('Erro ao excluir a transação.')
    } finally {
      setDeletingId(null)
    }
  }

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

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 space-y-4 text-left">
      {/* Header & Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-primary/5">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div>
            <h4 className="text-sm font-black text-primary uppercase tracking-wider">Histórico de Lançamentos</h4>
            <p className="text-[10px] text-secondary font-medium">Lista completa do livro-razão de investimentos</p>
          </div>
          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="expense"
              size="sm"
              disabled={isBulkDeleting}
              onClick={handleBulkDelete}
              className="ml-4 font-bold flex items-center gap-1.5 py-1 px-3"
            >
              <Trash2 size={13} />
              Excluir {selectedIds.size}
            </Button>
          )}
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Barra de pesquisa */}
          <div className="relative flex-1 sm:w-48">
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
          <div className="w-full sm:w-36">
            <Select
              value={opFilter}
              onChange={(e) => setOpFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todas operações' },
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
                  <th className="py-2.5 px-3 text-center w-12 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-glass text-balance focus:ring-balance/20 focus:ring-offset-0 focus:outline-none"
                      checked={filteredTxs.length > 0 && selectedIds.size === filteredTxs.length}
                      onChange={(e) => {
                        if (e.target.checked) {
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
                  <th className="py-2.5 px-3 text-right font-bold">Total</th>
                  <th className="py-2.5 px-4 text-center font-bold">Excluir</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => {
                  const isBuy = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                  const isSell = tx.operation_type === 'sell'
                  const isIncome = ['dividend', 'jcp', 'fii_yield'].includes(tx.operation_type)
                  
                  const total = Number(tx.quantity) * Number(tx.price)

                  const opLabel = tx.operation_type === 'buy' ? 'Compra'
                    : tx.operation_type === 'sell' ? 'Venda'
                    : tx.operation_type === 'dividend' ? 'Dividendo'
                    : tx.operation_type === 'jcp' ? 'JCP'
                    : tx.operation_type === 'fii_yield' ? 'Rend. FII'
                    : tx.operation_type === 'subscription' ? 'Subscrição'
                    : tx.operation_type === 'split' ? 'Desdobro'
                    : tx.operation_type === 'reverse_split' ? 'Grupamento'
                    : tx.operation_type

                  const opColor = isBuy
                    ? 'text-balance bg-balance/10'
                    : isSell
                      ? 'text-expense bg-expense/10'
                      : isIncome
                        ? 'text-income bg-income/10'
                        : 'text-secondary bg-glass/10'

                   return (
                     <tr key={tx.id} className="border-b border-glass/20 hover:bg-glass/10 transition-colors font-semibold">
                       <td className="py-3 px-3 text-center">
                         <input
                           type="checkbox"
                           className="h-4 w-4 cursor-pointer rounded border-glass text-balance focus:ring-balance/20 focus:ring-offset-0 focus:outline-none"
                           checked={selectedIds.has(tx.id)}
                           onChange={(e) => {
                             setSelectedIds((prev) => {
                               const next = new Set(prev)
                               if (e.target.checked) next.add(tx.id)
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
                      <td className="py-3 px-3 text-right font-mono text-primary font-black">
                        {formatCurrency(total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          type="button"
                          variant="link"
                          disabled={deletingId === tx.id}
                          onClick={() => {
                            if (confirm(`Deseja excluir o lançamento de ${opLabel} de ${tx.ticker}?`)) {
                              void handleDelete(tx.id)
                            }
                          }}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-expense/10 text-secondary hover:text-expense transition-all flex items-center justify-center border border-transparent hover:border-expense/20"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-glass/20">
            {filteredTxs.map((tx) => {
              const isBuy = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
              const isSell = tx.operation_type === 'sell'
              const isIncome = ['dividend', 'jcp', 'fii_yield'].includes(tx.operation_type)
              
              const total = Number(tx.quantity) * Number(tx.price)

              const opLabel = tx.operation_type === 'buy' ? 'Compra'
                : tx.operation_type === 'sell' ? 'Venda'
                : tx.operation_type === 'dividend' ? 'Dividendo'
                : tx.operation_type === 'jcp' ? 'JCP'
                : tx.operation_type === 'fii_yield' ? 'Rend. FII'
                : tx.operation_type === 'subscription' ? 'Subscrição'
                : tx.operation_type === 'split' ? 'Desdobro'
                : tx.operation_type === 'reverse_split' ? 'Grupamento'
                : tx.operation_type

              const opColor = isBuy
                ? 'text-balance bg-balance/10'
                : isSell
                  ? 'text-expense bg-expense/10'
                  : isIncome
                    ? 'text-income bg-income/10'
                    : 'text-secondary bg-glass/10'

              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-left animate-fade-in">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-glass text-balance focus:ring-balance/20 focus:ring-offset-0 focus:outline-none"
                      checked={selectedIds.has(tx.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(tx.id)
                          else next.delete(tx.id)
                          return next
                        })
                      }}
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-primary font-mono text-sm">{tx.ticker}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${opColor}`}>
                        {opLabel}
                      </span>
                    </div>
                    <div className="text-[10px] text-secondary font-medium font-mono">
                      {formatDate(tx.date)} • {formatQuantityBR(Number(tx.quantity), 4)} un x {formatCurrency(Number(tx.price))}
                    </div>
                  </div>
                </div>
                  
                <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-black text-primary font-mono block">
                        {formatCurrency(total)}
                      </span>
                    </div>
                    
                    <Button
                      type="button"
                      variant="link"
                      disabled={deletingId === tx.id}
                      onClick={() => {
                        if (confirm(`Deseja excluir o lançamento de ${opLabel} de ${tx.ticker}?`)) {
                          void handleDelete(tx.id)
                        }
                      }}
                      className="h-8 w-8 p-0 rounded-lg hover:bg-expense/10 text-secondary hover:text-expense transition-all flex items-center justify-center border border-transparent hover:border-expense/20"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
