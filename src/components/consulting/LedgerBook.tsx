import React from 'react'
import { PortfolioTransaction, PortfolioOperationType } from '@/types'
import { AssetRichData } from '@/services/priceService'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { Wallet, Plus, Trash2 } from 'lucide-react'

interface LedgerBookProps {
  transactions: PortfolioTransaction[]
  showTxForm: boolean
  setShowTxForm: (show: boolean) => void
  txTicker: string
  onTxTickerChange: (ticker: string) => void
  txSuggestions: Array<{ ticker: string; name: string }>
  showTxSuggestions: boolean
  setShowTxSuggestions: (show: boolean) => void
  txType: PortfolioOperationType
  setTxType: (type: PortfolioOperationType) => void
  txQty: string
  setTxQty: (qty: string) => void
  txPrice: string
  setTxPrice: (price: string) => void
  txDate: string
  setTxDate: (date: string) => void
  loadingRichData: boolean
  txAssetRichData: AssetRichData | null
  savingTx: boolean
  onAddTransaction: (e: React.FormEvent) => void
  onDeleteTransaction: (id: string) => void
}

export default function LedgerBook({
  transactions,
  showTxForm,
  setShowTxForm,
  txTicker,
  onTxTickerChange,
  txSuggestions,
  showTxSuggestions,
  setShowTxSuggestions,
  txType,
  setTxType,
  txQty,
  setTxQty,
  txPrice,
  setTxPrice,
  txDate,
  setTxDate,
  loadingRichData,
  txAssetRichData,
  savingTx,
  onAddTransaction,
  onDeleteTransaction,
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
          onClick={() => setShowTxForm(!showTxForm)}
          className="flex items-center gap-1 text-xs py-1 px-2.5 transition-all"
        >
          <Plus size={12} />
          Lançar
        </Button>
      </div>

      {showTxForm && (
        <form onSubmit={onAddTransaction} className="p-3.5 border border-border/40 bg-muted/10 rounded-xl mb-4 space-y-3 animate-page-enter">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative flex-1">
              <Input
                label="Ticker"
                type="text"
                required
                placeholder="PETR4"
                value={txTicker}
                onChange={e => onTxTickerChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowTxSuggestions(false), 200)}
                onFocus={() => txTicker.length >= 2 && setShowTxSuggestions(true)}
                className="uppercase text-xs font-semibold font-mono text-primary"
              />
              {showTxSuggestions && txSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto" style={{ top: '100%' }}>
                  {txSuggestions.map(s => (
                    <button
                      key={s.ticker}
                      type="button"
                      onClick={() => {
                        onTxTickerChange(s.ticker)
                        setShowTxSuggestions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-tertiary text-primary flex items-center justify-between border-b border-primary/10 last:border-0"
                    >
                      <span className="font-bold font-mono">{s.ticker}</span>
                      <span className="text-[10px] text-secondary truncate max-w-[150px]">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Select
              label="Operação"
              value={txType}
              onChange={e => setTxType(e.target.value as any)}
              options={[
                { value: 'buy', label: 'Compra' },
                { value: 'sell', label: 'Venda' },
                { value: 'dividend', label: 'Provento/Div' },
                { value: 'split', label: 'Desdobrar' },
                { value: 'subscription', label: 'Subscrição' }
              ]}
              className="flex-1 text-xs font-semibold text-primary"
            />
          </div>

          {loadingRichData && (
            <div className="text-[10px] text-secondary animate-pulse pl-1 font-sans">Carregando dados da B3/Yahoo...</div>
          )}

          {txAssetRichData && (
            <div className="p-2.5 bg-background border border-border/30 rounded-lg text-[10px] space-y-1 text-secondary animate-page-enter mx-1">
              <div className="flex justify-between items-center font-sans">
                <strong className="text-primary font-bold">{txAssetRichData.name}</strong>
                <span className="text-emerald-500 font-extrabold font-mono">R$ {txAssetRichData.price.toFixed(2)}</span>
              </div>
              {txAssetRichData.dividendYield !== undefined && (
                <div className="flex justify-between items-center text-[9px] opacity-80 pt-0.5 border-t border-primary/5 font-sans">
                  <span>Dividend Yield Anual (DY):</span>
                  <span className="text-indigo-500 font-bold font-mono">{txAssetRichData.dividendYield.toFixed(2)}%</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Qtd"
              type="number"
              required
              step="any"
              placeholder="10"
              value={txQty}
              onChange={e => setTxQty(e.target.value)}
              className="text-xs font-semibold font-mono"
            />
            <Input
              label="Preço Execução"
              type="number"
              required
              step="any"
              placeholder="35.50"
              value={txPrice}
              onChange={e => setTxPrice(e.target.value)}
              className="text-xs font-semibold font-mono"
            />
          </div>

          <Input
            label="Data"
            type="date"
            required
            value={txDate}
            onChange={e => setTxDate(e.target.value)}
            className="text-xs font-semibold font-mono"
          />

          <Button type="submit" disabled={savingTx} variant="primary" fullWidth className="text-xs py-1.5 mt-1.5 font-bold shadow-md shadow-emerald-500/5">
            {savingTx ? 'Processando Lançamento...' : 'Registrar Lançamento'}
          </Button>
        </form>
      )}

      {/* Lista recente de transações */}
      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
        {transactions.length === 0 ? (
          <p className="text-center py-4 text-xs text-secondary italic">Nenhuma transação registrada no livro-razão.</p>
        ) : (
          [...transactions].reverse().map(tx => (
            <div key={tx.id} className="p-2.5 bg-background border border-border/30 rounded-lg flex items-center justify-between text-xs transition-all hover:border-border">
              <div>
                <div className="flex items-center gap-1.5">
                  <strong className="text-primary font-mono">{tx.ticker}</strong>
                  <span
                    className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${
                      tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : tx.operation_type === 'dividend'
                        ? 'bg-indigo-500/10 text-indigo-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {tx.operation_type === 'buy' ? 'Compra' : tx.operation_type === 'sell' ? 'Venda' : tx.operation_type === 'dividend' ? 'Provento' : 'Desdobro'}
                  </span>
                </div>
                <div className="text-[10px] text-secondary mt-0.5 flex items-center gap-1.5 font-sans">
                  <span className="font-mono">{tx.quantity.toLocaleString('pt-BR')} un</span>
                  <span>•</span>
                  <span className="font-mono">R$ {tx.price.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-secondary font-medium font-mono">{tx.date}</span>
                <button
                  onClick={() => onDeleteTransaction(tx.id)}
                  className="p-1 text-secondary hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
