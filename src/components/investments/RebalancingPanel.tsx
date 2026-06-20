import Card from '@/components/Card'
import Button from '@/components/Button'
import { X } from 'lucide-react'
import { formatCurrency, formatCurrencyByCode, formatPercentBR } from '@/utils/format'
import type { AssetPosition, ConsolidatedGroup } from '@/services/investmentEngine'
import type { PortfolioData } from '@/hooks/usePortfolio'
import { Badge } from '@/components/ui/badge'

interface RebalancingPanelProps {
  selectedPieSegment: { name: string; value: number; percent: number; target: number } | null
  setSelectedPieSegment: (segment: null) => void
  activeGroupAssets: AssetPosition[]
  consolidationView: 'class' | 'sector'
  portfolioData: PortfolioData
  chartPalette: string[]
  onAssetClick: (ticker: string) => void
  onGroupClick: (group: { name: string; value: number; percent: number; target: number }) => void
}

export default function RebalancingPanel({
  selectedPieSegment,
  setSelectedPieSegment,
  activeGroupAssets,
  consolidationView,
  portfolioData,
  chartPalette,
  onAssetClick,
  onGroupClick,
}: RebalancingPanelProps) {
  const currentGroups: ConsolidatedGroup[] =
    consolidationView === 'class' ? portfolioData.consolidatedClass : portfolioData.consolidatedSector

  return (
    <Card className="p-4 lg:p-6 flex flex-col text-left">
      <div className="flex items-center justify-between pb-2 border-b border-primary/5 mb-4 flex-wrap gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-primary">
          {selectedPieSegment
            ? `Ativos em ${selectedPieSegment.name}`
            : 'Rebalanceamento de Carteira'}
        </h4>
        {selectedPieSegment ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPieSegment(null)}
            className="!min-h-0 text-[9px] font-black uppercase tracking-wider text-secondary hover:text-primary flex items-center gap-1 py-1 px-2.5 rounded-full bg-secondary/50"
          >
            <X size={10} />
            <span>Voltar para grupos</span>
          </Button>
        ) : (
          <span className="text-[9px] font-black text-secondary uppercase tracking-widest bg-secondary/50 px-2 py-0.5 rounded-full font-sans">
            Meta Recomendada
          </span>
        )}
      </div>

      <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
        {selectedPieSegment ? (
          activeGroupAssets.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-secondary italic text-xs">
              Nenhum ativo individual cadastrado nesta fatia.
            </div>
          ) : (
            activeGroupAssets.map((pos, index) => {
              const targetPct = pos.target_percentage || 0
              const currentPct = pos.current_percentage || 0
              const devPct = currentPct - targetPct
              const diffValue = portfolioData.totalValue * (targetPct / 100) - pos.total_value

              let badgeVariant: 'success' | 'warning' | 'expense' | 'secondary' | 'outline' = 'secondary'
              let statusText = 'Sem meta'

              if (targetPct > 0) {
                if (devPct > 1.0) {
                  badgeVariant = 'warning'
                  statusText = 'Acima do Alvo'
                } else if (devPct < -1.0) {
                  badgeVariant = 'success'
                  statusText = `Aporte sugerido: +${formatCurrencyByCode(diffValue, pos.currency)}`
                } else {
                  badgeVariant = 'outline'
                  statusText = 'Alinhado'
                }
              }

              return (
                <div
                  key={pos.ticker}
                  onClick={() => onAssetClick(pos.ticker)}
                  className="p-3.5 surface-glass border border-glass rounded-2xl flex flex-col gap-2 text-left cursor-pointer hover-lift-subtle shadow-sm transition-all select-none"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: chartPalette[index % chartPalette.length] }}
                      />
                      <span className="font-mono font-black text-primary text-xs tracking-wider truncate">
                        {pos.ticker}
                      </span>
                    </div>
                    <Badge variant={badgeVariant} className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 shrink-0 rounded-full">
                      {statusText}
                    </Badge>
                  </div>

                  {/* Barra horizontal de alocação vs alvo */}
                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-primary/10 relative overflow-hidden">
                      <div
                        className="h-full bg-income rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pos.current_percentage, 100)}%` }}
                      />
                      {targetPct > 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary/60"
                          style={{ left: `${Math.min(targetPct, 99)}%` }}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-secondary font-mono leading-none">
                      <span>
                        Real: {formatPercentBR(pos.current_percentage, 1)} ({formatCurrencyByCode(pos.total_value, pos.currency)})
                      </span>
                      <span>Alvo: {formatPercentBR(targetPct, 0)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )
        ) : (
          currentGroups.map((group, index) => {
            const targetPct = group.target_percentage || 0
            const currentPct = group.current_percentage || 0
            const devPct = currentPct - targetPct
            const diffValue = portfolioData.totalValue * (targetPct / 100) - group.total_value

            let badgeVariant: 'success' | 'warning' | 'expense' | 'secondary' | 'outline' = 'secondary'
            let statusText = 'Sem meta'

            if (targetPct > 0) {
              if (devPct > 1.5) {
                badgeVariant = 'warning'
                statusText = 'Acima do Alvo'
              } else if (devPct < -1.5) {
                badgeVariant = 'success'
                statusText = `Aporte: +${formatCurrency(diffValue)}`
              } else {
                badgeVariant = 'outline'
                statusText = 'Alinhado'
              }
            }

            return (
              <div
                key={group.name}
                onClick={() =>
                  onGroupClick({
                    name: group.name,
                    value: group.total_value,
                    percent: group.current_percentage,
                    target: group.target_percentage,
                  })
                }
                className="p-3.5 surface-glass border border-glass rounded-2xl flex flex-col gap-2 text-left cursor-pointer hover-lift-subtle shadow-sm transition-all select-none"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: chartPalette[index % chartPalette.length] }}
                    />
                    <span className="font-bold text-primary text-xs tracking-wide truncate">
                      {group.name}
                    </span>
                  </div>
                  <Badge variant={badgeVariant} className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 shrink-0 rounded-full">
                    {statusText}
                  </Badge>
                </div>

                {/* Barra horizontal de alocação vs alvo */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-primary/10 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        consolidationView === 'class' ? 'bg-balance' : 'bg-income'
                      }`}
                      style={{ width: `${Math.min(group.current_percentage, 100)}%` }}
                    />
                    {targetPct > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary/60"
                        style={{ left: `${Math.min(targetPct, 99)}%` }}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-secondary font-mono leading-none">
                    <span>
                      Real: {formatPercentBR(group.current_percentage, 1)} ({formatCurrency(group.total_value)})
                    </span>
                    <span>Alvo: {formatPercentBR(targetPct, 0)}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
