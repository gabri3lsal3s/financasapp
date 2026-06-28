import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import Input from '@/components/Input'
import { 
  formatCurrency, 
  formatQuantityBR, 
  formatNumberWithTwoDecimalsBR, 
  formatPercentBR, 
  formatSignedPercentBR 
} from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { ChevronRight, Search } from 'lucide-react'
import { Z_INDEX } from '@/constants/zIndex'

interface HoldingsTableProps {
  positions: ValuedPosition[]
  onOpenAssetDetail: (pos: ValuedPosition) => void
}

export default function HoldingsTable({
  positions,
  onOpenAssetDetail
}: HoldingsTableProps) {
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>()
  const [searchTerm, setSearchTerm] = useState('')

  const toggleClass = (cls: string) => {
    setCollapsedClasses(prev => ({ ...prev, [cls]: !(prev?.[cls] ?? true) }))
  }

  const isCollapsed = (cls: string) => collapsedClasses?.[cls] ?? true

  const activePositions = useMemo(() => 
    positions.filter(p => Math.abs(p.quantity) > 0.000_001), 
    [positions]
  )

  // Filtrar posições por termo de busca
  const filteredPositions = useMemo(() => {
    if (!searchTerm.trim()) return activePositions
    const term = searchTerm.toLowerCase()
    return activePositions.filter(p => 
      p.ticker.toLowerCase().includes(term) ||
      (p.asset_class && p.asset_class.toLowerCase().includes(term))
    )
  }, [activePositions, searchTerm])

  // Agrupar posições por classe
  const groupedPositions = useMemo(() => {
    const groups: Record<string, ValuedPosition[]> = {}
    for (const pos of filteredPositions) {
      const cls = pos.asset_class || 'Não classificado'
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(pos)
    }
    return groups
  }, [filteredPositions])

  if (activePositions.length === 0) {
    return (
      <Card className="border border-glass bg-glass/5 rounded-3xl p-8 text-center text-xs font-semibold text-secondary">
        Nenhum ativo em custódia no momento. Adicione transações de compra ou faça uma conciliação B3.
      </Card>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Barra de busca responsiva */}
      <div className="relative">
        <span className={`absolute inset-y-0 left-3 flex items-center text-secondary pointer-events-none ${Z_INDEX.CONTENT}`}>
          <Search size={14} />
        </span>
        <Input
          type="text"
          placeholder="Buscar por ticker ou classe..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-10 w-full"
        />
        {searchTerm && filteredPositions.length === 0 && (
          <p className="text-[10px] text-secondary font-medium mt-2 text-center">
            Nenhum ativo encontrado para &quot;{searchTerm}&quot;
          </p>
        )}
      </div>

      {Object.entries(groupedPositions).map(([assetClass, items]) => {
        const collapsed = isCollapsed(assetClass)
        const classTotal = items.reduce((sum, item) => sum + (item.currency === 'USD' ? item.total_value * item.usd_rate : item.total_value), 0)
        const classAllocation = items.reduce((sum, item) => sum + item.current_percentage, 0)

        return (
          <Card key={assetClass} className="border border-glass bg-glass/5 rounded-3xl overflow-hidden p-0">
            {/* Header da Classe */}
            <div
              onClick={() => toggleClass(assetClass)}
              className="flex items-center justify-between p-5 lg:p-6 cursor-pointer hover:bg-glass/10 transition-colors select-none border-b border-primary/5"
            >
              <div className="flex items-center gap-2.5">
                <ChevronRight
                  size={16}
                  className={`text-secondary transform transition-transform duration-300 ${collapsed ? '' : 'rotate-90'}`}
                />
                <div>
                  <h4 className="text-sm font-black text-primary uppercase tracking-wider">{assetClass}</h4>
                  <p className="text-[10px] text-secondary font-medium font-mono">
                    {items.length} {items.length === 1 ? 'ativo' : 'ativos'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-primary font-mono">{formatCurrency(classTotal)}</span>
                <p className="text-[10px] text-secondary font-bold font-mono">{formatPercentBR(classAllocation)} da carteira</p>
              </div>
            </div>

            {/* Tabela de Ativos da Classe */}
            {!collapsed && (
              <>
                {/* Desktop View (Tabela clássica) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-glass/40 text-secondary font-bold select-none bg-glass/5 text-[9px] uppercase tracking-wider">
                        <th className="py-3 px-4 font-bold">Ticker</th>
                        <th className="py-3 px-3 text-right font-bold">Quantidade</th>
                        <th className="py-3 px-3 text-right font-bold">Pço Médio</th>
                        <th className="py-3 px-3 text-right font-bold">Pço Atual</th>
                        <th className="py-3 px-3 text-right font-bold">Total</th>
                        <th className="py-3 px-3 text-right font-bold">Rentabilidade</th>
                        <th className="py-3 px-3 text-center font-bold">Qualidade</th>
                        <th className="py-3 px-3 text-center font-bold">Status</th>
                        <th className="py-3 px-4 text-right font-bold">Alocação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((pos) => {
                        const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
                        const costInBrl = pos.currency === 'USD' ? pos.cost_basis * pos.usd_rate : pos.cost_basis
                        const absoluteGain = valueInBrl - costInBrl
                        const isProfit = absoluteGain >= 0

                        const isCashOrRf = pos.pricing_mode === 'cash' || 
                                           pos.pricing_mode === 'fixed_income' || 
                                           pos.asset_class === 'Renda Fixa' || 
                                           pos.asset_class === 'Saldo em Caixa'

                        return (
                          <tr 
                            key={pos.ticker} 
                            onClick={() => onOpenAssetDetail(pos)}
                            className="border-b border-glass/20 hover:bg-glass/10 transition-colors font-semibold cursor-pointer"
                          >
                            {/* Ticker */}
                            <td className="py-3 px-4">
                              <span className="font-black text-primary font-mono text-sm">{pos.ticker}</span>
                              {pos.currency === 'USD' && (
                                <span className="ml-1.5 px-1 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase">
                                  USD
                                </span>
                              )}
                            </td>
                            {/* Quantidade */}
                            <td className="py-3 px-3 text-right font-mono text-secondary">
                              {formatQuantityBR(pos.quantity, 6)}
                            </td>
                            {/* Preço Médio */}
                            <td className="py-3 px-3 text-right font-mono text-secondary">
                              {pos.currency === 'USD' ? '$' : 'R$'}{formatNumberWithTwoDecimalsBR(pos.average_price)}
                            </td>
                            {/* Preço Atual */}
                            <td className="py-3 px-3 text-right font-mono text-primary">
                              {pos.currency === 'USD' ? '$' : 'R$'}{formatNumberWithTwoDecimalsBR(pos.current_price)}
                            </td>
                            {/* Total */}
                            <td className="py-3 px-3 text-right font-mono text-primary font-black">
                              {formatCurrency(valueInBrl)}
                            </td>
                            {/* Rentabilidade */}
                            <td className={`py-3 px-3 text-right font-mono ${isProfit ? 'text-income' : 'text-expense'}`}>
                              {formatSignedPercentBR(pos.gross_yield_pct)}
                            </td>
                            {/* Qualidade */}
                            <td className="py-3 px-3 text-center font-mono">
                              {!isCashOrRf ? (
                                <div className="inline-flex items-center gap-1 justify-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                    pos.conviction_tier === 'S' ? 'bg-[#ffaa00]/15 text-[#ffaa00]' :
                                    pos.conviction_tier === 'A' ? 'bg-[#55aaff]/15 text-[#55aaff]' :
                                    pos.conviction_tier === 'B' ? 'bg-[#aa77ff]/15 text-[#aa77ff]' :
                                    'bg-secondary/15 text-secondary'
                                  }`}>
                                    Tier {pos.conviction_tier || 'S'}
                                  </span>
                                  <span className="text-[10px] text-primary font-bold">
                                    {pos.quality_score != null ? pos.quality_score.toFixed(0) : '100'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-secondary text-[10px] font-bold">-</span>
                              )}
                            </td>
                            {/* Status */}
                            <td className="py-3 px-3 text-center font-mono">
                              {!isCashOrRf ? (
                                <div className="inline-flex items-center justify-center">
                                  {pos.enquadramento_state === 'em_linha' && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-income/10 text-income">
                                      Em Linha
                                    </span>
                                  )}
                                  {pos.enquadramento_state === 'limite_atingido' && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-[#ffaa00]/10 text-[#ffaa00]">
                                      Limite
                                    </span>
                                  )}
                                  {pos.enquadramento_state === 'desenquadrado_excesso' && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-expense/10 text-expense">
                                      Excesso
                                    </span>
                                  )}
                                  {pos.enquadramento_state === 'desenquadrado_obsoleto' && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-expense/10 text-expense animate-pulse">
                                      Obsoleto
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-secondary text-[10px] font-bold">-</span>
                              )}
                            </td>
                            {/* Alocação */}
                            <td className="py-3 px-4 text-right font-mono text-secondary font-bold">
                              {formatPercentBR(pos.current_percentage)}
                              {pos.target_percentage > 0 && (
                                <span className="block text-[8px] text-tertiary">alvo: {formatPercentBR(pos.target_percentage)}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View (Lista de cartões responsivos) */}
                <div className="md:hidden divide-y divide-glass/20">
                  {items.map((pos) => {
                    const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
                    const costInBrl = pos.currency === 'USD' ? pos.cost_basis * pos.usd_rate : pos.cost_basis
                    const absoluteGain = valueInBrl - costInBrl
                    const isProfit = absoluteGain >= 0

                    const isCashOrRf = pos.pricing_mode === 'cash' || 
                                       pos.pricing_mode === 'fixed_income' || 
                                       pos.asset_class === 'Renda Fixa' || 
                                       pos.asset_class === 'Saldo em Caixa'

                    return (
                      <div 
                        key={pos.ticker} 
                        onClick={() => onOpenAssetDetail(pos)}
                        className="p-4 space-y-3 hover:bg-glass/10 active:scale-[0.99] cursor-pointer transition-all text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-primary font-mono text-base">{pos.ticker}</span>
                            {pos.currency === 'USD' && (
                              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase">
                                USD
                              </span>
                            )}
                            <span className="text-[10px] text-secondary font-bold font-mono">
                              {formatQuantityBR(pos.quantity, 4)} un
                            </span>
                          </div>

                          {/* Qualidade e Status no Mobile */}
                          {!isCashOrRf && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                pos.conviction_tier === 'S' ? 'bg-[#ffaa00]/15 text-[#ffaa00]' :
                                pos.conviction_tier === 'A' ? 'bg-[#55aaff]/15 text-[#55aaff]' :
                                pos.conviction_tier === 'B' ? 'bg-[#aa77ff]/15 text-[#aa77ff]' :
                                'bg-secondary/15 text-secondary'
                              }`}>
                                T{pos.conviction_tier || 'S'} ({pos.quality_score != null ? pos.quality_score.toFixed(0) : '100'})
                              </span>
                              {pos.enquadramento_state === 'em_linha' && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-income/10 text-income">
                                  Em Linha
                                </span>
                              )}
                              {pos.enquadramento_state === 'limite_atingido' && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-[#ffaa00]/10 text-[#ffaa00]">
                                  Limite
                                </span>
                              )}
                              {pos.enquadramento_state === 'desenquadrado_excesso' && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-expense/10 text-expense">
                                  Excesso
                                </span>
                              )}
                              {pos.enquadramento_state === 'desenquadrado_obsoleto' && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-expense/10 text-expense animate-pulse">
                                  Obsoleto
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-semibold">
                          <div>
                            <span className="text-[8px] text-secondary uppercase tracking-wider block font-bold">Total Custodiado</span>
                            <span className="text-sm font-black text-primary font-mono">{formatCurrency(valueInBrl)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] text-secondary uppercase tracking-wider block font-bold">Rentabilidade</span>
                            <span className={`text-sm font-black font-mono ${isProfit ? 'text-income' : 'text-expense'}`}>
                              {formatSignedPercentBR(pos.gross_yield_pct)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] text-secondary uppercase tracking-wider block font-bold">Preço Médio / Atual</span>
                            <span className="text-[11px] text-secondary font-mono block">
                              {pos.currency === 'USD' ? '$' : 'R$'}{formatNumberWithTwoDecimalsBR(pos.average_price)} / {pos.currency === 'USD' ? '$' : 'R$'}{formatNumberWithTwoDecimalsBR(pos.current_price)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] text-secondary uppercase tracking-wider block font-bold">Alocação (Alvo)</span>
                            <span className="text-xs text-primary font-mono block">
                              {formatPercentBR(pos.current_percentage)}
                              {pos.target_percentage > 0 && (
                                <span className="text-[8px] text-tertiary ml-1">({formatPercentBR(pos.target_percentage)})</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}
