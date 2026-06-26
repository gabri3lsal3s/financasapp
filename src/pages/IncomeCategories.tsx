import { useState } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import Button from '@/components/Button'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ConfirmModal from '@/components/ConfirmModal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { SkeletonCategoryGrid } from '@/components/Skeleton'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { IncomeCategory } from '@/types'
import { getCategoryColorForPalette, generateCategoryColor } from '@/utils/categoryColors'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, RefreshCw } from 'lucide-react'
import ScrollToTop from '@/components/ScrollToTop'
import { getCategoryIcon } from '@/utils/categoryIcons'

export default function IncomeCategories() {
  const { incomeCategories, loading, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory, getIncomeCategoryUsageCount } = useIncomeCategories()
  const { colorPalette } = usePaletteColors()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<IncomeCategory | null>(null)
  const [formData, setFormData] = useState({ name: '' })

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<IncomeCategory | null>(null)
  const [deleteUsageCount, setDeleteUsageCount] = useState(0)
  const [targetCategoryId, setTargetCategoryId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)


  const handleOpenModal = (category?: IncomeCategory) => {
    if (category) {
      setEditingCategory(category)
      setFormData({ name: category.name })
    } else {
      setEditingCategory(null)
      setFormData({ name: '' })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setFormData({ name: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) return

    if (editingCategory) {
      const { error } = await updateIncomeCategory(editingCategory.id, { name: formData.name })
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao atualizar categoria: ' + error)
      }
    } else {
      const randomColor = generateCategoryColor(formData.name, 'vivid')
      const categoryData = { ...formData, color: randomColor }

      const { error } = await createIncomeCategory(categoryData as Omit<IncomeCategory, 'id' | 'created_at'>)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao criar categoria: ' + error)
      }
    }
  }

  const handleDeleteClick = async (category: IncomeCategory) => {
    const usageCount = await getIncomeCategoryUsageCount(category.id)
    setCategoryToDelete(category)
    setDeleteUsageCount(usageCount)
    setTargetCategoryId('')
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!categoryToDelete) return

    setIsDeleting(true)
    const { error } = await deleteIncomeCategory(categoryToDelete.id, targetCategoryId || undefined)
    setIsDeleting(false)

    if (error) {
      alert('Erro ao excluir categoria: ' + error)
      return
    }

    setIsDeleteModalOpen(false)
    setCategoryToDelete(null)

    if (editingCategory?.id === categoryToDelete.id) {
      handleCloseModal()
    }
  }

  return (
    <div className="animate-page-enter">
      <PageHeader
        title={PAGE_HEADERS.incomeCategories.title}
        subtitle={PAGE_HEADERS.incomeCategories.description}
        action={
          <PageHeaderActions>
            <PageHeaderActionButton
              intent="income"
              icon={Plus}
              label="Adicionar"
              onClick={() => handleOpenModal()}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6">
        {loading && incomeCategories.length === 0 ? (
          <SkeletonCategoryGrid />
        ) : incomeCategories.length === 0 ? (
          <Card className="text-center py-10 space-y-3">
            <p className="text-secondary">Nenhuma categoria de renda cadastrada.</p>
            <Button onClick={() => handleOpenModal()}>Adicionar categoria de renda</Button>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {incomeCategories.map((category, index) => {
              const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
              const staggerClass = index < 5 ? staggerClasses[index] : ''
              return (
                <Card
                  key={category.id}
                  className={`py-3 hover:border-primary transition-colors cursor-pointer animate-stagger-item ${staggerClass}`}
                  onClick={() => handleOpenModal(category)}
                >
                  <div className="flex items-center gap-3">
                    <span 
                      style={{ color: getCategoryColorForPalette(category.color, colorPalette) }}
                      className="flex items-center justify-center flex-shrink-0"
                    >
                      {getCategoryIcon(category.name, 16, category.color?.split('|')[1])}
                    </span>
                    <span className="font-medium text-primary flex-1 truncate">{category.name}</span>
                    {category.id.startsWith('offline-') && (
                      <span title="Pendente de sincronização">
                        <RefreshCw size={14} className="text-accent animate-spin" />
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ModalForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? 'Editar categoria de renda' : 'Adicionar categoria de renda'}
        onSubmit={handleSubmit}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={handleCloseModal}
            submitLabel={editingCategory ? 'Salvar alterações' : 'Salvar'}
            deleteLabel={editingCategory ? 'Excluir categoria de renda' : undefined}
            onDelete={editingCategory ? () => handleDeleteClick(editingCategory) : undefined}
          />
        )}
      >
        <Input
          label="Nome"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ name: e.target.value })}
          placeholder="Ex: Salário, Freelancer..."
          required
          autoFocus
        />
      </ModalForm>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Excluir Categoria de Renda"
        confirmLabel={isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
        confirmVariant="danger"
        confirmDisabled={isDeleting}
        loading={isDeleting}
        onConfirm={() => void confirmDelete()}
      >
        {deleteUsageCount > 0 ? (
          <>
            <p className="text-sm">
              A categoria <strong>{categoryToDelete?.name}</strong> possui{' '}
              <strong>{deleteUsageCount}</strong> lançamento(s) vinculados.
            </p>
            <p className="modal-intro text-sm">
              Para onde deseja movê-los? Se você não escolher, eles serão movidos para <em>Sem categoria</em>.
            </p>
            <Select
              value={targetCategoryId}
              onChange={(e) => setTargetCategoryId(e.target.value)}
              options={[
                { value: '', label: 'Sem categoria (Padrão)' },
                ...incomeCategories
                  .filter((c) => c.id !== categoryToDelete?.id && c.name !== 'Sem categoria')
                  .map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </>
        ) : (
          <p className="text-sm">
            Tem certeza que deseja excluir a categoria <strong>{categoryToDelete?.name}</strong>?
          </p>
        )}
      </ConfirmModal>
      <ScrollToTop />
    </div>
  )
}
