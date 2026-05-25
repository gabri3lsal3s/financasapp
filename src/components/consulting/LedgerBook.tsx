import { PortfolioTransaction } from '@/types'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { Wallet, Plus } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface LedgerBookProps {
  transactions: PortfolioTransaction[]
  onOpenTxModal: (tx?: PortfolioTransaction) => void
}

export default function LedgerBook({
  transactions,
  onOpenTxModal,
}: LedgerBookProps) {
  return (
    <Card className="p-5 lg:p-6 text-left border border-border/40 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base text-primary flex items-center gap-2">
          <Wallet size={18} className="text-emerald-500" />
          Livro-Razão (Transações)
        </h3>
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

      {/* Lista recente de transações */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {transactions.length === 0 ? (
          <p className="text-center py-6 text-xs text-secondary italic">Nenhuma transação registrada no livro-razão.</p>
        ) : (
          [...transactions].reverse().map(tx => (
            <button
              key={tx.id}
              type="button"
              onClick={() => onOpenTxModal(tx)}
              className="w-full p-2.5 bg-background border border-border/30 rounded-lg flex items-center justify-between text-xs transition-all hover:border-indigo-500/20 hover:bg-secondary/50 text-left cursor-pointer font-sans"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <strong className="text-primary font-mono">
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
              <span className="text-[10px] text-secondary font-medium font-mono shrink-0">{tx.date}</span>
            </button>
          ))
        )}
      </div>
    </Card>
  )
}
