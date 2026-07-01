import { CalendarDays, Loader2 } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'

interface ReportCustomDateFilterProps {
  startDate: string
  endDate: string
  loading: boolean
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onRecalculate: () => void
}

export default function ReportCustomDateFilter(props: ReportCustomDateFilterProps) {
  const { startDate, endDate, loading, onStartDateChange, onEndDateChange, onRecalculate } = props

  return (
    <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 font-sans">
            Data de Início
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full bg-secondary/5 border-glass text-primary"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-1.5 font-sans">
            Data de Fim
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full bg-secondary/5 border-glass text-primary"
          />
        </div>
        <Button
          type="button"
          onClick={onRecalculate}
          disabled={loading}
          className="shrink-0 font-bold px-6 py-2.5 h-10 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <CalendarDays size={16} />
              Recalcular
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
