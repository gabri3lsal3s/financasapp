import Button from '@/components/Button'
import type { Payload } from 'recharts/types/component/DefaultLegendContent'

interface DailyFlowLegendProps {
  payload?: Payload[]
  hiddenSeries: string[]
  onToggle: (dataKey: string) => void
}

export default function DailyFlowLegend({ payload, hiddenSeries, onToggle }: DailyFlowLegendProps) {
  if (!payload?.length) return null

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {payload.map((entry) => {
        const dataKey = String(entry.dataKey ?? entry.value ?? '')
        const isHidden = hiddenSeries.includes(dataKey)

        return (
          <Button
            key={dataKey}
            type="button"
            variant={isHidden ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => onToggle(dataKey)}
            className={`px-2 py-1 text-xs flex items-center gap-2 ${isHidden ? 'opacity-50' : ''}`}
            aria-pressed={!isHidden}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.value}</span>
          </Button>
        )
      })}
    </div>
  )
}
