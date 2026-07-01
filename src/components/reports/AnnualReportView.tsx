import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Percent } from 'lucide-react'
import Card from '@/components/Card'
import KpiCard from '@/components/KpiCard'
import FinancialInsights from '@/components/reports/FinancialInsights'
import AnnualFlowChart from '@/components/reports/AnnualFlowChart'
import CumulativeBalanceChart from '@/components/reports/CumulativeBalanceChart'
import CategoryTrendChart from '@/components/reports/CategoryTrendChart'
import ReportUnifiedCompositionCard from '@/components/reports/ReportUnifiedCompositionCard'
import ReportPendingDebtsWidget from '@/components/reports/ReportPendingDebtsWidget'
import ReportsTabButton from '@/components/reports/ReportsTabButton'
import { formatCurrency } from '@/utils/format'
import type { TrendSeriesMeta, DetailType } from '@/types/reports'

interface PendingInfo {
  payables: number
  receivables: number
  balanceProj: number
  count: number
  periodLabel: string
}

export interface AnnualReportViewProps {
  selectedYear: number
  compareWithPrevious: boolean
  monthlySummaries: Array<{ month: string; total_income: number; total_expenses: number; total_investments: number; balance: number }>
  prevMonthlySummaries: Array<{ month: string; total_income: number; total_expenses: number; total_investments: number; balance: number }>
  annualTotals: { income: number; expenses: number; investments: number; balance: number }
  previousYearTotals: { income: number; expenses: number; investments: number; balance: number }
  categoryExpenses: Array<{ category_id: string; category_name: string; total: number; color: string }>
  annualChartType: 'flow' | 'balance' | 'trend'
  onAnnualChartTypeChange: (v: 'flow' | 'balance' | 'trend') => void
  evolutionType: 'expense' | 'income'
  onEvolutionTypeChange: (v: 'expense' | 'income') => void
  annualExpenseTrendSeries: TrendSeriesMeta[]
  annualIncomeTrendSeries: TrendSeriesMeta[]
  annualExpenseTrendVisibleData: Array<Record<string, string | number>>
  annualIncomeTrendVisibleData: Array<Record<string, string | number>>
  hiddenExpenseSeries: string[]
  hiddenIncomeSeries: string[]
  hiddenAnnualFlowSeries: string[]
  onToggleExpenseSeries: (key: string) => void
  onToggleIncomeSeries: (key: string) => void
  onToggleAnnualFlowSeries: (key: string) => void
  monthlyData: Array<Record<string, string | number>>
  cumulativeBalanceData: Array<Record<string, string | number>>
  annualPieExpenses: Array<{ categoryId: string; name: string; value: number; baseValue: number; color: string; detailType: 'expense'; detailPeriod: 'year' | 'month'; iconName?: string }>
  annualPieIncomes: Array<{ categoryId: string; name: string; value: number; baseValue: number; color: string; detailType: 'income'; detailPeriod: 'year' | 'month'; iconName?: string }>
  annualPiePaymentMethods: Array<{ name: string; value: number; color: string }>
  annualCompositionPieType: 'expense' | 'income' | 'payment'
  onAnnualCompositionPieTypeChange: (v: 'expense' | 'income' | 'payment') => void
  onOpenDetail: (type: DetailType, categoryId: string, categoryName: string, period: 'month' | 'year') => void
  monthExpenseLimitMap: Map<string, number | null>
  monthIncomeExpectationMap: Map<string, number | null>
  pendingInfo: PendingInfo | null
}

export default function AnnualReportView(props: AnnualReportViewProps) {
  const {
    selectedYear,
    compareWithPrevious,
    monthlySummaries,
    prevMonthlySummaries,
    annualTotals,
    previousYearTotals,
    categoryExpenses,
    annualChartType,
    onAnnualChartTypeChange,
    evolutionType,
    onEvolutionTypeChange,
    annualExpenseTrendSeries,
    annualIncomeTrendSeries,
    annualExpenseTrendVisibleData,
    annualIncomeTrendVisibleData,
    hiddenExpenseSeries,
    hiddenIncomeSeries,
    hiddenAnnualFlowSeries,
    onToggleExpenseSeries,
    onToggleIncomeSeries,
    onToggleAnnualFlowSeries,
    monthlyData,
    cumulativeBalanceData,
    annualPieExpenses,
    annualPieIncomes,
    annualPiePaymentMethods,
    annualCompositionPieType,
    onAnnualCompositionPieTypeChange,
    onOpenDetail,
    monthExpenseLimitMap,
    monthIncomeExpectationMap,
    pendingInfo,
  } = props

  const annualSavingsRate = useMemo(
    () => (annualTotals.income > 0 ? (annualTotals.balance / annualTotals.income) * 100 : 0),
    [annualTotals],
  )

  const trendSeries = evolutionType === 'expense' ? annualExpenseTrendSeries : annualIncomeTrendSeries
  const trendVisibleData = evolutionType === 'expense' ? annualExpenseTrendVisibleData : annualIncomeTrendVisibleData
  const trendHiddenSeries = evolutionType === 'expense' ? hiddenExpenseSeries : hiddenIncomeSeries
  const trendToggle = evolutionType === 'expense' ? onToggleExpenseSeries : onToggleIncomeSeries

  return (
    <div className="flex flex-col gap-6 animate-stagger">
      {/* KPIs Anuais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch">
        <KpiCard
          title="Rendas no ano"
          value={formatCurrency(annualTotals.income)}
          subtext={`Total acumulado em ${selectedYear}`}
          icon={<TrendingUp size={16} />}
          glowColor="var(--color-income)"
          showGlow={true}
          sparklineData={monthlySummaries.map((s) => s.total_income)}
          compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.total_income) : undefined}
          trendPercent={previousYearTotals.income > 0
            ? ((annualTotals.income - previousYearTotals.income) / previousYearTotals.income) * 100
            : null}
          index={1}
        />
        <KpiCard
          title="Despesas no ano"
          value={formatCurrency(annualTotals.expenses)}
          subtext={`Total acumulado em ${selectedYear}`}
          icon={<TrendingDown size={16} />}
          glowColor="var(--color-expense)"
          showGlow={true}
          isDespesa={true}
          sparklineData={monthlySummaries.map((s) => s.total_expenses)}
          compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.total_expenses) : undefined}
          trendPercent={previousYearTotals.expenses > 0
            ? ((annualTotals.expenses - previousYearTotals.expenses) / previousYearTotals.expenses) * 100
            : null}
          index={2}
        />
        <KpiCard
          title="Investimentos no ano"
          value={formatCurrency(annualTotals.investments)}
          subtext={`Total acumulado em ${selectedYear}`}
          icon={<Wallet size={16} />}
          glowColor="var(--color-balance)"
          showGlow={false}
          sparklineData={monthlySummaries.map((s) => s.total_investments)}
          compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.total_investments) : undefined}
          trendPercent={previousYearTotals.investments > 0
            ? ((annualTotals.investments - previousYearTotals.investments) / previousYearTotals.investments) * 100
            : null}
          index={3}
        />
        <KpiCard
          title="Saldo anual"
          value={formatCurrency(annualTotals.balance)}
          subtext="Balanço final consolidado"
          icon={<Percent size={16} />}
          glowColor={annualTotals.balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
          showGlow={annualTotals.balance < 0}
          sparklineData={monthlySummaries.map((s) => s.balance)}
          compareSparklineData={compareWithPrevious ? prevMonthlySummaries.map((s) => s.balance) : undefined}
          trendPercent={previousYearTotals.balance !== 0
            ? ((annualTotals.balance - previousYearTotals.balance) / Math.abs(previousYearTotals.balance)) * 100
            : null}
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

      {/* Insights Anuais */}
      <div className="order-last lg:order-none">
        <FinancialInsights
          viewMode="year"
          periodLabel={String(selectedYear)}
          incomeTotal={annualTotals.income}
          expenseTotal={annualTotals.expenses}
          savingsRate={annualSavingsRate}
          categoryExpenses={categoryExpenses}
          previousExpenseTotal={previousYearTotals.expenses}
        />
      </div>

      <div className="space-y-6">
        {/* Gráficos de Fluxo/Evolução */}
        <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 border-b border-glass/40 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                {annualChartType === 'flow' ? 'Fluxo Mensal' :
                 annualChartType === 'balance' ? 'Saldo Acumulado' :
                 `Evolução por Categoria`}
              </h3>
              <p className="text-[10px] text-secondary mt-0.5">
                {annualChartType === 'flow' ? `Entradas, saídas e investimentos mensais em ${selectedYear}` :
                 annualChartType === 'balance' ? `Evolução do patrimônio líquido acumulado em ${selectedYear}` :
                 `Histórico mensal detalhado de ${evolutionType === 'expense' ? 'despesas' : 'rendas'} em ${selectedYear}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
              {annualChartType === 'trend' && (
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

              <div className="flex items-center gap-1 bg-secondary/10 p-0.5 rounded-lg border border-glass">
                <ReportsTabButton
                  active={annualChartType === 'flow'}
                  onClick={() => onAnnualChartTypeChange('flow')}
                >
                  Fluxo
                </ReportsTabButton>
                <ReportsTabButton
                  active={annualChartType === 'balance'}
                  onClick={() => onAnnualChartTypeChange('balance')}
                >
                  Saldo
                </ReportsTabButton>
                <ReportsTabButton
                  active={annualChartType === 'trend'}
                  onClick={() => onAnnualChartTypeChange('trend')}
                >
                  Evolução
                </ReportsTabButton>
              </div>
            </div>
          </div>

          <div className="w-full mt-2">
            {annualChartType === 'flow' && (
              <AnnualFlowChart
                data={monthlyData}
                hiddenSeries={hiddenAnnualFlowSeries}
                onToggleSeries={onToggleAnnualFlowSeries}
              />
            )}
            {annualChartType === 'balance' && (
              <CumulativeBalanceChart data={cumulativeBalanceData} />
            )}
            {annualChartType === 'trend' && (
              <>
                {trendSeries.length === 0 || trendVisibleData.length === 0 ? (
                  <p className="text-sm text-secondary py-12 text-center italic">
                    Sem {evolutionType === 'expense' ? 'despesas' : 'rendas'} no ano selecionado.
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
          activeType={annualCompositionPieType}
          onActiveTypeChange={onAnnualCompositionPieTypeChange}
          periodLabel={String(selectedYear)}
          expensesData={annualPieExpenses}
          incomesData={annualPieIncomes}
          paymentsData={annualPiePaymentMethods}
          isYear={true}
          onOpenDetail={onOpenDetail}
          expenseLimitMap={monthExpenseLimitMap}
          incomeExpectationMap={monthIncomeExpectationMap}
        />
      </div>
    </div>
  )
}
