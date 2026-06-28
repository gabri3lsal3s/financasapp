import { useMemo, useState } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import ScuttlebuttEvaluationModal from '@/components/investments/ScuttlebuttEvaluationModal'
import {
  formatCurrency,
  formatQuantityBR,
  formatNumberWithTwoDecimalsBR,
  formatPercentBR,
  formatSignedPercentBR,
  formatDate
} from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import type { PortfolioTransaction, PortfolioQuantPreferences } from '@/types'
import { getQuantitativeScoreDetails } from '@/utils/quantamentalEngine'
import { Settings2, History, ClipboardCheck } from 'lucide-react'
import { Z_INDEX } from '@/constants/zIndex'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import { chartAnimProps } from '@/types/recharts'

interface AssetDetailModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  position: ValuedPosition | null
  transactions: PortfolioTransaction[]
  preferences: PortfolioQuantPreferences | null
  onOpenAssetConfig: (ticker: string) => void
  onEditTransaction: (tx: PortfolioTransaction) => void
  onViewInLedger: (ticker: string) => void
}

export default function AssetDetailModal({
  isOpen,
  onClose,
  portfolioId,
  position,
  transactions,
  preferences,
  onOpenAssetConfig,
  onEditTransaction,
  onViewInLedger
}: AssetDetailModalProps) {
  const animProps = useMemo(() => chartAnimProps(), [])
  const [isScuttlebuttOpen, setIsScuttlebuttOpen] = useState(false)

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

  const quantDetails = useMemo(() => {
    if (!position || !position.fundamentals) return []
    return getQuantitativeScoreDetails(position.asset_class, position.fundamentals, defaultPreferences)
  }, [position, defaultPreferences])

  // Filtrar transações exclusivas do ativo ordenadas por data
  const assetTransactions = useMemo(() => {
    if (!position) return []
    return transactions
      .filter((t) => t.ticker.toUpperCase().trim() === position.ticker.toUpperCase().trim())
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [transactions, position])

  // Calcular histórico cumulativo para o gráfico
  const chartData = useMemo(() => {
    if (!position || assetTransactions.length === 0) return []

    let runningQty = 0
    let runningCost = 0
    let totalDividends = 0
    const dailyMap: Record<string, { quantity: number; cost: number; dividends: number }> = {}

    assetTransactions.forEach((tx) => {
      const q = Number(tx.quantity)
      const p = Number(tx.price)
      
      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        runningQty += q
        runningCost += q * p
      } else if (tx.operation_type === 'sell') {
        if (runningQty > 0) {
          const avgP = runningCost / runningQty
          runningQty = Math.max(0, runningQty - q)
          runningCost = runningQty * avgP
        }
      } else if (tx.operation_type === 'split') {
        runningQty += q
      } else if (tx.operation_type === 'reverse_split') {
        runningQty = Math.max(0, runningQty - q)
      } else if (['dividend', 'jcp', 'fii_yield'].includes(tx.operation_type)) {
        totalDividends += q * p
      }

      dailyMap[tx.date] = {
        quantity: runningQty,
        cost: runningCost,
        dividends: totalDividends
      }
    })

    const result = Object.entries(dailyMap)
      .map(([date, data]) => {
        const valBrl = data.quantity * position.current_price
        return {
          date: date.split('-').reverse().slice(0, 2).join('/'),
          fullDate: date,
          quantidade: data.quantity,
          valorEstimado: valBrl,
          custoAcumulado: data.cost,
          proventosAcumulados: data.dividends
        }
      })
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))

    // Se tiver apenas um ponto, duplicar para fazer a linha no gráfico
    if (result.length === 1) {
      const single = result[0]
      return [
        { ...single, date: '', fullDate: 'Inicial' },
        single
      ]
    }

    return result
  }, [assetTransactions, position])

  if (!position) return null

  const valueInBrl = position.currency === 'USD' ? position.total_value * position.usd_rate : position.total_value
  const costInBrl = position.currency === 'USD' ? position.cost_basis * position.usd_rate : position.cost_basis
  const absoluteGain = valueInBrl - costInBrl
  const isProfit = absoluteGain >= 0

  const isCashOrRf = position.pricing_mode === 'cash' || 
                     position.pricing_mode === 'fixed_income' || 
                     position.asset_class === 'Renda Fixa' || 
                     position.asset_class === 'Saldo em Caixa'

  const isEtf = (position.asset_class || '').trim().toUpperCase().includes('ETF')

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Detalhamento: ${position.ticker}`}
        size="lg"
        footer={(
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => onViewInLedger(position.ticker)}
              className="flex-1 rounded-xl h-10 text-xs font-black uppercase tracking-wider gap-1.5 flex items-center justify-center"
            >
              <History size={14} />
              <span>Ver no Livro Razão</span>
            </Button>
            <Button
              type="button"
              variant="balance"
              onClick={() => onOpenAssetConfig(position.ticker)}
              className="flex-1 rounded-xl h-10 text-xs font-black uppercase tracking-wider gap-1.5 flex items-center justify-center"
            >
              <Settings2 size={14} />
              <span>Configurar Ativo</span>
            </Button>
          </div>
        )}
      >
        <div className="space-y-5 text-left">
          
          {/* Metadados Básicos */}
          <div className="flex items-center justify-between gap-3 bg-glass/5 p-3 rounded-2xl border border-glass/20">
            <div>
              <span className="text-[10px] font-black text-secondary uppercase tracking-widest block">Classe de Ativo</span>
              <span className="text-sm font-black text-primary uppercase tracking-wider">{position.asset_class}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-secondary uppercase tracking-widest block">Setor</span>
              <span className="text-sm font-bold text-primary">{position.sector}</span>
            </div>
          </div>

          {/* Grade de KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-glass surface-glass p-3.5 space-y-1">
              <span className="text-[9px] uppercase font-black text-secondary tracking-wider block">Total Custodiado</span>
              <span className="text-base font-black font-mono text-primary block leading-tight">
                {formatCurrency(valueInBrl)}
              </span>
              {position.currency === 'USD' && (
                <span className="text-[10px] font-mono text-secondary block">
                  ${formatNumberWithTwoDecimalsBR(position.total_value)} USD
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-glass surface-glass p-3.5 space-y-1">
              <span className="text-[9px] uppercase font-black text-secondary tracking-wider block">Rentabilidade</span>
              <span className={`text-base font-black font-mono block leading-tight ${isProfit ? 'text-income' : 'text-expense'}`}>
                {formatSignedPercentBR(position.gross_yield_pct)}
              </span>
              <span className="text-[10px] text-secondary font-medium block">
                {isProfit ? 'Ganho: ' : 'Perda: '}
                <strong className={isProfit ? 'text-income' : 'text-expense'}>
                  {formatCurrency(Math.abs(absoluteGain))}
                </strong>
              </span>
            </div>

            <div className="rounded-2xl border border-glass surface-glass p-3.5 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[9px] uppercase font-black text-secondary tracking-wider block">Quantidade</span>
              <span className="text-base font-black font-mono text-primary block leading-tight">
                {formatQuantityBR(position.quantity, 6)}
              </span>
              <span className="text-[10px] text-secondary font-medium block">
                PM: {position.currency === 'USD' ? '$' : 'R$'}{formatNumberWithTwoDecimalsBR(position.average_price)}
              </span>
            </div>
          </div>

          {/* Seção Quantamental (Convicção e Enquadramento) */}
          {!isCashOrRf && (
            <div className="p-4 bg-glass/5 rounded-3xl border border-glass/25 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] uppercase font-black tracking-wider text-secondary">
                    Classificação Quantamental
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    {/* Badge de Tier de Convicção */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      position.conviction_tier === 'S' ? 'bg-[#ffaa00]/15 text-[#ffaa00]' :
                      position.conviction_tier === 'A' ? 'bg-[#55aaff]/15 text-[#55aaff]' :
                      position.conviction_tier === 'B' ? 'bg-[#aa77ff]/15 text-[#aa77ff]' :
                      'bg-secondary/15 text-secondary'
                    }`}>
                      Tier {position.conviction_tier}
                    </span>
                    
                    {/* Badge de Enquadramento State */}
                    {position.enquadramento_state === 'em_linha' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-income/10 text-income">
                        Em Linha
                      </span>
                    )}
                    {position.enquadramento_state === 'limite_atingido' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#ffaa00]/10 text-[#ffaa00]">
                        Limite Atingido
                      </span>
                    )}
                    {position.enquadramento_state === 'desenquadrado_excesso' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-expense/10 text-expense">
                        Excesso de Exposição
                      </span>
                    )}
                    {position.enquadramento_state === 'desenquadrado_obsoleto' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-expense/10 text-expense animate-pulse">
                        Qualitativo Obsoleto
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="text-[9px] uppercase font-black text-secondary block">Score de Qualidade</span>
                  <span className="text-xl font-black text-primary font-mono">
                    {position.quality_score != null ? position.quality_score.toFixed(1) : '100.0'}
                  </span>
                </div>
              </div>
              
              {!isEtf ? (
                <div className="grid grid-cols-2 gap-4 border-t border-glass/10 pt-2 text-[10px]">
                  <div>
                    <span className="text-secondary font-bold block">Qualitativo (Scuttlebutt):</span>
                    <span className="text-primary font-black font-mono">
                      {position.scuttlebutt_score != null ? position.scuttlebutt_score.toFixed(1) : '100.0'}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary font-bold block">Quantitativo (Fundamentos):</span>
                    <span className="text-primary font-black font-mono">
                      {position.quantitative_score != null ? position.quantitative_score.toFixed(1) : '100.0'}/100
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-t border-glass/10 pt-2 text-[10px]">
                  <span className="text-secondary font-bold block">Quantitativo (Taxa/Tracking Error):</span>
                  <span className="text-primary font-black font-mono">
                    {position.quantitative_score != null ? position.quantitative_score.toFixed(1) : '100.0'}/100
                  </span>
                </div>
              )}
              
              {/* Detalhamento de Critérios Quantitativos */}
              {quantDetails.length > 0 && (
                <div className="border-t border-glass/10 pt-3 space-y-2">
                  <span className="text-[9px] uppercase font-black text-secondary block">
                    Checklist de Fundamentos Quantitativos
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {quantDetails.map((detail, idx) => (
                      <div 
                        key={idx} 
                        className="p-2.5 rounded-xl border border-glass/10 bg-glass/5 flex items-center justify-between gap-3 text-[10px]"
                      >
                        <div className="space-y-0.5 text-left">
                          <span className="font-bold text-primary block leading-tight">{detail.name}</span>
                          <span className="text-[8px] text-secondary block leading-normal">{detail.description}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-primary font-black block">{detail.valueFormatted}</span>
                          <span className={`text-[8px] font-black uppercase ${
                            detail.passed === 'yes' ? 'text-income' :
                            detail.passed === 'partial' ? 'text-[#ffaa00]' : 'text-expense'
                          }`}>
                            {detail.pointsEarned} / {detail.pointsPossible} pts ({detail.passed === 'yes' ? 'Passou' : detail.passed === 'partial' ? 'Parcial' : 'Rejeitado'})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {position.is_decayed && (
                <div className="p-2.5 bg-expense/10 border border-expense/25 rounded-xl text-[10px] text-secondary font-semibold leading-relaxed flex items-start gap-2">
                  <span className="text-expense">⚠️</span>
                  <span>
                    Avaliação qualitativa (Scuttlebutt) expirada
                    {position.scuttlebutt_last_updated && (
                      <> (última atualização: {new Date(position.scuttlebutt_last_updated).toLocaleDateString('pt-BR')})</>
                    )}. Recomenda-se refazer o questionário para restaurar a confiabilidade do score de convicção.
                  </span>
                </div>
              )}

              <div className="border-t border-glass/10 pt-2 flex items-center justify-between text-[10px]">
                <div>
                  <span className="text-secondary font-bold">Limite Absoluto:</span>
                  <span className="text-primary font-black font-mono ml-1">
                    {position.absolute_limit != null ? position.absolute_limit.toFixed(2) : '100.0'}% da Carteira
                  </span>
                </div>
                {!isEtf && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsScuttlebuttOpen(true)}
                    className="h-6 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <ClipboardCheck size={11} />
                    <span>Avaliar Qualitativo</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Metas de Alocação Alvo */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-[10px] uppercase font-black text-secondary tracking-wider">Metas de Alocação</span>
              <span className="text-primary font-mono">{formatPercentBR(position.current_percentage)} / {formatPercentBR(position.target_percentage)} alvo</span>
            </div>
            
            <div className="w-full h-3 rounded-full bg-glass/20 overflow-hidden relative border border-glass/40">
              {position.target_percentage > 0 && (
                <div 
                  className={`absolute top-0 bottom-0 w-0.5 bg-secondary-strong/60 ${Z_INDEX.CONTENT}`}
                  style={{ left: `${Math.min(100, position.target_percentage)}%` }}
                  title="Alvo"
                />
              )}
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, position.current_percentage)}%`,
                  backgroundColor: 'var(--color-primary)'
                }}
              />
            </div>

            {position.target_percentage > 0 && (
              <div className="flex justify-between items-center text-[10px] text-secondary font-bold">
                <span>Desvio de alocação: <strong className={position.gap_percentage <= 0 ? 'text-income' : 'text-warning'}>{formatSignedPercentBR(position.gap_percentage)}</strong></span>
                <span>GAP financeiro: <strong className={position.gap_financial <= 0 ? 'text-income' : 'text-warning'}>{formatCurrency(position.gap_financial)}</strong></span>
              </div>
            )}
          </div>

          {/* Gráfico de Evolução */}
          {chartData.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-black text-secondary tracking-wider">Histórico do Ativo</span>
              <div className="rounded-2xl border border-glass surface-glass p-3">
                <div className="h-[120px] w-full pr-3">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.1} vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="var(--color-text-secondary)" 
                        fontSize={8} 
                        tickLine={false}
                        axisLine={false}
                        minTickGap={15}
                      />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={8}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatCurrency(v).replace('R$', '').trim()}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-glass/95 border border-glass rounded-2xl p-2.5 shadow-lg flex flex-col gap-1 text-[10px] font-semibold min-w-[140px]">
                                <span className="text-[9px] uppercase font-black text-secondary">{data.fullDate}</span>
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-secondary">Posição:</span>
                                  <span className="text-primary font-black font-mono">{formatCurrency(data.valorEstimado)}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-secondary">Qtd:</span>
                                  <span className="text-primary font-mono">{formatQuantityBR(data.quantidade, 4)}</span>
                                </div>
                                {data.proventosAcumulados > 0 && (
                                  <div className="flex justify-between items-center gap-2 pt-1 border-t border-glass/25">
                                    <span className="text-income font-bold">Proventos:</span>
                                    <span className="text-income font-black font-mono">{formatCurrency(data.proventosAcumulados)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="valorEstimado" 
                        stroke="var(--color-primary)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorAsset)"
                        activeDot={{ r: 4, stroke: 'var(--color-primary)', strokeWidth: 1.5, fill: 'var(--color-bg-primary)' }}
                        {...animProps} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Lista de Transações */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-black text-secondary tracking-wider block">Histórico de Movimentações</span>
            {assetTransactions.length === 0 ? (
              <p className="text-xs text-secondary italic">Nenhuma transação encontrada.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1.5 custom-scrollbar">
                {assetTransactions.map((tx) => {
                  const totalTx = Number(tx.quantity) * Number(tx.price)
                  const isBuy = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                  const isSell = tx.operation_type === 'sell'
                  const isIncome = ['dividend', 'jcp', 'fii_yield'].includes(tx.operation_type)

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
                    <div
                      key={tx.id}
                      onClick={() => {
                        onEditTransaction(tx)
                      }}
                      className="p-3 bg-glass/5 hover:bg-glass/15 border border-glass/20 hover:border-glass/40 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 active:scale-[0.99]"
                      title="Clique para editar ou excluir esta transação"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${opColor}`}>
                            {opLabel}
                          </span>
                          <span className="text-[10px] text-secondary font-bold font-mono">
                            {formatDate(tx.date)}
                          </span>
                        </div>
                        <div className="text-[10px] text-secondary font-medium font-mono">
                          {formatQuantityBR(Number(tx.quantity), 4)} un × {position.currency === 'USD' && isIncome ? '$' : 'R$'}{formatNumberWithTwoDecimalsBR(Number(tx.price))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-primary font-mono block">
                          {formatCurrency(totalTx)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </Modal>

      {/* Modal de Avaliação Qualitativa */}
      <ScuttlebuttEvaluationModal
        isOpen={isScuttlebuttOpen}
        onClose={() => {
          setIsScuttlebuttOpen(false)
        }}
        portfolioId={portfolioId}
        ticker={position.ticker}
      />
    </>
  )
}
