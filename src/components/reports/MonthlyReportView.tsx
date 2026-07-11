import { TrendingUp, TrendingDown, Wallet, Percent } from 'lucide-react'
import Card from '@/components/Card'
import KpiCard from '@/components/KpiCard'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'
import WeekdayExpenseChart from '@/components/reports/WeekdayExpenseChart'
import MonthCompositionChart from '@/components/reports/MonthCompositionChart'
import CumulativeBalanceChart from '@/components/reports/CumulativeBalanceChart'
import CategoryTrendChart from '@/components/reports/CategoryTrendChart'
import ReportUnifiedCompositionCard from '@/components/reports/ReportUnifiedCompositionCard'
import ReportPendingDebtsWidget from '@/components/reports/ReportPendingDebtsWidget'
import ReportsTabButton from '@/components/reports/ReportsTabButton'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import type { TrendSeriesMeta, DetailType, ExpenseCategorySummary } from '@/types/reports'

interface PendingInfo {
  payables: number
  receivables: number
  balanceProj: number
  count: number
  periodLabel: string
}

export interface MonthlyReportViewProps {
  viewMode: 'month' | 'custom' | 'year'
  activeSummary: { total_income: number; total_expenses: number; total_investments: number; balance: number }
  activePeriodLabel: string
  activeSavingsRate: number
  activeDailyConsolidatedData: Array<Record<string, number | string>>
  activeExpenseCategories: ExpenseCategorySummary[]
  previousMonthExpenseTotal: number
  activeWeekdayExpenseData: Array<{ dia: string; Despesas: number; Rendas: number; Investimentos: number }>
  activeLimitsExceededCount: number
  activeQuickData: Array<Record<string, string | number>>
  activePieExpenses: Array<{ categoryId: string; name: string; value: number; baseValue: number; color: string; detailType: 'expense'; detailPeriod: 'year' | 'month'; iconName?: string }>
  activePieIncomes: Array<{ categoryId: string; name: string; value: number; baseValue: number; color: string; detailType: 'income'; detailPeriod: 'year' | 'month'; iconName?: string }>
  activePiePaymentMethods: Array<{ name: string; value: number; color: string }>
  compareWithPrevious: boolean
  previousMonthIncomeTotal: number
  previousMonthInvestmentTotal: number
  previousMonthSavingsRate: number
  monthChartTab: 'daily' | 'weekly' | 'composition' | 'balance' | 'trend'
  onMonthChartTabChange: (v: 'daily' | 'weekly' | 'composition' | 'balance' | 'trend') => void
  topWeekdayExpense: { dia: string; Despesas: number } | null
  evolutionType: 'expense' | 'income'
  onEvolutionTypeChange: (v: 'expense' | 'income') => void
  customExpenseTrendSeries: TrendSeriesMeta[]
  customIncomeTrendSeries: TrendSeriesMeta[]
  customExpenseTrendVisibleData: Array<Record<string, string | number>>
  customIncomeTrendVisibleData: Array<Record<string, string | number>>
  customCumulativeBalanceData: Array<Record<string, string | number>>
  hiddenExpenseSeries: string[]
  hiddenIncomeSeries: string[]
  hiddenDailyConsolidatedSeries: string[]
  hiddenMonthCompositionSeries: string[]
  onToggleExpenseSeries: (key: string) => void
  onToggleIncomeSeries: (key: string) => void
  onToggleDailyConsolidatedSeries: (key: string) => void
  onToggleMonthCompositionSeries: (key: string) => void
  compositionPieType: 'expense' | 'income' | 'payment'
  onCompositionPieTypeChange: (v: 'expense' | 'income' | 'payment') => void
  onOpenDetail: (type: DetailType, categoryId: string, categoryName: string, period: 'month' | 'year') => void
  monthExpenseLimitMap: Map<string, number | null>
  monthIncomeExpectationMap: Map<string, number | null>
  pendingInfo: PendingInfo | null
}

export default function MonthlyReportView(props: MonthlyReportViewProps) {
  const {
    viewMode,
    activeSummary,
    activePeriodLabel,
    activeSavingsRate,
    activeDailyConsolidatedData,
    activeExpenseCategories,
    previousMonthExpenseTotal,
    activeWeekdayExpenseData,
    activeLimitsExceededCount,
    activeQuickData,
    activePieExpenses,
    activePieIncomes,
    activePiePaymentMethods,
    compareWithPrevious,
    previousMonthIncomeTotal,
    previousMonthExpenseTotal: _prevExpTotal,
    previousMonthInvestmentTotal,
    previousMonthSavingsRate,
    monthChartTab,
    onMonthChartTabChange,
    topWeekdayExpense,
    evolutionType,
    onEvolutionTypeChange,
    customExpenseTrendSeries,
    customIncomeTrendSeries,
    customExpenseTrendVisibleData,
    customIncomeTrendVisibleData,
    customCumulativeBalanceData,
    hiddenExpenseSeries,
    hiddenIncomeSeries,
    hiddenDailyConsolidatedSeries,
    hiddenMonthCompositionSeries,
    onToggleExpenseSeries,
    onToggleIncomeSeries,
    onToggleDailyConsolidatedSeries,
    onToggleMonthCompositionSeries,
    compositionPieType,
    onCompositionPieTypeChange,
    onOpenDetail,
    monthExpenseLimitMap,
    monthIncomeExpectationMap,
    pendingInfo,
  } = props

  // Trend series, data, and toggles based on evolution type
  const trendSeries = evolutionType === 'expense' ? customExpenseTrendSeries : customIncomeTrendSeries
  const trendVisibleData = evolutionType === 'expense' ? customExpenseTrendVisibleData : customIncomeTrendVisibleData
  const trendHiddenSeries = evolutionType === 'expense' ? hiddenExpenseSeries : hiddenIncomeSeries
  const trendToggle = evolutionType === 'expense' ? onToggleExpenseSeries : onToggleIncomeSeries

  return (
    <div className="flex flex-col gap-6 animate-stagger">
      {/* KPIs Mensais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch">
        <KpiCard
          title={viewMode === 'custom' ? "Rendas no período" : "Rendas do mês"}
          value={formatCurrency(activeSummary.total_income)}
          subtext="Receitas consolidadas"
          icon={<TrendingUp size={16} />}
          glowColor="var(--color-income)"
          showGlow={true}
          sparklineData={activeDailyConsolidatedData.map((d) => Number(d.Rendas) || 0)}
          compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => Number(d['Rendas (Mês Ant.)']) || 0) : undefined}
          trendPercent={viewMode === 'custom' ? null : (previousMonthIncomeTotal > 0
            ? ((activeSummary.total_income - previousMonthIncomeTotal) / previousMonthIncomeTotal) * 100
            : null)}
          index={1}
        />
        <KpiCard
          title={viewMode === 'custom' ? "Despesas no período" : "Despesas do mês"}
          value={formatCurrency(activeSummary.total_expenses)}
          subtext="Despesas consolidadas"
          icon={<TrendingDown size={16} />}
          glowColor="var(--color-expense)"
          showGlow={true}
          isDespesa={true}
          sparklineData={activeDailyConsolidatedData.map((d) => Number(d.Despesas) || 0)}
          compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => Number(d['Despesas (Mês Ant.)']) || 0) : undefined}
          trendPercent={viewMode === 'custom' ? null : (_prevExpTotal > 0
            ? ((activeSummary.total_expenses - _prevExpTotal) / _prevExpTotal) * 100
            : null)}
          index={2}
        />
        <KpiCard
          title={viewMode === 'custom' ? "Investimentos no período" : "Investimentos do mês"}
          value={formatCurrency(activeSummary.total_investments)}
          subtext="Investimentos em ativos"
          icon={<Wallet size={16} />}
          glowColor="var(--color-balance)"
          showGlow={false}
          sparklineData={activeDailyConsolidatedData.map((d) => Number(d.Investimentos) || 0)}
          compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => Number(d['Investimentos (Mês Ant.)']) || 0) : undefined}
          trendPercent={viewMode === 'custom' ? null : (previousMonthInvestmentTotal > 0
            ? ((activeSummary.total_investments - previousMonthInvestmentTotal) / previousMonthInvestmentTotal) * 100
            : null)}
          index={3}
        />
        <KpiCard
          title="Taxa de saldo"
          value={`${formatNumberWithTwoDecimalsBR(activeSavingsRate)}%`}
          subtext={`Saldo líquido: ${formatCurrency(activeSummary.balance)}`}
          icon={<Percent size={16} />}
          glowColor={activeSavingsRate >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
          showGlow={activeSavingsRate < 0}
          sparklineData={activeDailyConsolidatedData.map((d) => Number(d.Rendas || 0) - Number(d.Despesas || 0) - Number(d.Investimentos || 0))}
          compareSparklineData={compareWithPrevious ? activeDailyConsolidatedData.map((d) => (Number(d['Rendas (Mês Ant.)']) || 0) - (Number(d['Despesas (Mês Ant.)']) || 0) - (Number(d['Investimentos (Mês Ant.)']) || 0)) : undefined}
          trendPercent={viewMode === 'custom' ? null : (previousMonthIncomeTotal > 0
            ? activeSavingsRate - previousMonthSavingsRate
            : null)}
          trendSuffix=" pp"
          index={4}
        />
      </div>

      {/* Pendências de Dívidas */}
      {pendingInfo && pendingInfo.count > 0 && (
        <ReportPendingDebtsWidget
          payables={pendingInfo.payables}
          receivables={pendingInfo.receivables}
          balanceProj={pendingInfo.balanceProj}
          count={pendingInfo.count}
          periodLabel={pendingInfo.periodLabel}
        />
      )}

      <div className="space-y-6">
        {/* Estação de Gráficos */}
        <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 border-b border-glass/40 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                {monthChartTab === 'daily' ? 'Fluxo Diário Consolidado' :
                  monthChartTab === 'weekly' ? 'Fluxo por Dia da Semana' :
                    monthChartTab === 'composition' ? 'Composição de Saldo' :
                      monthChartTab === 'balance' ? 'Saldo Acumulado' :
                        'Evolução por Categoria'}
              </h3>
              <p className="text-[10px] text-secondary mt-0.5">
                {monthChartTab === 'daily'
                  ? `Rendas, despesas e investimentos por dia em ${activePeriodLabel}`
                  : monthChartTab === 'weekly'
                    ? (topWeekdayExpense && topWeekdayExpense.Despesas > 0
                      ? `Maior gasto: ${topWeekdayExpense.dia} (${formatCurrency(topWeekdayExpense.Despesas)})`
                      : `Distribuição semanal — despesas, rendas e investimentos em ${activePeriodLabel}`)
                    : monthChartTab === 'composition'
                      ? `Proporções e saldos consolidados no período`
                      : monthChartTab === 'balance'
                        ? `Evolução do patrimônio líquido acumulado no período`
                        : `Histórico mensal detalhado de ${evolutionType === 'expense' ? 'despesas' : 'rendas'} no período`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
              {/* Sub-seletor condicional para Despesas/Rendas na Evolução */}
              {viewMode === 'custom' && monthChartTab === 'trend' && (
                <div className="flex items-center gap-1 mr-2 border-r border-glass/40 pr-2">
                  <ReportsTabButton
                    active={evolutionType === 'expense'}
                    onClick={() => onEvolutionTypeChange('expense')}
                  >
                    Despesas
                  </ReportsTabButton>
                  <ReportsTabButton
                    active={evolutionType === 'income'}
                    onClick={() => onEvolutionTypeChange('income')}
                  >
                    Rendas
                  </ReportsTabButton>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1 bg-secondary/10 p-0.5 rounded-lg border border-glass">
                <ReportsTabButton
                  active={monthChartTab === 'daily'}
                  onClick={() => onMonthChartTabChange('daily')}
                >
                  Fluxo Diário
                </ReportsTabButton>
                <ReportsTabButton
                  active={monthChartTab === 'weekly'}
                  onClick={() => onMonthChartTabChange('weekly')}
                >
                  Semana
                </ReportsTabButton>
                <ReportsTabButton
                  active={monthChartTab === 'composition'}
                  onClick={() => onMonthChartTabChange('composition')}
                >
                  Composição
                </ReportsTabButton>
                {viewMode === 'custom' && (
                  <>
                    <ReportsTabButton
                      active={monthChartTab === 'balance'}
                      onClick={() => onMonthChartTabChange('balance')}
                    >
                      Saldo
                    </ReportsTabButton>
                    <ReportsTabButton
                      active={monthChartTab === 'trend'}
                      onClick={() => onMonthChartTabChange('trend')}
                    >
                      Evolução
                    </ReportsTabButton>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="w-full mt-2">
            {monthChartTab === 'daily' && (
              <DailyFlowChart
                data={activeDailyConsolidatedData as any}
                hiddenSeries={hiddenDailyConsolidatedSeries}
                onToggleSeries={onToggleDailyConsolidatedSeries}
                xAxisKey="label"
              />
            )}
            {monthChartTab === 'weekly' && (
              <WeekdayExpenseChart data={activeWeekdayExpenseData} />
            )}
            {monthChartTab === 'composition' && (
              <MonthCompositionChart
                data={activeQuickData as any}
                hiddenSeries={hiddenMonthCompositionSeries}
                onToggleSeries={onToggleMonthCompositionSeries}
              />
            )}
            {viewMode === 'custom' && monthChartTab === 'balance' && (
              <CumulativeBalanceChart data={customCumulativeBalanceData as any} />
            )}
            {viewMode === 'custom' && monthChartTab === 'trend' && (
              <>
                {trendSeries.length === 0 || trendVisibleData.length === 0 ? (
                  <p className="text-sm text-secondary py-12 text-center italic">
                    Sem {evolutionType === 'expense' ? 'despesas' : 'rendas'} no período selecionado.
                  </p>
                ) : (
                  <CategoryTrendChart
                    data={trendVisibleData}
                    series={trendSeries}
                    hiddenSeries={trendHiddenSeries}
                    onToggleSeries={trendToggle}
                  />
                )}
              </>
            )}
          </div>
        </Card>

        {/* Painel Unificado de Composição & Detalhamento */}
        <ReportUnifiedCompositionCard
          activeType={compositionPieType}
          onActiveTypeChange={onCompositionPieTypeChange}
          periodLabel={activePeriodLabel}
          expensesData={activePieExpenses}
          incomesData={activePieIncomes}
          paymentsData={activePiePaymentMethods}
          onOpenDetail={onOpenDetail}
          expenseLimitMap={monthExpenseLimitMap}
          incomeExpectationMap={monthIncomeExpectationMap}
        />
      </div>
    </div>
  )
}
