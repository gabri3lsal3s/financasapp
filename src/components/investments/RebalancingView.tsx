import Card from '@/components/Card'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { ArrowUpCircle, Info, CheckCircle2, TrendingUp } from 'lucide-react'

interface RebalancingViewProps {
  positions: ValuedPosition[]
  totalValue: number
}

export default function RebalancingView({ positions, totalValue }: RebalancingViewProps) {
  // Filtrar posições que possuem alvos ou são relevantes
  const itemsToRebalance = positions
    .filter(p => p.target_percentage > 0 || p.current_percentage > 0)
    .sort((a, b) => b.gap_financial - a.gap_financial) // maior aporte necessário primeiro

  const totalTargetDefined = positions.reduce((sum, p) => sum + p.target_percentage, 0)

  if (totalTargetDefined === 0) {
    return (
      <Card className="border border-glass bg-glass/5 rounded-3xl p-8 text-center space-y-3">
        <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Info size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">Metas não definidas</h4>
          <p className="text-xs text-secondary font-medium max-w-sm mx-auto leading-relaxed">
            Defina percentuais alvos para cada ativo nas configurações para ativar o cálculo de rebalanceamento inteligente.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 space-y-5 text-left">
      <div>
        <h4 className="text-sm font-black text-primary uppercase tracking-wider">Rebalanceamento da Carteira</h4>
        <p className="text-[10px] text-secondary font-medium">Aportes inteligentes para manter o alinhamento da alocação alvo</p>
      </div>

      {totalTargetDefined !== 100 && (
        <div className="p-3 bg-expense/10 text-expense border border-expense/20 rounded-xl text-[10px] font-bold flex items-center gap-2">
          <Info size={14} className="shrink-0" />
          <span>Atenção: A soma dos alvos atuais é de {formatPercentBR(totalTargetDefined, 1)}. O ideal é atingir exatamente 100%.</span>
        </div>
      )}

      <div className="space-y-4">
        {itemsToRebalance.map((pos) => {
          const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
          const targetValueBrl = (pos.target_percentage / 100) * totalValue
          const gap = targetValueBrl - valueInBrl

          const actionRequired = gap > 0.01
          const isAligned = Math.abs(gap) < 5.00 // Considerado alinhado se desvio < R$5

          let statusLabel = 'Alinhado'
          let statusColor = 'text-income bg-income/10'
          let StatusIcon = CheckCircle2

          if (actionRequired) {
            statusLabel = 'Abaixo do Alvo'
            statusColor = 'text-primary bg-primary/10'
            StatusIcon = TrendingUp
          } else if (gap < -0.01 && !isAligned) {
            statusLabel = 'Excesso'
            statusColor = 'text-secondary bg-glass/10'
            StatusIcon = Info
          }

          return (
            <div
              key={pos.ticker}
              className="p-4 rounded-2xl border border-glass/30 bg-glass/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-glass hover:bg-glass/10 transition-all duration-300 animate-fade-in"
            >
              {/* Ticker, Status & Alocação */}
              <div className="space-y-2 flex-1 text-left">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-black text-primary font-mono">{pos.ticker}</span>
                  <span className="text-[9px] font-bold text-secondary uppercase font-mono">{pos.asset_class}</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[8px] uppercase tracking-wider flex items-center gap-1 ${statusColor}`}>
                    <StatusIcon size={10} />
                    {statusLabel}
                  </span>
                </div>
                
                {/* Barra de Progresso Comparativa */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-secondary font-bold font-mono">
                    <span>Atual: {formatPercentBR(pos.current_percentage, 1)}</span>
                    <span>Alvo: {formatPercentBR(pos.target_percentage, 1)}</span>
                  </div>
                  <div className="w-full h-2 bg-glass/15 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${actionRequired ? 'bg-primary' : isAligned ? 'bg-income' : 'bg-secondary'}`}
                      style={{ width: `${Math.min(100, (pos.current_percentage / (pos.target_percentage || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Sugestão de Ação */}
              <div className="flex items-center gap-4 sm:text-right sm:justify-end shrink-0">
                <div className="space-y-0.5 text-left sm:text-right">
                  <span className="text-[9px] uppercase font-black text-secondary block">
                    {actionRequired ? 'Aporte Sugerido' : 'Situação'}
                  </span>
                  {actionRequired ? (
                    <span className="text-xs font-black text-income font-mono">
                      Comprar {formatCurrency(gap)}
                    </span>
                  ) : (
                    <span className="text-xs font-black text-secondary font-mono">
                      {gap < 0 && !isAligned ? `Excedente: ${formatCurrency(Math.abs(gap))}` : 'Alocação Correta'}
                    </span>
                  )}
                </div>
                {actionRequired && (
                  <div className="w-8 h-8 rounded-full bg-income/10 flex items-center justify-center text-income shrink-0">
                    <ArrowUpCircle size={16} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
