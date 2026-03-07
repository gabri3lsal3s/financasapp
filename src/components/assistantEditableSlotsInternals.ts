import type { AssistantResolvedCategory } from '@/types'

interface CategoryOption {
  id: string
  name: string
}

const normalizeCategoryName = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const resolveCategoryIdForSelect = (
  category: AssistantResolvedCategory | undefined,
  sourceList: CategoryOption[],
) => {
  if (!category) return ''

  if (category.id && sourceList.some((item) => item.id === category.id)) {
    return category.id
  }

  const normalizedCategoryName = normalizeCategoryName(category.name)
  if (!normalizedCategoryName) return ''

  const byName = sourceList.find((item) => normalizeCategoryName(item.name) === normalizedCategoryName)
  return byName?.id || ''
}

export const assistantEditableSlotsInternals = {
  normalizeCategoryName,
  resolveCategoryIdForSelect,
}
