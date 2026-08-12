import { usePageActions, type PageActionIntent } from '@/hooks/usePageActions'
import MonthTransitionView from '@/components/MonthTransitionView'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useSwipeYear } from '@/hooks/useSwipeYear'
import EmptyState from '@/components/EmptyState'
import { SkeletonReports } from '@/components/Skeleton'
import { useReportsData } from '@/hooks/useReportsData'
import CategoryDetailModal from '@/components/reports/CategoryDetailModal'
import AnnualReportView from '@/components/reports/AnnualReportView'
import MonthlyReportView from '@/components/reports/MonthlyReportView'
import ReportsPageHeader from '@/components/reports/ReportsPageHeader'
import { GitCompareArrows, Scale } from 'lucide-react'

export default function Reports() {
  const data = useReportsData()
  const {
    selectedYear,
    selectedMonth,
    setSelectedMonth,
    setSelectedYear,
    availableMonths,
    viewMode,
    setViewMode,
    compareWithPrevious,
    setCompareWithPrevious,
    includeReportWeights,
    setIncludeReportWeights,
    loadingState,
    detailModal,
    setDetailModal,
    openDetailModal,
  } = data

  usePageActions([
    ...(viewMode !== 'custom'
      ? [
          {
            icon: GitCompareArrows,
            label: 'Comparação Histórica',
            intent: (compareWithPrevious ? 'income' : 'neutral') as PageActionIntent,
            onClick: () => setCompareWithPrevious(!compareWithPrevious),
            title: compareWithPrevious ? 'Desativar comparação histórica' : 'Ativar comparação histórica',
            compactOnMobile: true,
          },
        ]
      : []),
    {
      icon: Scale,
      label: includeReportWeights ? 'Desconsiderar Pesos' : 'Considerar Pesos',
      intent: (includeReportWeights ? 'balance' : 'neutral') as PageActionIntent,
      onClick: () => setIncludeReportWeights(!includeReportWeights),
      title: includeReportWeights ? 'Desconsiderar pesos nos relatórios' : 'Considerar pesos nos relatórios',
      compactOnMobile: true,
    },
  ])

  // Swipe de mês — ativo quando no modo mês
  const monthSwipe = useSwipeMonth(selectedMonth, setSelectedMonth)

  // Swipe de ano — ativo quando no modo ano
  const yearSwipe = useSwipeYear(
    selectedYear,
    (year) => {
      setSelectedYear(year)
      const monthsForYear = availableMonths.filter((m) => m.startsWith(`${year}-`))
      if (monthsForYear.length > 0) setSelectedMonth(monthsForYear[0])
    }
  )

  // Handler combinado: delega ao hook correto conforme o modo ativo
  const swipeHandlers = viewMode === 'month' ? monthSwipe : (viewMode === 'year' ? yearSwipe : {})

  if (loadingState) {
    return (
      <div className="min-h-[calc(100dvh-12rem)] flex flex-col">
        <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
          <SkeletonReports />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-12rem)] flex flex-col" {...swipeHandlers}>

      <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
        <ReportsPageHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableMonths={availableMonths}
          availableYears={data.availableYears}
          customData={data.customData}
          includeReportWeights={includeReportWeights}
          isOnline={data.isOnline}
        />

        <MonthTransitionView month={viewMode === 'month' ? selectedMonth : (viewMode === 'year' ? String(selectedYear) : data.activePeriodLabel)}>
          {viewMode === 'year' ? (
            <AnnualReportView
              selectedYear={selectedYear}
              compareWithPrevious={compareWithPrevious}
              monthlySummaries={data.monthlySummaries}
              prevMonthlySummaries={data.prevMonthlySummaries}
              annualTotals={data.annualTotals}
              previousYearTotals={data.previousYearTotals}
              annualChartType={data.annualChartType}
              onAnnualChartTypeChange={data.setAnnualChartType}
              evolutionType={data.evolutionType}
              onEvolutionTypeChange={data.setEvolutionType}
              annualExpenseTrendSeries={data.annualExpenseTrendSeries}
              annualIncomeTrendSeries={data.annualIncomeTrendSeries}
              annualExpenseTrendVisibleData={data.annualExpenseTrendVisibleData}
              annualIncomeTrendVisibleData={data.annualIncomeTrendVisibleData}
              hiddenExpenseSeries={data.hiddenExpenseSeries}
              hiddenIncomeSeries={data.hiddenIncomeSeries}
              hiddenAnnualFlowSeries={data.hiddenAnnualFlowSeries}
              onToggleExpenseSeries={data.toggleExpenseSeries}
              onToggleIncomeSeries={data.toggleIncomeSeries}
              onToggleAnnualFlowSeries={data.toggleAnnualFlowSeries}
              monthlyData={data.monthlyData}
              cumulativeBalanceData={data.cumulativeBalanceData}
              annualPieExpenses={data.annualPieExpenses}
              annualPieIncomes={data.annualPieIncomes}
              annualPiePaymentMethods={data.annualPiePaymentMethods}
              annualCompositionPieType={data.annualCompositionPieType}
              onAnnualCompositionPieTypeChange={data.setAnnualCompositionPieType}
              onOpenDetail={openDetailModal}
              monthExpenseLimitMap={data.monthExpenseLimitMap}
              monthIncomeExpectationMap={data.monthIncomeExpectationMap}
              pendingInfo={data.activePendingInfo}
            />
          ) : data.activeSummary ? (
            <MonthlyReportView
              viewMode={viewMode}
              activeSummary={data.activeSummary}
              activePeriodLabel={data.activePeriodLabel}
              activeSavingsRate={data.activeSavingsRate}
              activeDailyConsolidatedData={data.activeDailyConsolidatedData}
              activeExpenseCategories={data.activeExpenseCategories}
              activeWeekdayExpenseData={data.activeWeekdayExpenseData}
              activeLimitsExceededCount={data.activeLimitsExceededCount}
              activeQuickData={data.activeQuickData}
              activePieExpenses={data.activePieExpenses}
              activePieIncomes={data.activePieIncomes}
              activePiePaymentMethods={data.activePiePaymentMethods}
              compareWithPrevious={compareWithPrevious}
              previousMonthIncomeTotal={data.previousMonthIncomeTotal}
              previousMonthExpenseTotal={data.previousMonthExpenseTotal}
              previousMonthInvestmentTotal={data.previousMonthInvestmentTotal}
              previousMonthSavingsRate={data.previousMonthSavingsRate}
              monthChartTab={data.monthChartTab}
              onMonthChartTabChange={data.setMonthChartTab}
              topWeekdayExpense={data.topWeekdayExpense}
              evolutionType={data.evolutionType}
              onEvolutionTypeChange={data.setEvolutionType}
              customExpenseTrendSeries={data.customData.expenseTrendSeries}
              customIncomeTrendSeries={data.customData.incomeTrendSeries}
              customExpenseTrendVisibleData={data.customData.expenseTrendVisibleData}
              customIncomeTrendVisibleData={data.customData.incomeTrendVisibleData}
              customCumulativeBalanceData={data.customData.cumulativeBalanceData}
              hiddenExpenseSeries={data.hiddenExpenseSeries}
              hiddenIncomeSeries={data.hiddenIncomeSeries}
              hiddenDailyConsolidatedSeries={data.hiddenDailyConsolidatedSeries}
              hiddenMonthCompositionSeries={data.hiddenMonthCompositionSeries}
              onToggleExpenseSeries={data.toggleExpenseSeries}
              onToggleIncomeSeries={data.toggleIncomeSeries}
              onToggleDailyConsolidatedSeries={data.toggleDailyConsolidatedSeries}
              onToggleMonthCompositionSeries={data.toggleMonthCompositionSeries}
              compositionPieType={data.compositionPieType}
              onCompositionPieTypeChange={data.setCompositionPieType}
              onOpenDetail={openDetailModal}
              monthExpenseLimitMap={data.monthExpenseLimitMap}
              monthIncomeExpectationMap={data.monthIncomeExpectationMap}
              pendingInfo={data.activePendingInfo}
            />
          ) : (
            <EmptyState
              title="Sem dados consolidados"
              description="Nenhuma receita, despesa ou investimento encontrado para o período selecionado."
              className="border border-glass surface-glass"
            />
          )}
        </MonthTransitionView>
      </div>

      <CategoryDetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal((prev) => ({ ...prev, isOpen: false }))}
        type={detailModal.type}
        categoryId={detailModal.categoryId}
        categoryName={detailModal.categoryName}
        period={viewMode === 'custom' ? 'month' : detailModal.period}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        isOnline={data.isOnline}
        monthExpenses={data.activeExpensesList}
        monthIncomes={data.activeIncomesList}
        annualExpenses={data.annualExpenses}
        previousMonthExpenses={data.previousMonthExpenses}
        previousMonthIncomes={data.previousMonthIncomes}
        yearExpenseItems={data.yearExpenseItems}
        yearIncomeItems={data.yearIncomeItems}
        previousYearExpenseItems={data.previousYearExpenseItems}
        previousYearIncomeItems={data.previousYearIncomeItems}
        monthExpenseLimits={data.monthExpenseLimits}
        previousMonthExpenseLimits={data.previousMonthExpenseLimits}
        monthIncomeExpectations={data.monthIncomeExpectations}
        previousMonthIncomeExpectations={data.previousMonthIncomeExpectations}
        creditCards={data.creditCards}
        expenseCategoryIdToColor={data.expenseCategoryIdToColor}
        incomeCategoryIdToColor={data.incomeCategoryIdToColor}
        includeReportWeights={includeReportWeights}
        yearDetailLoading={data.yearDetailLoading}
        previousMonth={data.previousMonth}
        isCustomPeriod={viewMode === 'custom'}
      />

    </div>
  )
}
