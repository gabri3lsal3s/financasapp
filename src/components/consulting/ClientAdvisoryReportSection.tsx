import Card from '@/components/Card'
import { FileText, Calendar } from 'lucide-react'

interface ClientAdvisoryReportSectionProps {
  executiveSummary: string
  nextMonthPlan: string
}

export default function ClientAdvisoryReportSection({
  executiveSummary,
  nextMonthPlan,
}: ClientAdvisoryReportSectionProps) {
  if (!executiveSummary.trim() && !nextMonthPlan.trim()) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {executiveSummary.trim() ? (
        <Card className="p-5 text-left">
          <h3 className="font-bold text-base text-primary mb-3 flex items-center gap-2">
            <FileText size={16} className="text-balance" />
            Sumário executivo
          </h3>
          <p className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">
            {executiveSummary}
          </p>
        </Card>
      ) : null}
      {nextMonthPlan.trim() ? (
        <Card className="p-5 text-left">
          <h3 className="font-bold text-base text-primary mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-income" />
            Plano do próximo mês
          </h3>
          <p className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">
            {nextMonthPlan}
          </p>
        </Card>
      ) : null}
    </div>
  )
}
