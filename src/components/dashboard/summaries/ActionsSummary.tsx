import { useDashboardInsightsContext } from '@/contexts/DashboardDataContext'
import { Sparkles } from 'lucide-react'

export default function ActionsSummary() {
  const { optimizationSummary } = useDashboardInsightsContext()
  const count = optimizationSummary?.suggestions?.length ?? 0

  return (
    <div className="flex items-center gap-2 text-right">
      <Sparkles size={14} className="text-primary" />
      {count > 0 && (
        <span className="text-xs font-bold text-primary">
          {count} {count === 1 ? 'sugestão' : 'sugestões'}
        </span>
      )}
    </div>
  )
}
