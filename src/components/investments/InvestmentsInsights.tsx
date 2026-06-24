import Card from '@/components/Card'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { AlertTriangle, CheckCircle, Info, PiggyBank, ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'

interface InvestmentsInsightsProps {
  positions: ValuedPosition[]
  cashValue: number
  totalValue: number
}

interface InsightItem {
  id: string
  title: string
  description: string
  type: 'success' | 'warning' | 'info'
  icon: React.ReactNode
}

export default function InvestmentsInsights({
  positions,
  cashValue,
  totalValue,
}: InvestmentsInsightsProps) {
  const insights = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = []

    if (totalValue <= 0) return list

    // 1. Insight de Reserva de Caixa
    const cashPct = (cashValue / totalValue) * 100
    if (cashPct > 20) {
      list.push({
        id: 'cash_excess',
        title: 'Caixa Elevado',
        description: `Seu saldo em caixa representa ${formatPercentBR(cashPct, 1)} da sua carteira de investimentos. Considere alocar o excedente para evitar o custo de oportunidade.`,
        type: 'warning',
        icon: <PiggyBank className="text-secondary" size={16} />
      })
    } else if (cashPct >= 5 && cashPct <= 20) {
      list.push({
        id: 'cash_healthy',
        title: 'Caixa Equilibrado',
        description: `Você tem ${formatPercentBR(cashPct, 1)} da carteira em caixa, um patamar saudável de liquidez para aproveitar oportunidades de queda no mercado.`,
        type: 'success',
        icon: <CheckCircle className="text-income" size={16} />
      })
    } else {
      list.push({
        id: 'cash_low',
        title: 'Caixa Baixo',
        description: `Seu caixa representa apenas ${formatPercentBR(cashPct, 1)} da carteira. Pouca liquidez disponível para fazer novos aportes táticos ou rebalanceamentos imediatos.`,
        type: 'info',
        icon: <Info className="text-primary" size={16} />
      })
    }

    // 2. Insight de Concentração de Ativos
    const nonCashPositions = positions.filter(p => !['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(p.ticker.toUpperCase()))
    const maxAsset = nonCashPositions.reduce((max, current) => 
      (current.current_percentage > (max?.current_percentage || 0)) ? current : max
    , null as ValuedPosition | null)

    if (maxAsset && maxAsset.current_percentage > 35) {
      list.push({
        id: 'high_concentration',
        title: 'Concentração Elevada',
        description: `O ativo ${maxAsset.ticker} representa ${formatPercentBR(maxAsset.current_percentage, 1)} de toda a sua carteira de investimentos. Considere rebalancear para reduzir o risco individual de crédito ou mercado.`,
        type: 'warning',
        icon: <AlertTriangle className="text-expense" size={16} />
      })
    } else if (nonCashPositions.length >= 4) {
      list.push({
        id: 'diversification_healthy',
        title: 'Diversificação Saudável',
        description: `Nenhum ativo individual (excluindo saldo em caixa) supera o limite prudencial de 35% de exposição, mantendo seu risco de portfólio bem distribuído.`,
        type: 'success',
        icon: <CheckCircle className="text-income" size={16} />
      })
    }

    // 3. Insight de Compra Prioritária
    const belowTargetAssets = positions
      .filter(p => p.gap_financial > 0.01)
      .sort((a, b) => b.gap_financial - a.gap_financial)

    if (belowTargetAssets.length > 0) {
      const top1 = belowTargetAssets[0]
      const top2 = belowTargetAssets[1]
      const assetListText = top2
        ? `${top1.ticker} (aporte de ${formatCurrency(top1.gap_financial)}) e ${top2.ticker} (aporte de ${formatCurrency(top2.gap_financial)})`
        : `${top1.ticker} (aporte de ${formatCurrency(top1.gap_financial)})`

      list.push({
        id: 'priority_buys',
        title: 'Aportes Prioritários',
        description: `Para aproximar sua carteira dos alvos ideais de alocação, priorize a compra de: ${assetListText}.`,
        type: 'info',
        icon: <ArrowUpRight className="text-primary" size={16} />
      })
    }

    return list
  }, [positions, cashValue, totalValue])

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-4 text-left">
      <div>
        <h4 className="text-sm font-black text-primary uppercase tracking-wider">Insights da Carteira</h4>
        <p className="text-[10px] text-secondary font-medium">Recomendações e status com base nos ativos custodiados</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.length === 0 ? (
          <div className="text-xs font-semibold text-secondary text-center py-4 sm:col-span-2">
            Sem dados suficientes para gerar insights da carteira. Insira transações para ativar a análise.
          </div>
        ) : (
          insights.map((item) => {
            const borderClass = 
              item.type === 'success' 
                ? 'border-income/20 bg-income/5' 
                : item.type === 'warning' 
                  ? 'border-expense/20 bg-expense/5' 
                  : 'border-primary/20 bg-primary/5'

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border flex gap-3 text-xs leading-relaxed transition-all hover:scale-[1.01] ${borderClass}`}
              >
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-lg bg-glass/10 flex items-center justify-center">
                  {item.icon}
                </span>
                <div className="space-y-1">
                  <span className="font-extrabold text-primary uppercase tracking-wider text-[9px] block">
                    {item.title}
                  </span>
                  <p className="text-secondary font-medium text-[10px] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-glass/40 pt-3 text-[9px] font-semibold text-secondary text-center">
        Cotações de bolsa são atualizadas automaticamente durante o pregão.
      </div>
    </Card>
  )
}
