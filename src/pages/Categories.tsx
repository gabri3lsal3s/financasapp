import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import { useCategories } from '@/hooks/useCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Category } from '@/types'
import { getCategoryColor, getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { LIST_ITEM_EXIT_MS } from '@/constants/animation'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import AnimatedListItem from '@/components/AnimatedListItem'

export default function Categories() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories()
  const { colorPalette } = usePaletteColors()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({ name: '' })
  const [removingIds, setRemovingIds] = useState<string[]>([])

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
      const randomIndex = Math.floor(Math.random() * 20)
      const randomColor = getCategoryColor(randomIndex, 'vivid')
      const categoryData = { ...formData, color: randomColor }
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
    setRemovingIds((s) => [...s, id])
    setTimeout(async () => {
      const { error } = await deleteCategory(id)
      if (error) {
        alert('Erro ao deletar categoria: ' + error)
      }
      setRemovingIds((s) => s.filter((x) => x !== id))
    }, LIST_ITEM_EXIT_MS)
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
          >
            <Plus size={16} />
            Nova
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : categories.length === 0 ? (
          <Card className="text-center py-8">
            <p className="mb-4 text-secondary">Nenhuma categoria cadastrada</p>
            <Button onClick={() => handleOpenModal()}>Criar primeira categoria</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {(() => {
              const assigned = assignUniquePaletteColors(categories, colorPalette)
              return categories.map((category, idx) => (
                <AnimatedListItem key={category.id} isRemoving={removingIds.includes(category.id)}>
                  <Card>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: assigned[idx] || getCategoryColorForPalette(category.color, colorPalette) }}
                        />
                        <span className="font-medium text-primary">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton
                          icon={<Edit2 size={18} />}
                          variant="neutral"
                          size="md"
                          label="Editar categoria"
                          onClick={() => handleOpenModal(category)}
                        />
                        <IconButton
                          icon={<Trash2 size={18} />}
                          variant="danger"
                          size="md"
                          label="Deletar categoria"
                          onClick={() => handleDelete(category.id)}
                        />
                      </div>
                    </div>
                  </Card>
                </AnimatedListItem>
            ))})()}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da Categoria"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Alimentação, Transporte..."
            required
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={handleCloseModal}
            >
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}





