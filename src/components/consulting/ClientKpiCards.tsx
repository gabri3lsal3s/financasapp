import Card from '@/components/Card'
import { Wallet, DollarSign, TrendingUp } from 'lucide-react'

interface ClientKpiCardsProps {
  portfolioValue: number
  cashBalance: number
  shareValue: number
}

export default function ClientKpiCards({
  portfolioValue,
  cashBalance,
  shareValue,
}: ClientKpiCardsProps) {
  const yieldsPercentage = (shareValue - 1) * 100

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-emerald-500 flex items-center justify-between shadow-sm transition-all hover:border-l-emerald-400">
        <div className="text-left">
          <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">Patrimônio Líquido</span>
          <strong className="text-xl font-black text-primary mt-1 block">
            R$ {portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
          <Wallet size={20} />
        </div>
      </Card>

      <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-sky-500 flex items-center justify-between shadow-sm transition-all hover:border-l-sky-400">
        <div className="text-left">
          <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">Saldo em Caixa</span>
          <strong className="text-xl font-black text-primary mt-1 block">
            R$ {cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-lg shrink-0">
          <DollarSign size={20} />
        </div>
      </Card>

      <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-purple-500 flex items-center justify-between shadow-sm transition-all hover:border-l-purple-400">
        <div className="text-left">
          <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">Valor da Cota (Rentabilidade)</span>
          <strong className="text-xl font-black text-primary mt-1 block">
            R$ {shareValue.toFixed(4)}
            <span className={`text-xs font-bold ml-1.5 ${yieldsPercentage >= 0 ? 'text-emerald-500' : 'text-expense'}`}>
              {yieldsPercentage >= 0 ? '+' : ''}{yieldsPercentage.toFixed(2)}%
            </span>
          </strong>
        </div>
        <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-lg shrink-0">
          <TrendingUp size={20} />
        </div>
      </Card>
    </div>
  )
}
