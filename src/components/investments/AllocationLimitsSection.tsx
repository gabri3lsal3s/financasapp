import Card from '@/components/Card'
import IconButton from '@/components/IconButton'
import { Layers, Plus, Trash2 } from 'lucide-react'
import type { PortfolioGroupTarget } from '@/types'

interface AllocationLimitsSectionProps {
  groupTargets: PortfolioGroupTarget[]
  consolidationView: 'class' | 'sector'
  limitsCollapsed: boolean
  setLimitsCollapsed: (collapsed: boolean) => void
  onEditGroupTarget: (gt: PortfolioGroupTarget) => void
  onDeleteGroupTarget: (id: string) => void
  onNewLimit: () => void
  sumClass: number
  sumSector: number
}

export default function AllocationLimitsSection({
  groupTargets,
  consolidationView,
  limitsCollapsed,
  setLimitsCollapsed,
  onEditGroupTarget,
  onDeleteGroupTarget,
  onNewLimit,
  sumClass,
  sumSector,
}: AllocationLimitsSectionProps) {
  const filteredTargets = groupTargets.filter((gt) => gt.group_type === consolidationView)
  const currentSum = consolidationView === 'class' ? sumClass : sumSector

  return (
    <Card className="space-y-4">
      <div
        onClick={() => setLimitsCollapsed(!limitsCollapsed)}
        className="flex items-center justify-between gap-3 text-left cursor-pointer hover:opacity-85 transition-opacity duration-200 select-none"
      >
        <div className="flex items-start gap-2.5">
          <Layers size={18} className="text-balance shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-primary">Configurar Limites de Exposição Alvo</h4>
            <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
              Defina metas de exposição percentuais para equilibrar e guiar o rebalanceamento automático da sua carteira.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-secondary shrink-0">
          <span className="text-[10px] font-black bg-balance/10 text-balance px-2 py-0.5 rounded-full font-mono">
            {filteredTargets.length}
          </span>
          <Plus
            size={16}
            className={`transition-transform duration-300 ${
              !limitsCollapsed ? 'rotate-45 text-primary' : 'rotate-0 text-secondary/60'
            }`}
          />
        </div>
      </div>

      <div
        className={`pt-3 border-t border-primary/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-left w-full ${
          limitsCollapsed ? 'hidden' : 'grid'
        }`}
      >
        {filteredTargets.map((gt) => (
          <div
            key={gt.id}
            onClick={() => onEditGroupTarget(gt)}
            className="cursor-pointer flex items-center justify-between p-3.5 surface-glass border border-glass rounded-2xl shadow-sm hover:border-balance/30 hover-lift-subtle active:scale-[0.99] transition-all select-none animate-page-enter w-full"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-left">
                <span className="text-secondary uppercase text-[7px] font-extrabold tracking-wider leading-none">
                  {gt.group_type === 'class' ? 'Classe' : 'Setor'}
                </span>
                <span className="text-primary font-black text-xs sm:text-sm mt-0.5 leading-tight">
                  {gt.group_name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-[1px] bg-primary/25" />
              <span className="font-mono text-balance font-black text-sm">{gt.target_percentage}%</span>
              <IconButton
                type="button"
                variant="danger"
                size="sm"
                icon={<Trash2 size={13} />}
                label="Remover limite"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteGroupTarget(gt.id)
                }}
                className="!rounded-xl"
              />
            </div>
          </div>
        ))}

        {currentSum < 100 && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              onNewLimit()
            }}
            className="cursor-pointer flex items-center justify-center gap-2 p-3.5 bg-secondary/30 border border-dashed border-balance/35 hover:border-balance/60 rounded-2xl transition-all select-none animate-page-enter w-full h-[62px] text-balance hover:bg-balance/5 hover:scale-[1.01]"
          >
            <Plus size={15} className="text-balance" />
            <span className="text-xs font-black uppercase tracking-wider">Novo Limite</span>
          </div>
        )}
      </div>
    </Card>
  )
}
