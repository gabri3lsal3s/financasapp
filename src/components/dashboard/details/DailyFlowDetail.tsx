import { useState } from 'react'
import { useDashboardFinances } from '@/contexts/DashboardDataContext'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'

export default function DailyFlowDetail() {
  const { dailyFlowData, currentMonth } = useDashboardFinances()
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([])

  const toggleSeries = (dataKey: string) => {
    setHiddenSeries((prev) =>
      prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey],
    )
  }

  if (!dailyFlowData || dailyFlowData.length === 0) {
    return <p className="text-[10px] text-secondary text-center py-4">Sem dados de fluxo diário para {currentMonth}.</p>
  }

  return (
    <DailyFlowChart
      data={dailyFlowData}
      hiddenSeries={hiddenSeries}
      onToggleSeries={toggleSeries}
    />
  )
}
