import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import { useCategories } from '@/hooks/useCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Category } from '@/types'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'

export default function Categories() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories()
  const { colorPalette } = usePaletteColors()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '' })
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

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return
    if (!confirm('Os itens vinculados serão movidos para "Sem categoria". Deseja continuar?')) return

    const { error } = await deleteCategory(id)
    if (error) {
      alert('Erro ao excluir categoria: ' + error)
      return
    }
    handleCloseModal()
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
            className="flex items-center gap-2"
            disabled={categories.length >= 15}
            title={categories.length >= 15 ? 'Limite de 15 categorias atingido' : ''}
          >
            <Plus size={16} />
            Adicionar
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
            onDelete={editingCategory ? () => handleDelete(editingCategory.id) : undefined}
          />
        </form>
      </Modal>
    </div>
  )
}





