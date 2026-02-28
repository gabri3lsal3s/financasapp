import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { IncomeCategory } from '@/types'
import { getCategoryColor, getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'

export default function IncomeCategories() {
  const { incomeCategories, loading, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory } = useIncomeCategories()
  const { colorPalette } = usePaletteColors()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<IncomeCategory | null>(null)
  const [formData, setFormData] = useState({ name: '' })
  const assignedIncomeCategoryColors = assignUniquePaletteColors(incomeCategories, colorPalette)

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
      const randomIndex = Math.floor(Math.random() * 20)
      const randomColor = getCategoryColor(randomIndex, 'vivid')
      const categoryData = { ...formData, color: randomColor }

      const { error } = await createIncomeCategory(categoryData as Omit<IncomeCategory, 'id' | 'created_at'>)
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

    const { error } = await deleteIncomeCategory(id)
    if (error) {
      alert('Erro ao excluir categoria: ' + error)
      return
    }
    handleCloseModal()
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.incomeCategories.title}
        subtitle={PAGE_HEADERS.incomeCategories.description}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Adicionar
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : incomeCategories.length === 0 ? (
          <Card className="text-center py-10 space-y-3">
            <p className="text-secondary">Nenhuma categoria de renda cadastrada.</p>
            <Button onClick={() => handleOpenModal()}>Adicionar categoria de renda</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-secondary">Clique em um item para editar ou excluir.</p>
            {incomeCategories.map((category, idx) => (
                  <Card key={category.id} className="py-3" onClick={() => handleOpenModal(category)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: assignedIncomeCategoryColors[idx] || getCategoryColorForPalette(category.color, colorPalette) }}
                        />
                        <p className="font-medium text-primary truncate">
                          {category.name}
                        </p>
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
        title={editingCategory ? 'Editar categoria de renda' : 'Adicionar categoria de renda'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ name: e.target.value })}
            placeholder="Ex: Salário, Freelancer..."
            required
            autoFocus
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" fullWidth onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              {editingCategory ? 'Salvar alterações' : 'Salvar'}
            </Button>
          </div>

          {editingCategory && (
            <Button type="button" variant="danger" fullWidth onClick={() => handleDelete(editingCategory.id)}>
              Excluir categoria de renda
            </Button>
          )}
        </form>
      </Modal>
    </div>
  )
}
