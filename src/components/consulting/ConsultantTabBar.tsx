/**
 * ConsultantTabBar
 * WHY: Extrai a barra de navegação por abas premium do ConsultantDashboard,
 *      tornando-a reutilizável e reduzindo o tamanho do componente pai.
 */
import { LayoutDashboard, PieChart, Briefcase, History } from 'lucide-react'
import Button from '@/components/Button'

export type ConsultantTab = 'overview' | 'allocation' | 'positions' | 'ledger'

const TABS: { id: ConsultantTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Resumo & Relatório', icon: LayoutDashboard },
  { id: 'allocation', label: 'Alocação & Simulação', icon: PieChart },
  { id: 'positions', label: 'Posições & Teses', icon: Briefcase },
  { id: 'ledger', label: 'Livro-Razão', icon: History },
]

interface Props {
  activeTab: ConsultantTab
  onTabChange: (tab: ConsultantTab) => void
}

export default function ConsultantTabBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 surface-glass-strong border border-glass p-3 sm:p-4 rounded-3xl shadow-sm text-left animate-page-enter glass-glow-card">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-secondary tracking-wider block font-sans">
          Seção do Painel:
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full md:flex md:flex-wrap md:w-auto md:gap-1.5 pb-0.5 md:pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl transition-all w-full md:w-auto ${
                isActive ? 'nav-item-active' : 'border-glass hover:bg-muted/10'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
