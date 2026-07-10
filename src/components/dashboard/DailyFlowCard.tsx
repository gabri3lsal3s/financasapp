import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { formatMonth } from '@/utils/format'
import { CARD_BASE, CARD_PADDING } from '@/constants/layout'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'

interface DailyFlowCardProps {
  data: Array<{ day: string; Rendas: number; Despesas: number; Investimentos: number }>
  hiddenSeries: string[]
  onToggleSeries: (key: string) => void
  currentMonth: string
}

export default function DailyFlowCard({
  data,
  hiddenSeries,
  onToggleSeries,
  currentMonth,
}: DailyFlowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className={cn(CARD_BASE, CARD_PADDING, 'transition-all duration-300')}>
      {/* ── Clickable Header ── */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between border-b border-glass/40 pb-3 text-left cursor-pointer group"
        aria-expanded={isExpanded}
        aria-controls="daily-flow-content"
      >
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary group-hover:text-primary/80 transition-colors">
            Fluxo Diário
          </h3>
          <p className="text-[10px] text-secondary mt-0.5">
            Entradas, saídas e investimentos por dia em {formatMonth(currentMonth)}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            'text-secondary/50 transition-transform duration-300 shrink-0',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {/* ── Collapsible Content ── */}
      <div
        id="daily-flow-content"
        className={cn(
          'overflow-hidden transition-all duration-300',
          isExpanded ? 'mt-2 max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="w-full">
          <DailyFlowChart
            data={data}
            hiddenSeries={hiddenSeries}
            onToggleSeries={onToggleSeries}
          />
        </div>
      </div>
    </Card>
  )
}
