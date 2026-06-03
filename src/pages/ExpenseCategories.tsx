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
import Loader from '@/components/Loader'
import { useCategories } from '@/hooks/useCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Category } from '@/types'
import { getCategoryColorForPalette, generateCategoryColor } from '@/utils/categoryColors'
import { Plus, RefreshCw } from 'lucide-react'

export default function ExpenseCategories() {
  const { categories, loading, createCategory, updateCategory, deleteCategory, getCategoryUsageCount } = useCategories()
  const { colorPalette } = usePaletteColors()

  // Edit/Add Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '' })

  // Delete Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleteUsageCount, setDeleteUsageCount] = useState(0)
  const [targetCategoryId, setTargetCategoryId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)


  const handleOpenModal = (category?: Category) => {
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
      const { error } = await updateCategory(editingCategory.id, formData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao atualizar categoria: ' + error)
      }
    } else {
      // Usa função de fallback determinística (hash do nome) p/ cor única vívida
      const randomColor = generateCategoryColor(formData.name, 'vivid')
      const categoryData = { ...formData, color: randomColor }
      const { error } = await createCategory(categoryData as Omit<Category, 'id' | 'created_at'>)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao criar categoria: ' + error)
      }
    }
  }

  const handleDeleteClick = async (category: Category) => {
    // Busca uso real da categoria
    const usageCount = await getCategoryUsageCount(category.id)
    setCategoryToDelete(category)
    setDeleteUsageCount(usageCount)
    setTargetCategoryId('')
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!categoryToDelete) return

    setIsDeleting(true)
    const { error } = await deleteCategory(categoryToDelete.id, targetCategoryId || undefined)
    setIsDeleting(false)

    if (error) {
      alert('Erro ao excluir categoria: ' + error)
      return
    }

    setIsDeleteModalOpen(false)
    setCategoryToDelete(null)

    // Se está editando a categoria que acabou de apagar, fecha o modal de edição
    if (editingCategory?.id === categoryToDelete.id) {
      handleCloseModal()
    }
  }

  return (
    <div className="animate-page-enter">
      <PageHeader
        action={
          <PageHeaderActions>
            <PageHeaderActionButton
              intent="primary"
              icon={Plus}
              label="Adicionar"
              onClick={() => handleOpenModal()}
              disabled={categories.length >= 15}
              title={categories.length >= 15 ? 'Limite de 15 categorias atingido' : ''}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6">
        {loading && categories.length === 0 ? (
          <Loader text="Carregando categorias..." className="py-12" />
        ) : categories.length === 0 ? (
          <Card className="text-center py-10 space-y-3">
            <p className="text-secondary">Nenhuma categoria cadastrada.</p>
            <Button onClick={() => handleOpenModal()}>Adicionar categoria</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {categories.length >= 15 && (
              <div className="p-3 bg-tertiary border border-warning text-warning rounded-lg text-sm text-center">
                Você atingiu o limite máximo de 15 categorias. Para criar uma nova, exclua alguma existente.
              </div>
            )}
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              {categories.map((category, index) => {
                const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
                const staggerClass = index < 5 ? staggerClasses[index] : ''
                return (
                  <Card
                    key={category.id}
                    className={`py-3 hover:border-primary transition-colors cursor-pointer animate-stagger-item ${staggerClass}`}
                    onClick={() => handleOpenModal(category)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 border shadow-sm"
                        style={{ backgroundColor: getCategoryColorForPalette(category.color, colorPalette) }}
                      />
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
          </div>
        )}
      </div>

      <ModalForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? 'Editar categoria' : 'Adicionar categoria'}
        onSubmit={handleSubmit}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={handleCloseModal}
            submitLabel={editingCategory ? 'Salvar alterações' : 'Salvar'}
            deleteLabel={editingCategory ? 'Excluir categoria' : undefined}
            onDelete={editingCategory ? () => handleDeleteClick(editingCategory) : undefined}
          />
        )}
      >
        <Input
          label="Nome da Categoria"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Alimentação, Transporte..."
          required
        />
      </ModalForm>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Excluir Categoria"
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
                ...categories
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
    </div>
  )
}
