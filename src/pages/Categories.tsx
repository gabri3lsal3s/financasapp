import { TrendingDown, TrendingUp, Sliders } from 'lucide-react'

import { usePageActions } from '@/hooks/usePageActions'
import { SkeletonCategories } from '@/components/Skeleton'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import { useSearchHighlight } from '@/utils/pageTitles'
import { useCategoriesData } from '@/hooks/useCategoriesData'
import ExpenseCategoryGrid from '@/components/categories/ExpenseCategoryGrid'
import IncomeCategoryGrid from '@/components/categories/IncomeCategoryGrid'
import CategoriesModals from '@/components/categories/CategoriesModals'
import CategoriesTabs from '@/components/categories/CategoriesTabs'

export default function Categories() {
  useSearchHighlight()
  const data = useCategoriesData()
  const {
    currentMonth,
    handleMonthChange,
    swipeHandlers,
    isOnline,
    activeTab,
    setActiveTab,
    categories,
    incomeCategories,
    loadingData,
    expenseSpentByCategory,
    expenseBaseByCategory,
    incomeByCategory,
    incomeBaseByCategory,
    expenseCategoryColorMap,
    incomeCategoryColorMap,
    expenseLimitMap,
    incomeExpectationMap,
    expensesKpis,
    incomesKpis,
    savingExpenseLimitIds,
    savingIncomeExpectationIds,
    editingCategoryId,
    expenseLimitInputs,
    incomeExpectationInputs,
    averageIncome,
    getCategoryPercentageSuggestion,
    handleOpenCategoryModal,
    handleDeleteCategoryClick,
    setEditingCategoryId,
    setExpenseLimitInputs,
    setIncomeExpectationInputs,
    saveExpenseLimit,
    saveIncomeExpectation,
  } = data

  usePageActions([
    {
      icon: TrendingDown,
      label: 'Orçamentos',
      intent: activeTab === 'expenses' ? 'expense' : 'neutral',
      className: 'hidden lg:flex',
      onClick: () => {
        setActiveTab('expenses')
        setEditingCategoryId(null)
      },
      compactOnMobile: true,
    },
    {
      icon: TrendingUp,
      label: 'Metas',
      intent: activeTab === 'incomes' ? 'income' : 'neutral',
      className: 'hidden lg:flex',
      onClick: () => {
        setActiveTab('incomes')
        setEditingCategoryId(null)
      },
      compactOnMobile: true,
    },
    {
      icon: Sliders,
      label: 'Ajustar Sugestões',
      intent: 'neutral',
      show: activeTab === 'expenses',
      onClick: () => data.setIsSuggestionsModalOpen(true),
      compactOnMobile: true,
    },
  ])

  return (
    <div className="animate-page-enter min-h-[calc(100dvh-12rem)] flex flex-col" {...swipeHandlers}>
      <div className="p-4 lg:p-6 space-y-5 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />

        {/* Inline Tabs selector on mobile only! */}
        <CategoriesTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {loadingData ? (
          <SkeletonCategories />
        ) : (
          <MonthTransitionView month={currentMonth} className="space-y-4 lg:space-y-6 animate-fade-in">
            {activeTab === 'expenses' ? (
              <ExpenseCategoryGrid
                categories={categories}
                expenseSpentByCategory={expenseSpentByCategory}
                expenseBaseByCategory={expenseBaseByCategory}
                expenseCategoryColorMap={expenseCategoryColorMap}
                expenseLimitMap={expenseLimitMap}
                expensesKpis={expensesKpis}
                savingExpenseLimitIds={savingExpenseLimitIds}
                editingCategoryId={editingCategoryId}
                expenseLimitInputs={expenseLimitInputs}
                averageIncome={averageIncome}
                getCategoryPercentageSuggestion={getCategoryPercentageSuggestion}
                onEditCategory={handleOpenCategoryModal}
                onDeleteCategory={handleDeleteCategoryClick}
                onEditLimit={(id) => {
                  setEditingCategoryId(id)
                  const limitAmount = expenseLimitMap.get(id)
                  setExpenseLimitInputs(prev => ({
                    ...prev,
                    [id]: limitAmount ?? 0
                  }))
                }}
                onSaveLimit={saveExpenseLimit}
                onCancelEditLimit={() => setEditingCategoryId(null)}
                onSetLimitInput={(id, value: number) =>
                  setExpenseLimitInputs((prev) => ({ ...prev, [id]: value }))
                }
                onAddCategory={() => handleOpenCategoryModal()}
              />
            ) : (
              <IncomeCategoryGrid
                incomeCategories={incomeCategories}
                incomeByCategory={incomeByCategory}
                incomeBaseByCategory={incomeBaseByCategory}
                incomeCategoryColorMap={incomeCategoryColorMap}
                incomeExpectationMap={incomeExpectationMap}
                incomesKpis={incomesKpis}
                savingIncomeExpectationIds={savingIncomeExpectationIds}
                editingCategoryId={editingCategoryId}
                incomeExpectationInputs={incomeExpectationInputs}
                onEditCategory={handleOpenCategoryModal}
                onDeleteCategory={handleDeleteCategoryClick}
                onEditExpectation={(id) => {
                  setEditingCategoryId(id)
                  const expectationAmount = incomeExpectationMap.get(id)
                  setIncomeExpectationInputs(prev => ({
                    ...prev,
                    [id]: expectationAmount ?? 0
                  }))
                }}
                onSaveExpectation={saveIncomeExpectation}
                onCancelEditExpectation={() => setEditingCategoryId(null)}
                onSetExpectationInput={(id, value: number) =>
                  setIncomeExpectationInputs((prev) => ({ ...prev, [id]: value }))
                }
                onAddCategory={() => handleOpenCategoryModal()}
              />
            )}
          </MonthTransitionView>
        )}
      </div>

      <CategoriesModals data={data} />
    </div>
  )
}
