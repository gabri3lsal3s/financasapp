import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import CurrencyInput from '@/components/CurrencyInput'
import Button from '@/components/Button'
import { formatCurrency, formatPercentBR, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import type { PortfolioGroupTarget } from '@/types'
import { simulateRebalanceAporte, type RebalanceSuggestion } from '@/utils/rebalanceSimulator'
import { ArrowUpCircle, Info, Sparkles, PiggyBank, ArrowUpRight, CheckCircle, AlertTriangle } from 'lucide-react'

interface SmartAporteSimulatorProps {
  portfolioId: string
  positions: ValuedPosition[]
  preferences?: unknown
  groupTargets: PortfolioGroupTarget[]
  totalValue: number
  cashValue: number
}

export default function SmartAporteSimulator({
  positions,
  groupTargets,
  totalValue,
  cashValue
}: SmartAporteSimulatorProps) {
  const [aporteInput, setAporteInput] = useState(0)
  const [simulationResult, setSimulationResult] = useState<{
    suggestions: RebalanceSuggestion[]
    fallbackAmount: number
  } | null>(null)

  const handleSimulate = () => {
    if (isNaN(aporteInput) || aporteInput <= 0) return

    const result = simulateRebalanceAporte(
      positions,
      groupTargets,
      totalValue,
      aporteInput
    )
    setSimulationResult(result)
  }

  // Insights resumidos da carteira
  const insights = useMemo(() => {
    const list: Array<{
      id: string; title: string; description: string; type: 'success' | 'warning' | 'info'; icon: React.ReactNode
    }> = []
    
    if (totalValue <= 0) return list

    // Insight de caixa
    const cashPct = (cashValue / totalValue) * 100
    if (cashPct > 20) {
      list.push({
        id: 'cash_excess', title: 'Caixa Elevado',
        description: `Seu saldo em caixa representa ${formatPercentBR(cashPct, 1)} da carteira. Considere alocar o excedente.`,
        type: 'warning',
        icon: <PiggyBank size={14} />
      })
    } else if (cashPct >= 5 && cashPct <= 20) {
      list.push({
        id: 'cash_healthy', title: 'Caixa Equilibrado',
        description: `Você tem ${formatPercentBR(cashPct, 1)} da carteira em caixa — liquidez saudável.`,
        type: 'success',
        icon: <CheckCircle size={14} />
      })
    }

    // Insight de concentração
    const nonCashPositions = positions.filter(p => p.pricing_mode !== 'cash')
    const maxAsset = nonCashPositions.reduce((max, current) => 
      (current.current_percentage > (max?.current_percentage || 0)) ? current : max
    , null as ValuedPosition | null)

    if (maxAsset && maxAsset.current_percentage > 35) {
      list.push({
        id: 'high_concentration', title: 'Concentração Elevada',
        description: `${maxAsset.ticker} representa ${formatPercentBR(maxAsset.current_percentage, 1)} da carteira.`,
        type: 'warning',
        icon: <AlertTriangle size={14} />
      })
    }

    // Insight de aporte prioritário
    const belowTargetAssets = positions
      .filter(p => p.gap_financial > 0.01)
      .sort((a, b) => b.gap_financial - a.gap_financial)

    if (belowTargetAssets.length > 0) {
      const top1 = belowTargetAssets[0]
      const top2 = belowTargetAssets[1]
      const text = top2
        ? `${top1.ticker} (${formatCurrency(top1.gap_financial)}) e ${top2.ticker} (${formatCurrency(top2.gap_financial)})`
        : `${top1.ticker} (${formatCurrency(top1.gap_financial)})`
      list.push({
        id: 'priority_buys', title: 'Aportes Prioritários',
        description: `Maior defasagem: ${text}.`,
        type: 'info',
        icon: <ArrowUpRight size={14} />
      })
    }
    
    return list
  }, [positions, cashValue, totalValue])

  const hasTargets = useMemo(() => {
    return groupTargets.some(g => g.group_type === 'class' && g.target_percentage > 0) ||
      positions.some(p => p.target_percentage > 0)
  }, [groupTargets, positions])

  if (!hasTargets) {
    return (
      <Card className="border border-glass bg-glass/5 rounded-3xl p-8 text-center space-y-3">
        <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Info size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">Simulador de Aporte</h4>
          <p className="text-xs text-secondary font-medium max-w-sm mx-auto leading-relaxed">
            Defina metas de alocação em "Limites de Exposição" ou na configuração individual dos ativos para habilitar a simulação de rebalanceamento.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-5 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-glass/40 pb-3">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={16} className="text-primary animate-pulse" />
            <span>Simulador de Aporte por Rebalanceamento</span>
          </h4>
          <p className="text-[10px] text-secondary font-medium">
            Calcule a distribuição ideal do seu investimento para equilibrar a carteira segundo suas metas
          </p>
        </div>
      </div>

      {/* Insights compactos */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insights.map((item) => {
            const borderClass = item.type === 'success' 
              ? 'border-income/20 bg-income/5' 
              : item.type === 'warning' 
                ? 'border-expense/20 bg-expense/5' 
                : 'border-primary/20 bg-primary/5'
            return (
              <div
                key={item.id}
                className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-[10px] leading-relaxed ${borderClass}`}
              >
                <span className="shrink-0">{item.icon}</span>
                <div className="min-w-0">
                  <span className="font-black text-primary uppercase tracking-wider text-[8px] block">{item.title}</span>
                  <p className="text-secondary font-medium leading-tight">{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Input de Aporte + Ação Rápida */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[9px] uppercase font-black text-secondary tracking-wider block">
            Valor Disponível para Aporte
          </label>
          {cashValue > 0 && (
            <button
              type="button"
              onClick={() => setAporteInput(cashValue)}
              className="text-[9px] font-black uppercase text-brand hover:text-brand-strong transition-colors flex items-center gap-1"
            >
              <PiggyBank size={11} />
              <span>Usar Saldo em Caixa ({formatCurrency(cashValue)})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3 items-end">
          <CurrencyInput
            value={aporteInput}
            onChange={(_e, val) => setAporteInput(val)}
            placeholder="0,00"
            className="h-10 text-sm font-mono font-bold rounded-2xl"
          />
          <Button
            onClick={handleSimulate}
            disabled={!aporteInput || aporteInput <= 0}
            variant="balance"
            className="h-10 rounded-2xl font-black uppercase text-[10px] tracking-widest"
          >
            Simular
          </Button>
        </div>
      </div>

      {/* Resultados da Simulação */}
      {simulationResult && (
        <div className="space-y-4 animate-fade-in border-t border-glass/20 pt-4">
          <span className="text-[10px] uppercase font-black text-secondary tracking-wider block">
            Sugestões de Rebalanceamento
          </span>

          {/* Sobra de Caixa */}
          {simulationResult.fallbackAmount > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/25 rounded-2xl flex items-start gap-2.5">
              <Info size={16} className="text-warning shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-warning uppercase tracking-wider block">
                  Caixa / Sobra do Aporte
                </span>
                <p className="text-[10px] text-secondary font-medium leading-relaxed">
                  R$ <strong>{formatCurrency(simulationResult.fallbackAmount)}</strong> permanecerão em Caixa devido ao valor unitário de cotas ou por posições já estarem alinhadas com as metas.
                </p>
              </div>
            </div>
          )}

          {/* Lista de Ativos Sugeridos */}
          {simulationResult.suggestions.length === 0 ? (
            <div className="text-center py-6 text-xs text-secondary font-bold">
              Todas as posições estão em linha com suas metas. Todo o valor permanecerá em Caixa.
            </div>
          ) : (
            <div className="space-y-3">
              {simulationResult.suggestions.map((suggestion) => {
                return (
                  <div
                    key={suggestion.ticker}
                    className="p-3.5 rounded-2xl border border-glass bg-glass/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Ativo Info */}
                    <div className="space-y-2 flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-primary font-mono">{suggestion.ticker}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-glass/10 text-secondary font-bold">
                          {suggestion.assetClass}
                        </span>
                      </div>

                      {/* Comparativo de Peso */}
                      <div className="space-y-1 max-w-[280px]">
                        <div className="flex justify-between text-[9px] font-bold text-secondary font-mono">
                          <span>Atual: {formatPercentBR(suggestion.currentPercentage, 1)}</span>
                          <span>Pós-Aporte: {formatPercentBR(suggestion.newPercentage, 1)}</span>
                          {suggestion.targetPercentage > 0 && (
                            <span>Meta: {formatPercentBR(suggestion.targetPercentage, 1)}</span>
                          )}
                        </div>
                        <div className="w-full h-1.5 bg-glass/10 rounded-full overflow-hidden relative flex">
                          <div
                            className="h-full bg-glass/40 transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, (suggestion.currentPercentage / (suggestion.targetPercentage || 100)) * 100)}%` 
                            }}
                          />
                          <div
                            className="h-full bg-income transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, ((suggestion.newPercentage - suggestion.currentPercentage) / (suggestion.targetPercentage || 100)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lotes & Financeiro */}
                    <div className="flex items-center gap-3 shrink-0 sm:text-right">
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase font-black text-secondary block">
                          Comprar
                        </span>
                        <span className="text-xs font-black text-income font-mono block">
                          {suggestion.quantity} un @ {suggestion.currency === 'USD' ? '$' : 'R$'}{formatNumberWithTwoDecimalsBR(suggestion.price)}
                        </span>
                        <span className="text-[10px] text-secondary font-bold font-mono">
                          Total: {formatCurrency(suggestion.totalBrl)}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-income/10 flex items-center justify-center text-income">
                        <ArrowUpCircle size={16} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
