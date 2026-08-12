import CategoryFormModal from '@/components/categories/CategoryFormModal'
import CategoryDeleteConfirmModal from '@/components/categories/CategoryDeleteConfirmModal'
import LimitSuggestionsModal from '@/components/categories/LimitSuggestionsModal'
import type { UseCategoriesDataReturn } from '@/hooks/useCategoriesData'

interface CategoriesModalsProps {
  data: UseCategoriesDataReturn
}

/**
 * CategoriesModals — renderização centralizada dos 3 modais da página
 * Categorias (form, exclusão e sugestões), extraída do orquestrador.
 */
export default function CategoriesModals({ data }: CategoriesModalsProps) {
  return (
    <>
      <CategoryFormModal
        isOpen={data.isCategoryModalOpen}
        onClose={data.handleCloseCategoryModal}
        onSubmit={data.handleCategorySubmit}
        editingCategory={data.editingCategory}
        tabType={data.activeTab}
      />

      <CategoryDeleteConfirmModal
        isOpen={data.isCategoryDeleteModalOpen}
        onClose={() => data.setIsCategoryDeleteModalOpen(false)}
        onConfirm={data.handleConfirmDeleteCategory}
        categoryToDelete={data.categoryToDelete}
        usageCount={data.deleteUsageCount}
        categories={data.categories}
        incomeCategories={data.incomeCategories}
        tabType={data.activeTab}
      />

      <LimitSuggestionsModal
        isOpen={data.isSuggestionsModalOpen}
        onClose={() => data.setIsSuggestionsModalOpen(false)}
        onSubmit={data.handleSuggestionsSubmit}
        initialSuggestions={data.suggestions}
      />
    </>
  )
}
