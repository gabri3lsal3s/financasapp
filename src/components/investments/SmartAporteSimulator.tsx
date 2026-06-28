import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import NumberInput from '@/components/NumberInput'
import Button from '@/components/Button'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { PortfolioQuantPreferences, PortfolioGroupTarget } from '@/types'
import { simulateSmartAporte, SmartAporteSuggestion } from '@/utils/quantamentalEngine'
import { ArrowUpCircle, Info, Sparkles, Terminal, ChevronDown, ChevronUp, ClipboardCheck, AlertTriangle, CheckCircle, PiggyBank, ArrowUpRight } from 'lucide-react'
import ScuttlebuttEvaluationModal from '@/components/investments/ScuttlebuttEvaluationModal'

interface SmartAporteSimulatorProps {
  portfolioId: string
  positions: ValuedPosition[]
  preferences: PortfolioQuantPreferences | null
  groupTargets: PortfolioGroupTarget[]
  totalValue: number
  cashValue: number
}

export default function SmartAporteSimulator({
  portfolioId,
  positions,
  preferences,
  groupTargets,
  totalValue,
  cashValue
}: SmartAporteSimulatorProps) {
  const [aporteInput, setAporteInput] = useState('')
  const [simulationResult, setSimulationResult] = useState<{
    suggestions: SmartAporteSuggestion[]
    fallbackAmount: number
    routingLog: string[]
  } | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [selectedTickerForScuttlebutt, setSelectedTickerForScuttlebutt] = useState<string | null>(null)

  const defaultPreferences = useMemo<PortfolioQuantPreferences>(() => {
    return preferences || {
      portfolio_id: '',
      tier_s_limit: 20,
      tier_a_limit: 10,
      tier_b_limit: 5,
      tier_c_limit: 0,
      max_sector_acoes: 30,
      max_sector_fiis: 45,
      min_roic_excelente: 15,
      max_divida_ebitda: 2.5,
      scuttlebutt_decay_days: 365
    }
  }, [preferences])

  const handleSimulate = () => {
    const amount = parseFloat(aporteInput)
    if (isNaN(amount) || amount <= 0) return

    const result = simulateSmartAporte(
      positions,
      defaultPreferences,
      groupTargets,
      totalValue,
      amount
    )
    setSimulationResult(result)
  }

  // Insights da carteira (fundido de InvestmentsInsights)
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
        description: `Seu saldo em caixa representa ${formatPercentBR(cashPct, 1)} da carteira. Considere alocar o excedente via simulador abaixo.`,
        type: 'warning',
        icon: <PiggyBank size={14} />
      })
    } else if (cashPct >= 5 && cashPct <= 20) {
      list.push({
        id: 'cash_healthy', title: 'Caixa Equilibrado',
        description: `Você tem ${formatPercentBR(cashPct, 1)} da carteira em caixa — patamar saudável de liquidez.`,
        type: 'success',
        icon: <CheckCircle size={14} />
      })
    } else if (cashPct > 0) {
      list.push({
        id: 'cash_low', title: 'Caixa Baixo',
        description: `Seu caixa representa apenas ${formatPercentBR(cashPct, 1)} da carteira. Pouca liquidez para novos aportes.`,
        type: 'info',
        icon: <Info size={14} />
      })
    }

    // Insight de concentração
    const nonCashPositions = positions.filter(p => 
      !['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(p.ticker.toUpperCase())
    )
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
        description: `Para aproximar dos alvos, priorize: ${text}.`,
        type: 'info',
        icon: <ArrowUpRight size={14} />
      })
    }
    
    return list
  }, [positions, cashValue, totalValue])

  const hasTargets = useMemo(() => groupTargets.some(g => g.group_type === 'class'), [groupTargets])

  if (!hasTargets) {
    return (
      <Card className="border border-glass bg-glass/5 rounded-3xl p-8 text-center space-y-3">
        <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Info size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">Simulador Smart Aporte</h4>
          <p className="text-xs text-secondary font-medium max-w-sm mx-auto leading-relaxed">
            Defina as metas de alocação macro das classes em "Limites de Exposição" para habilitar a simulação inteligente de aportes.
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
            <span>Simulador Smart Aporte</span>
          </h4>
          <p className="text-[10px] text-secondary font-medium">
            Roteamento matemático inteligente do seu aporte baseado em Tiers, travas e defasagens
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

      {/* Input de Aporte */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3 items-end">
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-black text-secondary tracking-wider block">
            Valor Disponível para Aporte
          </label>
          <NumberInput
            value={aporteInput}
            onChange={(e) => setAporteInput(e.target.value)}
            placeholder="0,00"
            prefix="R$"
            className="h-10 text-sm font-mono font-bold rounded-2xl"
          />
        </div>
        <Button
          onClick={handleSimulate}
          disabled={!aporteInput || parseFloat(aporteInput) <= 0}
          variant="balance"
          className="h-10 rounded-2xl font-black uppercase text-[10px] tracking-widest"
        >
          Simular
        </Button>
      </div>

      {/* Resultados da Simulação */}
      {simulationResult && (
        <div className="space-y-4 animate-fade-in">
          {/* Título de Resultados */}
          <div className="border-t border-glass/20 pt-4">
            <span className="text-[10px] uppercase font-black text-secondary tracking-wider block">
              Sugestões de Alocação
            </span>
          </div>

          {/* Fallback de Caixa / Reserva Tática */}
          {simulationResult.fallbackAmount > 0 && (
            <div className="p-3 bg-[#ffaa00]/10 border border-[#ffaa00]/25 rounded-2xl flex items-start gap-2.5">
              <Info size={16} className="text-[#ffaa00] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-[#ffaa00] uppercase tracking-wider block">
                  Caixa / Reserva Tática
                </span>
                <p className="text-[10px] text-secondary font-medium leading-relaxed">
                  R$ <strong>{formatCurrency(simulationResult.fallbackAmount)}</strong> foram direcionados para o Caixa da carteira devido ao arredondamento de cotas ou à falta de espaço de novos aportes nos ativos em linha.
                </p>
              </div>
            </div>
          )}

          {/* Tabela/Lista de Ativos Sugeridos */}
          {simulationResult.suggestions.length === 0 ? (
            <div className="text-center py-6 text-xs text-secondary font-bold">
              Nenhuma compra sugerida para a carteira. Todo o aporte foi direcionado para Caixa.
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
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          suggestion.convictionTier === 'S' ? 'bg-[#ffaa00]/15 text-[#ffaa00]' :
                          suggestion.convictionTier === 'A' ? 'bg-[#55aaff]/15 text-[#55aaff]' :
                          suggestion.convictionTier === 'B' ? 'bg-[#aa77ff]/15 text-[#aa77ff]' :
                          'bg-secondary/15 text-secondary'
                        }`}>
                          Tier {suggestion.convictionTier}
                        </span>
                        <span className="text-[9px] font-bold text-secondary font-mono">
                          Score: {suggestion.qualityScore.toFixed(0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTickerForScuttlebutt(suggestion.ticker)}
                          className="p-1 rounded bg-glass/10 text-secondary hover:bg-glass/25 hover:text-primary transition-all duration-200"
                          title="Avaliar Qualitativo (Scuttlebutt)"
                        >
                          <ClipboardCheck size={11} />
                        </button>
                      </div>

                      {/* Comparativo de Peso */}
                      <div className="space-y-1 max-w-[280px]">
                        <div className="flex justify-between text-[9px] font-bold text-secondary font-mono">
                          <span>Atual: {formatPercentBR(suggestion.currentPercentage, 1)}</span>
                          <span>Pós: {formatPercentBR(suggestion.newPercentage, 1)}</span>
                          <span>Limite: {formatPercentBR(suggestion.absoluteLimit, 1)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-glass/10 rounded-full overflow-hidden relative flex">
                          {/* Percentual Atual (Cinza/Azul) */}
                          <div
                            className="h-full bg-glass/40 transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, (suggestion.currentPercentage / (suggestion.absoluteLimit || 1)) * 100)}%` 
                            }}
                            title={`Atual: ${formatPercentBR(suggestion.currentPercentage, 1)}`}
                          />
                          {/* Aporte Adicional (Verde) */}
                          <div
                            className="h-full bg-income transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, ((suggestion.newPercentage - suggestion.currentPercentage) / (suggestion.absoluteLimit || 1)) * 100)}%` 
                            }}
                            title={`Aporte: +${formatPercentBR(suggestion.newPercentage - suggestion.currentPercentage, 1)}`}
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
                          {suggestion.quantity} un @ {suggestion.currency === 'USD' ? '$' : 'R$'}{suggestion.price.toFixed(2)}
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

          {/* Log de Roteamento Expansível */}
          <div className="border border-glass/20 rounded-2xl overflow-hidden bg-glass/5">
            <button
              type="button"
              onClick={() => setShowLog(!showLog)}
              className="w-full p-3 flex justify-between items-center text-[10px] uppercase font-black tracking-wider text-secondary hover:bg-glass/5 transition-all"
            >
              <div className="flex items-center gap-1.5">
                <Terminal size={14} className="text-secondary" />
                <span>Log do Roteamento Financeiro</span>
              </div>
              {showLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            
            {showLog && (
              <div className="p-3 bg-black/40 border-t border-glass/10 font-mono text-[9px] leading-relaxed text-secondary-strong max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar text-left">
                {simulationResult.routingLog.map((line, idx) => (
                  <div key={idx} className={line.startsWith('[Classe') ? 'text-primary font-bold pt-1.5' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Modal de Avaliação Qualitativa */}
      {selectedTickerForScuttlebutt && (
        <ScuttlebuttEvaluationModal
          isOpen={!!selectedTickerForScuttlebutt}
          onClose={() => setSelectedTickerForScuttlebutt(null)}
          portfolioId={portfolioId}
          ticker={selectedTickerForScuttlebutt}
        />
      )}
    </Card>
  )
}
