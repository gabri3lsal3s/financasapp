import MonthSelector from '@/components/MonthSelector'
import YearSelector from '@/components/YearSelector'
import ReportCustomDateFilter from '@/components/reports/ReportCustomDateFilter'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, CalendarDays, Scale } from 'lucide-react'
import type { ViewMode } from '@/types/reports'
import type { UseReportsDataReturn } from '@/hooks/useReportsData'

interface ReportsPageHeaderProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  selectedMonth: string
  onMonthChange: (month: string) => void
  selectedYear: number
  onYearChange: (year: number) => void
  availableMonths: string[]
  availableYears: number[]
  customData: UseReportsDataReturn['customData']
  includeReportWeights: boolean
  isOnline: boolean
}

/**
 * ReportsPageHeader — cabeçalho da página Relatórios (extraído de
 * Reports.tsx). Seletor de período (mês/ano/período custom), tabs de modo de
 * visualização e badge de pesos ativos.
 */
export default function ReportsPageHeader({
  viewMode,
  onViewModeChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  availableMonths,
  availableYears,
  customData,
  includeReportWeights,
  isOnline,
}: ReportsPageHeaderProps) {
  return (
    <>
      {/* Seletor de período — mesmo padrão das páginas de despesas e rendimentos */}
      {viewMode === 'month' ? (
        <MonthSelector
          value={selectedMonth}
          onChange={(month) => {
            onMonthChange(month)
            onViewModeChange('month')
          }}
          isOnline={isOnline}
        />
      ) : viewMode === 'year' ? (
        <YearSelector
          value={selectedYear}
          onChange={(year) => {
            onYearChange(year)
            const monthsForYear = availableMonths.filter((month) => month.startsWith(`${year}-`))
            if (monthsForYear.length > 0) {
              onMonthChange(monthsForYear[0])
            }
          }}
          availableYears={availableYears}
        />
      ) : (
        <ReportCustomDateFilter
          startDate={customData.startDate}
          endDate={customData.endDate}
          loading={customData.loading}
          onStartDateChange={customData.setStartDate}
          onEndDateChange={customData.setEndDate}
          onRecalculate={customData.recalculate}
        />
      )}

      {/* View mode selector for all screen sizes (replaces binary header toggle) */}
      <div className="w-full flex justify-center">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)} className="w-full max-w-md mx-auto">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="month" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 px-1 sm:px-2">
              <CalendarDays size={14} className={viewMode === 'month' ? 'text-balance' : 'text-secondary'} />
              <span>Mensal</span>
            </TabsTrigger>
            <TabsTrigger value="year" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 px-1 sm:px-2">
              <Calendar size={14} className={viewMode === 'year' ? 'text-balance' : 'text-secondary'} />
              <span>Anual</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 px-1 sm:px-2">
              <CalendarDays size={14} className={viewMode === 'custom' ? 'text-balance' : 'text-secondary'} />
              <span>Período</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {includeReportWeights && (
        <div className="flex justify-center -mt-2 animate-fade-in">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-income/30 bg-income/5 text-income text-[10px] font-bold uppercase tracking-wider shadow-sm select-none">
            <Scale size={12} className="animate-pulse" />
            <span>Ajuste de impacto (pesos) ativo nos relatórios</span>
          </div>
        </div>
      )}
    </>
  )
}
