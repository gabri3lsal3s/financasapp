import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useCategories } from '@/hooks/useCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Category } from '@/types'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Trash2 } from 'lucide-react'

export default function Categories() {
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

  const assignedCategoryColors = assignUniquePaletteColors(categories, colorPalette)

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
      // Usa cor do design system (palette)
      const paletteColor = getCategoryColorForPalette('var(--color-primary)', colorPalette)
      const categoryData = { ...formData, color: paletteColor }
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
    <div>
      <PageHeader
        title={PAGE_HEADERS.categories.title}
        subtitle={PAGE_HEADERS.categories.description}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            disabled={categories.length >= 15}
            title={categories.length >= 15 ? 'Limite de 15 categorias atingido' : ''}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
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
            {categories.map((category, idx) => (
                  <Card key={category.id} className="py-3" onClick={() => handleOpenModal(category)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: assignedCategoryColors[idx] || getCategoryColorForPalette(category.color, colorPalette) }}
                        />
                        <p className="font-medium text-primary truncate">{category.name}</p>
                      </div>
                    </div>
                  </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? 'Editar categoria' : 'Adicionar categoria'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da Categoria"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Alimentação, Transporte..."
            required
          />

          <ModalActionFooter
            onCancel={handleCloseModal}
            submitLabel={editingCategory ? 'Salvar alterações' : 'Salvar'}
            deleteLabel={editingCategory ? 'Excluir categoria' : undefined}
            onDelete={editingCategory ? () => handleDeleteClick(editingCategory) : undefined}
          />
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Excluir Categoria"
      >
        <div className="space-y-4 text-primary">
          {deleteUsageCount > 0 ? (
            <>
              <p>
                A categoria <strong>{categoryToDelete?.name}</strong> possui{' '}
                <strong>{deleteUsageCount}</strong> lançamento(s) vinculados.
              </p>
              <p>
                Para onde deseja movê-los? Se você não escolher, eles serão movidos para <em>"Sem categoria"</em>.
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
            <p>
              Tem certeza que deseja excluir a categoria <strong>{categoryToDelete?.name}</strong>?
            </p>
          )}

          <div className="pt-4 flex justify-center">
            <Button
              variant="ghost"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="btn-discrete-delete px-4"
              title={isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
            >
              <Trash2 size={24} />
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}





