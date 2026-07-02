import { useNavigate } from 'react-router-dom'
import { Receipt, TrendingDown, Target } from 'lucide-react'
import Card from '@/components/Card'
import { cn } from '@/lib/utils'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'

interface QuickWin {
  id: string
  icon: React.ReactNode
  title: string
  subtitle: string
  path: string
  colorClass: string
  iconBgClass: string
}

const quickWins: QuickWin[] = [
  {
    id: 'subscriptions',
    icon: <Receipt size={18} />,
    title: 'Revisar Assinaturas',
    subtitle: 'Identifique gastos recorrentes e cancele o que não usa',
    path: '/expenses',
    colorClass: 'hover:border-balance/30',
    iconBgClass: 'bg-balance/10 text-balance',
  },
  {
    id: 'savings-challenge',
    icon: <TrendingDown size={18} />,
    title: 'Desafios de Economia',
    subtitle: 'Estabeleça metas de redução de gastos para este mês',
    path: '/categories',
    colorClass: 'hover:border-income/30',
    iconBgClass: 'bg-income/10 text-income',
  },
  {
    id: 'category-limits',
    icon: <Target size={18} />,
    title: 'Limites por Categoria',
    subtitle: 'Ajuste os limites de orçamento para cada área de gasto',
    path: '/categories',
    colorClass: 'hover:border-primary/30',
    iconBgClass: 'bg-primary/10 text-primary',
  },
]

export default function QuickWinsGrid() {
  const navigate = useNavigate()

  return (
    <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, "space-y-3")}>
      <div className="flex items-center gap-2 border-b border-glass/40 pb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
          Ações de Otimização
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {quickWins.map((win) => (
          <button
            key={win.id}
            type="button"
            onClick={() => navigate(win.path)}
            className={cn(
              'flex items-start gap-3 p-3.5 rounded-xl border border-glass surface-glass-strong',
              'transition-all duration-200 text-left cursor-pointer',
              'hover:shadow-sm hover:bg-secondary/5',
              win.colorClass,
            )}
          >
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              win.iconBgClass,
            )}>
              {win.icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-primary leading-snug">
                {win.title}
              </h4>
              <p className="text-[10px] text-secondary mt-0.5 leading-relaxed line-clamp-2">
                {win.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
