import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { 
  formatCurrency, 
  formatQuantityBR, 
  formatNumberWithTwoDecimalsBR, 
  formatPercentBR, 
  formatSignedPercentBR 
} from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { Settings2, History, ChevronRight } from 'lucide-react'

interface HoldingsTableProps {
  positions: ValuedPosition[]
  onOpenAssetConfig: (ticker: string) => void
  onOpenAssetTransactions: (pos: ValuedPosition) => void
}

export default function HoldingsTable({
  positions,
  onOpenAssetConfig,
  onOpenAssetTransactions
}: HoldingsTableProps) {
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({})

  const toggleClass = (cls: string) => {
    setCollapsedClasses(prev => ({ ...prev, [cls]: !prev[cls] }))
  }

  const activePositions = useMemo(() => 
    positions.filter(p => Math.abs(p.quantity) > 0.000_001), 
    [positions]
  )

  // Agrupar posições por classe
  const groupedPositions = useMemo(() => {
    const groups: Record<string, ValuedPosition[]> = {}
    for (const pos of activePositions) {
      const cls = pos.asset_class || 'Não classificado'
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(pos)
    }
    return groups
  }, [activePositions])

  if (activePositions.length === 0) {
    return (
      <Card className="border border-glass bg-glass/5 rounded-3xl p-8 text-center text-xs font-semibold text-secondary">
        Nenhum ativo em custódia no momento. Adicione transações de compra ou faça uma conciliação B3.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedPositions).map(([assetClass, items]) => {
        const isCollapsed = collapsedClasses[assetClass]
        const classTotal = items.reduce((sum, item) => sum + (item.currency === 'USD' ? item.total_value * item.usd_rate : item.total_value), 0)
        const classAllocation = items.reduce((sum, item) => sum + item.current_percentage, 0)

        return (
          <Card key={assetClass} className="border border-glass bg-glass/5 rounded-3xl overflow-hidden p-0">
            {/* Header da Classe */}
            <div
              onClick={() => toggleClass(assetClass)}
              className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-glass/10 transition-colors select-none border-b border-primary/5"
            >
              <div className="flex items-center gap-2.5">
                <ChevronRight
                  size={16}
                  className={`text-secondary transform transition-transform duration-300 ${isCollapsed ? '' : 'rotate-90'}`}
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
            {!isCollapsed && (
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
                        <th className="py-3 px-3 text-right font-bold">Alocação</th>
                        <th className="py-3 px-4 text-center font-bold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((pos) => {
                        const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
                        const costInBrl = pos.currency === 'USD' ? pos.cost_basis * pos.usd_rate : pos.cost_basis
                        const absoluteGain = valueInBrl - costInBrl
                        const isProfit = absoluteGain >= 0

                        return (
                          <tr key={pos.ticker} className="border-b border-glass/20 hover:bg-glass/10 transition-colors font-semibold">
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
                            {/* Alocação */}
                            <td className="py-3 px-3 text-right font-mono text-secondary font-bold">
                              {formatPercentBR(pos.current_percentage)}
                              {pos.target_percentage > 0 && (
                                <span className="block text-[8px] text-tertiary">alvo: {formatPercentBR(pos.target_percentage)}</span>
                              )}
                            </td>
                            {/* Ações */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex justify-center items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="link"
                                  onClick={() => onOpenAssetConfig(pos.ticker)}
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-glass/10 text-secondary hover:text-primary transition-all flex items-center justify-center border border-transparent hover:border-glass"
                                  title="Configurações do ativo"
                                >
                                  <Settings2 size={14} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="link"
                                  onClick={() => onOpenAssetTransactions(pos)}
                                  className="h-8 w-8 p-0 rounded-lg hover:bg-glass/10 text-secondary hover:text-primary transition-all flex items-center justify-center border border-transparent hover:border-glass"
                                  title="Histórico de transações"
                                >
                                  <History size={14} />
                                </Button>
                              </div>
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

                    return (
                      <div key={pos.ticker} className="p-4 space-y-3 hover:bg-glass/5 transition-colors text-left">
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
                          
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="link"
                              onClick={() => onOpenAssetConfig(pos.ticker)}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-glass/10 text-secondary hover:text-primary transition-all flex items-center justify-center border border-transparent hover:border-glass"
                              title="Configurações do ativo"
                            >
                              <Settings2 size={14} />
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              onClick={() => onOpenAssetTransactions(pos)}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-glass/10 text-secondary hover:text-primary transition-all flex items-center justify-center border border-transparent hover:border-glass"
                              title="Histórico de transações"
                            >
                              <History size={14} />
                            </Button>
                          </div>
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
