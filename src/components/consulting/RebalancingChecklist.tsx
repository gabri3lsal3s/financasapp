import Card from '@/components/Card'
import { formatCurrency } from '@/utils/format'
import { AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface RebalancingTrade {
  ticker: string
  action: 'buy' | 'sell' | 'hold'
  amount: number
  shares: number
  currentPct: number
  targetPct: number
}

interface RebalancingChecklistProps {
  rebalancingTrades: RebalancingTrade[]
}

export default function RebalancingChecklist({
  rebalancingTrades,
}: RebalancingChecklistProps) {
  return (
    <Card className="p-5 flex flex-col text-left h-full">
      <h3 className="font-bold text-base text-primary mb-3 flex items-center gap-2">
        <AlertCircle size={16} className="text-balance" />
        Diretrizes de Rebalanceamento
      </h3>
      <p className="text-[11px] text-secondary mb-4">Trades sugeridos para alinhar a alocação atual do cliente com as metas de exposição indicadas</p>
      
      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 flex-1">
        {rebalancingTrades.length === 0 ? (
          <div className="p-4 bg-income/5 border border-income/10 rounded-xl text-center text-xs text-income font-semibold h-full flex items-center justify-center">
            A carteira deste cliente está perfeitamente rebalanceada! 🎉
          </div>
        ) : (
          rebalancingTrades.map(trade => (
            <div key={trade.ticker} className="p-3 bg-secondary border border-primary rounded-xl flex items-center justify-between text-xs transition-all hover:border-balance/20">
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-primary font-bold">{trade.ticker}</strong>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    trade.action === 'buy' 
                      ? 'bg-income/10 text-income' 
                      : 'bg-expense/10 text-expense'
                  }`}>
                    {trade.action === 'buy' ? 'Comprar' : 'Vender'}
                  </span>
                </div>
                <div className="text-[10px] text-secondary mt-1 flex items-center gap-1.5 font-sans">
                  <span>Real: <strong>{trade.currentPct}%</strong></span>
                  <span>•</span>
                  <span>Meta: <strong>{trade.targetPct}%</strong></span>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div className="text-[11px] font-semibold text-primary font-mono">
                  {trade.action === 'buy' ? '+' : '-'}{trade.shares} cotas
                  <div className="text-[9px] text-secondary font-medium font-sans">Est: {formatCurrency(trade.amount)}</div>
                </div>
                {trade.action === 'buy' ? (
                  <ArrowUpRight size={16} className="text-income shrink-0" />
                ) : (
                  <ArrowDownRight size={16} className="text-expense shrink-0" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
