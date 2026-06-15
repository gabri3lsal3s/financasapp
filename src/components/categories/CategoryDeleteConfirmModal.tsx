import { useState, useEffect } from 'react'
import ConfirmModal from '@/components/ConfirmModal'
import Select from '@/components/Select'
import type { Category, IncomeCategory } from '@/types'

interface CategoryDeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (targetCategoryId: string) => Promise<void>
  categoryToDelete: Category | IncomeCategory | null
  usageCount: number
  categories: Category[]
  incomeCategories: IncomeCategory[]
  tabType: 'expenses' | 'incomes'
}

export default function CategoryDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  categoryToDelete,
  usageCount,
  categories,
  incomeCategories,
  tabType,
}: CategoryDeleteConfirmModalProps) {
  const [targetCategoryId, setTargetCategoryId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset target category when opening/closing or category changes
  useEffect(() => {
    if (isOpen) {
      setTargetCategoryId('')
      setIsDeleting(false)
    }
  }, [isOpen, categoryToDelete])

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm(targetCategoryId)
    } finally {
      setIsDeleting(false)
    }
  }

  const selectOptions = [
    { value: '', label: 'Sem categoria (Padrão)' },
    ...(tabType === 'expenses'
      ? categories
          .filter((c) => c.id !== categoryToDelete?.id && c.name !== 'Sem categoria')
          .map((c) => ({ value: c.id, label: c.name }))
      : incomeCategories
          .filter((c) => c.id !== categoryToDelete?.id && c.name !== 'Sem categoria')
          .map((c) => ({ value: c.id, label: c.name })))
  ]

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={() => !isDeleting && onClose()}
      title={tabType === 'expenses' ? 'Excluir Categoria' : 'Excluir Categoria de Renda'}
      confirmLabel={isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
      confirmVariant="danger"
      confirmDisabled={isDeleting}
      loading={isDeleting}
      onConfirm={handleConfirm}
    >
      {usageCount > 0 ? (
        <div className="space-y-4">
          <p className="text-sm">
            A categoria <strong>{categoryToDelete?.name}</strong> possui{' '}
            <strong>{usageCount}</strong> lançamento(s) vinculados.
          </p>
          <p className="modal-intro text-sm text-secondary">
            Para onde deseja movê-los? Se você não escolher, eles serão movidos para <em>Sem categoria</em>.
          </p>
          <Select
            value={targetCategoryId}
            onChange={(e) => setTargetCategoryId(e.target.value)}
            options={selectOptions}
          />
        </div>
      ) : (
        <p className="text-sm">
          Tem certeza que deseja excluir a categoria <strong>{categoryToDelete?.name}</strong>?
        </p>
      )}
    </ConfirmModal>
  )
}
