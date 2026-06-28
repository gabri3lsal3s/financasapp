import { useState, useMemo, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Modal from '@/components/Modal'
import TransactionRow from '@/components/TransactionRow'
import Input from '@/components/Input'
import Button from '@/components/Button'
import CategoryDetailMiniChart from '@/components/reports/CategoryDetailMiniChart'
import {
  formatCurrency,
  formatMonth,
  formatNumberWithTwoDecimalsBR,
} from '@/utils/format'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import type { ExpenseCategoryMonthLimit, IncomeCategoryMonthExpectation, CreditCard } from '@/types'
import { getStaggerClass } from '@/constants/animation'

type DetailType = 'expense' | 'income' | 'payment_method' | 'credit_card'

type DetailExpenseEntry = {
  id: string
  amount: number
  report_weight?: number | null
  category_id: string
  date: string
  description?: string | null
  category?: {
    name?: string | null
  } | null
  payment_method?: string | null
  credit_card_id?: string | null
}

type DetailIncomeEntry = {
  id: string
  amount: number
  report_weight?: number | null
  income_category_id: string
  date: string
  description?: string | null
  income_category?: {
    name?: string | null
  } | null
}

interface CategoryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  type: DetailType
  categoryId: string
  categoryName: string
  period: 'month' | 'year'
  selectedMonth: string
  selectedYear: number
  isOnline?: boolean
  previousMonth?: string

  // Data arrays
  monthExpenses: DetailExpenseEntry[]
  monthIncomes: DetailIncomeEntry[]
  annualExpenses: DetailExpenseEntry[]
  previousMonthExpenses: DetailExpenseEntry[]
  previousMonthIncomes: DetailIncomeEntry[]
  yearExpenseItems: DetailExpenseEntry[]
  yearIncomeItems: DetailIncomeEntry[]
  previousYearExpenseItems: DetailExpenseEntry[]
  previousYearIncomeItems: DetailIncomeEntry[]
  monthExpenseLimits: ExpenseCategoryMonthLimit[]
  previousMonthExpenseLimits: ExpenseCategoryMonthLimit[]
  monthIncomeExpectations: IncomeCategoryMonthExpectation[]
  previousMonthIncomeExpectations: IncomeCategoryMonthExpectation[]
  creditCards: CreditCard[]
  expenseCategoryIdToColor: Record<string, string>
  incomeCategoryIdToColor: Record<string, string>
  includeReportWeights: boolean
  yearDetailLoading: boolean
  isCustomPeriod?: boolean
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: 'var(--payment-method-cash)',
  debit: 'var(--payment-method-debit)',
  credit_card: 'var(--payment-method-credit-card)',
  pix: 'var(--payment-method-pix)',
  transfer: 'var(--payment-method-transfer)',
  other: 'var(--payment-method-other)',
}

const DETAIL_ITEMS_STEP = 8


export default function CategoryDetailModal({
  isOpen,
  onClose,
  type,
  categoryId,
  categoryName,
  period,
  selectedMonth,
  selectedYear,
  isOnline,

  monthExpenses,
  monthIncomes,
  annualExpenses,
  previousMonthExpenses,
  previousMonthIncomes,
  yearExpenseItems,
  yearIncomeItems,
  previousYearExpenseItems,
  previousYearIncomeItems,
  monthExpenseLimits,
  previousMonthExpenseLimits,
  monthIncomeExpectations,
  previousMonthIncomeExpectations,
  creditCards,
  expenseCategoryIdToColor,
  incomeCategoryIdToColor,
  includeReportWeights,
  yearDetailLoading,
  isCustomPeriod = false,
}: CategoryDetailModalProps) {
  const [modalTab, setModalTab] = useState<'summary' | 'transactions'>('summary')
  const [detailSearch, setDetailSearch] = useState('')
  const [detailVisibleCount, setDetailVisibleCount] = useState(DETAIL_ITEMS_STEP)

  // Reset tab and filters when opening/changing target
  useEffect(() => {
    if (isOpen) {
      setModalTab('summary')
      setDetailSearch('')
      setDetailVisibleCount(DETAIL_ITEMS_STEP)
    }
  }, [isOpen, categoryId, type, period])

  const getAmountByMode = useCallback(
    (entry: { amount: number; report_weight?: number | null }) =>
      includeReportWeights
        ? getWeightedReportAmount(entry.amount, entry.report_weight)
        : entry.amount,
    [includeReportWeights]
  )

  const getExpenseColor = useCallback(
    (catId: string, fallback: string) =>
      expenseCategoryIdToColor[catId] ?? fallback,
    [expenseCategoryIdToColor]
  )

  const getIncomeColor = useCallback(
    (catId: string, fallback: string) =>
      incomeCategoryIdToColor[catId] ?? fallback,
    [incomeCategoryIdToColor]
  )

  const detailItems = useMemo(() => {
    if (!isOpen) {
      return [] as Array<{ id: string; description: string; date: string; amount: number; originalAmount: number }>
    }

    if (type === 'expense') {
      const items = period === 'year' ? yearExpenseItems : monthExpenses
      return items
        .filter((item) => item.category_id === categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Despesa',
          date: item.date,
          amount: getAmountByMode(item),
          originalAmount: item.amount,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (type === 'income') {
      const items = period === 'year' ? yearIncomeItems : monthIncomes
      return items
        .filter((item) => item.income_category_id === categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.income_category?.name || 'Renda',
          date: item.date,
          amount: getAmountByMode(item),
          originalAmount: item.amount,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (type === 'payment_method') {
      const items = period === 'year' ? annualExpenses : monthExpenses
      return items
        .filter((item) => (item.payment_method || 'other') === categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Despesa',
          date: item.date,
          amount: getAmountByMode(item),
          originalAmount: item.amount,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    if (type === 'credit_card') {
      const items = period === 'year' ? annualExpenses : monthExpenses
      return items
        .filter((item) => item.credit_card_id === categoryId)
        .map((item) => ({
          id: item.id,
          description: item.description || item.category?.name || 'Despesa',
          date: item.date,
          amount: getAmountByMode(item),
          originalAmount: item.amount,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }

    return []
  }, [
    isOpen,
    type,
    period,
    monthExpenses,
    monthIncomes,
    yearExpenseItems,
    yearIncomeItems,
    annualExpenses,
    categoryId,
    getAmountByMode,
  ])

  const detailCurrentTotal = useMemo(
    () => detailItems.reduce((sum, item) => sum + item.amount, 0),
    [detailItems]
  )

  const filteredDetailItems = useMemo(() => {
    const search = detailSearch.trim().toLowerCase()
    if (!search) {
      return detailItems
    }
    return detailItems.filter((item) =>
      item.description.toLowerCase().includes(search)
    )
  }, [detailItems, detailSearch])

  const visibleDetailItems = useMemo(
    () => filteredDetailItems.slice(0, detailVisibleCount),
    [filteredDetailItems, detailVisibleCount]
  )

  const hasMoreDetailItems = filteredDetailItems.length > visibleDetailItems.length

  const detailPreviousTotal = useMemo(() => {
    if (!isOpen) {
      return 0
    }

    if (period === 'year' && type === 'expense') {
      return previousYearExpenseItems
        .filter((item) => item.category_id === categoryId)
        .reduce((sum, item) => sum + getAmountByMode(item), 0)
    }

    if (period === 'year' && type === 'income') {
      return previousYearIncomeItems
        .filter((item) => item.income_category_id === categoryId)
        .reduce((sum, item) => sum + getAmountByMode(item), 0)
    }

    if (type === 'expense') {
      return previousMonthExpenses
        .filter((item) => item.category_id === categoryId)
        .reduce((sum, item) => sum + getAmountByMode(item), 0)
    }

    return previousMonthIncomes
      .filter((item) => item.income_category_id === categoryId)
      .reduce((sum, item) => sum + getAmountByMode(item), 0)
  }, [
    isOpen,
    period,
    type,
    categoryId,
    previousMonthExpenses,
    previousMonthIncomes,
    previousYearExpenseItems,
    previousYearIncomeItems,
    getAmountByMode,
  ])

  const detailDifference = detailCurrentTotal - detailPreviousTotal
  const detailDifferencePct =
    detailPreviousTotal > 0 ? (detailDifference / detailPreviousTotal) * 100 : null

  const detailCategoryColor = useMemo(() => {
    if (!isOpen) return 'var(--color-primary)'
    if (type === 'expense') {
      return getExpenseColor(categoryId, 'var(--color-primary)')
    }
    if (type === 'income') {
      return getIncomeColor(categoryId, 'var(--color-primary)')
    }
    if (type === 'payment_method') {
      return PAYMENT_METHOD_COLORS[categoryId] || 'var(--color-primary)'
    }
    if (type === 'credit_card') {
      return (
        creditCards.find((c) => c.id === categoryId)?.color || 'var(--color-primary)'
      )
    }
    return 'var(--color-primary)'
  }, [isOpen, type, categoryId, getExpenseColor, getIncomeColor, creditCards])

  const monthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    monthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [monthExpenseLimits])

  const previousMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthExpenseLimits.forEach((item) =>
      map.set(item.category_id, item.limit_amount)
    )
    return map
  }, [previousMonthExpenseLimits])

  const monthIncomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()
    monthIncomeExpectations.forEach((item) =>
      map.set(item.income_category_id, item.expectation_amount)
    )
    return map
  }, [monthIncomeExpectations])

  const previousMonthIncomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthIncomeExpectations.forEach((item) =>
      map.set(item.income_category_id, item.expectation_amount)
    )
    return map
  }, [previousMonthIncomeExpectations])

  const detailMonthlyGoal = useMemo(() => {
    if (period !== 'month' || !categoryId) return null

    if (type === 'expense') {
      const currentValue = monthExpenseLimitMap.get(categoryId)
      const fallbackValue = previousMonthExpenseLimitMap.get(categoryId)
      const limitAmount = currentValue !== undefined ? currentValue : fallbackValue

      if (limitAmount === undefined || limitAmount === null) {
        return {
          label: 'Limite',
          configured: false,
        }
      }

      const exceededAmount = Math.max(detailCurrentTotal - limitAmount, 0)
      const remainingAmount = Math.max(limitAmount - detailCurrentTotal, 0)

      return {
        label: 'Limite',
        configured: true,
        targetAmount: limitAmount,
        currentAmount: detailCurrentTotal,
        differenceAmount: exceededAmount > 0 ? exceededAmount : remainingAmount,
        isExceeded: exceededAmount > 0,
      }
    }

    const currentValue = monthIncomeExpectationMap.get(categoryId)
    const fallbackValue = previousMonthIncomeExpectationMap.get(categoryId)
    const expectationAmount = currentValue !== undefined ? currentValue : fallbackValue

    if (expectationAmount === undefined || expectationAmount === null) {
      return {
        label: 'Expectativa',
        configured: false,
      }
    }

    const exceededAmount = Math.max(detailCurrentTotal - expectationAmount, 0)
    const remainingAmount = Math.max(expectationAmount - detailCurrentTotal, 0)

    return {
      label: 'Expectativa',
      configured: true,
      targetAmount: expectationAmount,
      currentAmount: detailCurrentTotal,
      differenceAmount: exceededAmount > 0 ? exceededAmount : remainingAmount,
      isExceeded: exceededAmount > 0,
    }
  }, [
    period,
    type,
    categoryId,
    detailCurrentTotal,
    monthExpenseLimitMap,
    previousMonthExpenseLimitMap,
    monthIncomeExpectationMap,
    previousMonthIncomeExpectationMap,
  ])

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setDetailSearch('')
        onClose()
      }}
      title={`${
        type === 'expense'
          ? 'Despesas'
          : type === 'income'
          ? 'Rendas'
          : type === 'payment_method'
          ? 'Pagamentos'
          : 'Cartão de Crédito'
      } • ${categoryName}`}
    >
      <div className="modal-body-stack">
        {isCustomPeriod ? (
          <div className="space-y-4">
            {/* Total no período */}
            <div className="rounded-xl border border-glass surface-glass p-3.5 shadow-sm">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-wider">
                Total no período selecionado
              </p>
              <p className="text-lg font-bold text-primary font-mono mt-0.5">
                {formatCurrency(detailCurrentTotal)}
              </p>
            </div>

            {/* Listagem Simplificada */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
                  Buscar por descrição
                </label>
                <Input
                  type="text"
                  value={detailSearch}
                  onChange={(event) => setDetailSearch(event.target.value)}
                  placeholder="Digite parte da descrição do lançamento..."
                />
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredDetailItems.length === 0 ? (
                  <p className="text-xs text-secondary py-6 text-center">
                    Nenhum lançamento encontrado para os filtros.
                  </p>
                ) : (
                  <>                    {visibleDetailItems.map((item, index) => (
                        <div
                          key={item.id}
                          className={`animate-stagger-item ${getStaggerClass(index)}`}
                        >
                          <TransactionRow
                            description={item.description}
                            date={item.date}
                            amount={item.amount}
                            originalAmount={item.originalAmount}
                          />
                        </div>
                      ))}

                    {hasMoreDetailItems && (
                      <div className="pt-2 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDetailVisibleCount((prev) => prev + DETAIL_ITEMS_STEP)
                          }
                          className="w-full"
                        >
                          Carregar mais lançamentos
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Tab Switcher */}
            <Tabs
              value={modalTab}
              onValueChange={(value) => setModalTab(value as 'summary' | 'transactions')}
              className="mb-2"
            >
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="summary" className="text-xs">
                  Resumo e Metas
                </TabsTrigger>
                <TabsTrigger value="transactions" className="text-xs">
                  Lançamentos ({filteredDetailItems.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {modalTab === 'summary' ? (
              <div className="space-y-4">
                {/* Historical Comparison */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                    Comparativo Histórico
                  </p>
                  <div className="rounded-xl border border-glass surface-glass p-3.5 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-secondary">
                          Total em {period === 'year' ? selectedYear : formatMonth(selectedMonth)}
                        </p>
                        <p className="text-lg font-bold text-primary font-mono leading-tight">
                          {formatCurrency(detailCurrentTotal)}
                        </p>
                      </div>
                      {detailDifferencePct !== null && (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            detailDifference >= 0
                              ? type === 'expense'
                                ? 'text-expense bg-expense/10'
                                : 'text-income bg-income/10'
                              : type === 'expense'
                              ? 'text-income bg-income/10'
                              : 'text-expense bg-expense/10'
                          }`}
                        >
                          {detailDifference >= 0 ? '+' : ''}
                          {formatNumberWithTwoDecimalsBR(detailDifferencePct)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-glass flex justify-between text-xs text-secondary">
                      <span>Período anterior:</span>
                      <span className="font-semibold text-primary font-mono">
                        {formatCurrency(detailPreviousTotal)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-secondary">
                      <span>Variação absoluta:</span>
                      <span
                        className={`font-semibold ${
                          detailDifference >= 0
                            ? type === 'expense'
                              ? 'text-expense'
                              : 'text-income'
                            : type === 'expense'
                            ? 'text-income'
                            : 'text-expense'
                        }`}
                      >
                        {detailDifference >= 0 ? '+' : ''}
                        {formatCurrency(detailDifference)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Goals/Expectations */}
                {period === 'month' && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                      Metas Orçamentárias
                    </p>
                    <div className="rounded-xl border border-glass surface-glass p-3.5 shadow-sm">
                      {detailMonthlyGoal?.configured ? (
                        <div>
                          <div className="flex justify-between text-xs text-secondary mb-1">
                            <span>Consumo do Limite</span>
                            <span className="font-semibold text-primary font-mono">
                              {formatCurrency(detailMonthlyGoal.currentAmount ?? 0)} de{' '}
                              {formatCurrency(detailMonthlyGoal.targetAmount ?? 0)}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full h-1.5 rounded-full bg-secondary bg-opacity-20 overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                detailMonthlyGoal.isExceeded ? 'bg-expense' : 'bg-primary'
                              }`}
                              style={{
                                width: `${Math.min(
                                  ((detailMonthlyGoal.currentAmount ?? 0) /
                                    (detailMonthlyGoal.targetAmount ?? 1)) *
                                    100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                          <p
                            className={`text-xs font-semibold ${
                              detailMonthlyGoal.isExceeded ? 'text-expense' : 'text-income'
                            }`}
                          >
                            {detailMonthlyGoal.isExceeded
                              ? `Excedido em ${formatCurrency(
                                  detailMonthlyGoal.differenceAmount ?? 0
                                )}`
                              : `Restam ${formatCurrency(
                                  detailMonthlyGoal.differenceAmount ?? 0
                                )} para o limite`}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-secondary text-center py-2">
                          Sem meta ou limite de orçamento configurado no mês.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Trend Chart */}
                {isOpen && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                      Tendência da Categoria
                    </p>
                    <div className="rounded-xl border border-glass surface-glass p-3 shadow-sm">
                      <CategoryDetailMiniChart
                        detailItems={detailItems}
                        period={period}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        color={detailCategoryColor}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search Input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
                    Buscar por descrição
                  </label>
                  <Input
                    type="text"
                    value={detailSearch}
                    onChange={(event) => setDetailSearch(event.target.value)}
                    placeholder="Digite parte da descrição do lançamento..."
                  />
                </div>

                {/* Transactions List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredDetailItems.length === 0 ? (
                    <p className="text-xs text-secondary py-6 text-center">
                      {yearDetailLoading && period === 'year' ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 size={14} className="animate-spin text-primary" />
                          Buscando lançamentos...
                        </span>
                      ) : !isOnline && period === 'year' ? (
                        'Você está offline. Conecte-se à internet para buscar lançamentos anuais.'
                      ) : (
                        'Nenhum lançamento encontrado para os filtros.'
                      )}
                    </p>
                  ) : (
                    <>
                      {visibleDetailItems.map((item, index) => (
                        <div
                          key={item.id}
                          className={`animate-stagger-item ${getStaggerClass(index)}`}
                        >
                          <TransactionRow
                            description={item.description}
                            date={item.date}
                            amount={item.amount}
                            originalAmount={item.originalAmount}
                          />
                        </div>
                      ))}

                      {hasMoreDetailItems && (
                        <div className="pt-2 text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDetailVisibleCount((prev) => prev + DETAIL_ITEMS_STEP)
                            }
                            className="w-full"
                          >
                            Carregar mais lançamentos
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
