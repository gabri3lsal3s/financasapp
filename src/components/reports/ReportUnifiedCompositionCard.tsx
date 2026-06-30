import { Coins, CreditCard, QrCode, ArrowLeftRight, Landmark } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import ReportsCategoryRowButton from '@/components/reports/ReportsCategoryRowButton'
import ReportsTabButton from '@/components/reports/ReportsTabButton'
import CategoryPieChart from '@/components/reports/CategoryPieChart'
import { getStaggerClass } from '@/constants/animation'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import type { PieDatum, DetailType } from '@/types/reports'

interface ReportUnifiedCompositionCardProps {
  activeType: 'expense' | 'income' | 'payment'
  onActiveTypeChange: (val: 'expense' | 'income' | 'payment') => void
  periodLabel: string
  expensesData: PieDatum[]
  incomesData: PieDatum[]
  paymentsData: PieDatum[]
  isYear?: boolean
  onOpenDetail: (
    type: DetailType,
    categoryId: string,
    categoryName: string,
    period: 'month' | 'year',
  ) => void
  expenseLimitMap: Map<string, number | null>
  incomeExpectationMap: Map<string, number | null>
}

function getPaymentMethodIcon(categoryId: string) {
  const norm = categoryId.toLowerCase()
  if (norm.includes('cash') || norm.includes('dinheiro')) return <Coins size={12} />
  if (norm.includes('credit') || norm.includes('cartao') || norm.includes('card')) return <CreditCard size={12} />
  if (norm.includes('pix')) return <QrCode size={12} />
  if (norm.includes('debit') || norm.includes('debito')) return <CreditCard size={12} />
  if (norm.includes('transfer') || norm.includes('transferencia')) return <ArrowLeftRight size={12} />
  return <Landmark size={12} />
}

export default function ReportUnifiedCompositionCard({
  activeType,
  onActiveTypeChange,
  periodLabel,
  expensesData,
  incomesData,
  paymentsData,
  isYear = false,
  onOpenDetail,
  expenseLimitMap,
  incomeExpectationMap,
}: ReportUnifiedCompositionCardProps) {
  const activeData = {
    expense: expensesData,
    income: incomesData,
    payment: paymentsData,
  }[activeType]

  const total = activeData.reduce((sum, current) => sum + current.value, 0)

  return (
    <Card className="border border-glass surface-glass shadow-sm transition-all duration-300 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-glass/40 pb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
            Composição detalhada
          </h3>
          <p className="text-[10px] text-secondary mt-0.5">
            Visualização de progresso e limites em {periodLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-secondary/10 p-0.5 rounded-lg border border-glass">
            <ReportsTabButton
              active={activeType === 'expense'}
              onClick={() => onActiveTypeChange('expense')}
            >
              Despesas
            </ReportsTabButton>
            <ReportsTabButton
              active={activeType === 'income'}
              onClick={() => onActiveTypeChange('income')}
            >
              Rendas
            </ReportsTabButton>
            <ReportsTabButton
              active={activeType === 'payment'}
              onClick={() => onActiveTypeChange('payment')}
            >
              Meios
            </ReportsTabButton>
          </div>
        </div>
      </div>

      {activeData.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-secondary italic">Sem dados detalhados para exibir nesta visão.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lado Esquerdo: Gráfico de Pizza (1/3 da largura no desktop) */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-glass/40 pb-6 lg:pb-0 lg:pr-6 min-h-[260px]">
            <CategoryPieChart
              data={activeData}
              onClick={(entry: PieDatum) => {
                if (entry.categoryId && entry.detailType) {
                  onOpenDetail(entry.detailType, entry.categoryId, entry.name, entry.detailPeriod || 'month')
                }
              }}
              outerRadius={80}
              innerRadius={58}
            />
          </div>

          {/* Lado Direito: Listagem Detalhada (2/3 da largura no desktop) */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {activeData
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((item, index) => {
                  const staggerClass = getStaggerClass(index)

                  if (activeType === 'payment') {
                    const pct = total > 0 ? (item.value / total) * 100 : 0
                    const pmIcon = getPaymentMethodIcon(item.categoryId || '')
                    return (
                      <Button
                        key={item.name}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (item.categoryId && item.detailType) {
                            onOpenDetail(item.detailType, item.categoryId, item.name, item.detailPeriod || 'month')
                          }
                        }}
                        className={`w-full h-auto text-left flex-col items-stretch p-2.5 animate-stagger-item transition-all hover:scale-[1.005] hover:border-glass-strong surface-glass ${staggerClass}`}
                      >
                        <div className="flex items-center justify-between gap-3 w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${item.color}15`, color: item.color }}
                            >
                              {pmIcon}
                            </span>
                            <span className="text-xs font-semibold text-primary truncate">{item.name}</span>
                          </div>
                          <span className="text-xs font-bold text-primary font-mono shrink-0">
                            {formatCurrency(item.value)}
                          </span>
                        </div>

                        <div className="text-[9px] text-secondary font-medium mt-1 truncate">
                          {formatNumberWithTwoDecimalsBR(pct)}% do total
                        </div>

                        <div className="w-full h-1 rounded-full bg-secondary/20 mt-1.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                        </div>
                      </Button>
                    )
                  }

                  const id = item.categoryId || ''
                  const isExpenseMode = activeType === 'expense'
                  const target = isYear ? null : (
                    isExpenseMode
                      ? expenseLimitMap.get(id)
                      : incomeExpectationMap.get(id)
                  )

                  return (
                    <ReportsCategoryRowButton
                      key={id}
                      categoryId={id}
                      categoryName={item.name}
                      total={item.value}
                      totalBase={item.baseValue}
                      totalGrand={total}
                      color={item.color}
                      targetAmount={target}
                      isExpense={isExpenseMode}
                      staggerClass={staggerClass}
                      iconName={item.iconName}
                      onOpen={(catId, catName) =>
                        onOpenDetail(isExpenseMode ? 'expense' : 'income', catId, catName, isYear ? 'year' : 'month')
                      }
                    />
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
