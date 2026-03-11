import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Loader from '@/components/Loader'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { IncomeCategory } from '@/types'
import { getCategoryColor, getCategoryColorForPalette } from '@/utils/categoryColors'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Trash2, RefreshCw } from 'lucide-react'

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
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        }
      />

      <div className="p-4 lg:p-6">
        {loading && incomeCategories.length === 0 ? (
          <Loader text="Carregando fontes..." className="py-12" />
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

          <ModalActionFooter
            onCancel={handleCloseModal}
            submitLabel={editingCategory ? 'Salvar alterações' : 'Salvar'}
            deleteLabel={editingCategory ? 'Excluir categoria de renda' : undefined}
            onDelete={editingCategory ? () => handleDeleteClick(editingCategory) : undefined}
          />
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Excluir Categoria de Renda"
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
                  ...incomeCategories
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
              variant="ghost-danger"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="px-4"
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
