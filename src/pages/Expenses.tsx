import { useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useExpenses } from '@/hooks/useExpenses'
import { useCategories } from '@/hooks/useCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Expense } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import AnimatedListItem from '@/components/AnimatedListItem'

export default function Expenses() {
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses()
  const { categories } = useCategories()
  const { colorPalette } = usePaletteColors()
  const assignedCategories = assignUniquePaletteColors(categories, colorPalette)
  const categoryColorMap: Record<string, string> = {}
  categories.forEach((c, i) => {
    if (c && c.id) categoryColorMap[c.id] = assignedCategories[i] || getCategoryColorForPalette(c.color, colorPalette)
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
    description: '',
  })

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        amount: expense.amount.toString(),
        date: expense.date,
        category_id: expense.category_id,
        description: expense.description || '',
      })
    } else {
      setEditingExpense(null)
      setFormData({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        category_id: categories[0]?.id || '',
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
    setFormData({
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      category_id: categories[0]?.id || '',
      description: '',
    })
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || !formData.category_id) return

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const expenseData: Omit<Expense, 'id' | 'created_at' | 'category'> = {
      amount,
      date: formData.date,
      category_id: formData.category_id,
      ...(formData.description && { description: formData.description }),
    }

    if (editingExpense) {
      const { error } = await updateExpense(editingExpense.id, expenseData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao atualizar despesa: ' + error)
      }
    } else {
      const { error } = await createExpense(expenseData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao criar despesa: ' + error)
      }
    }
  }

  const [removingIds, setRemovingIds] = useState<string[]>([])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return

    // mark as removing to play animation
    setRemovingIds((s) => [...s, id])

    // wait animation then call API
    setTimeout(async () => {
      const { error } = await deleteExpense(id)
      if (error) {
        alert('Erro ao deletar despesa: ' + error)
      }
      setRemovingIds((s) => s.filter((x) => x !== id))
    }, 260)
  }

  return (
    <div>
      <PageHeader
        title="Despesas"
        subtitle="Registre e gerencie suas despesas"
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

      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Carregando...</div>
        ) : expenses.length === 0 ? (
          <Card className="text-center py-8">
            <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>Nenhuma despesa cadastrada</p>
            <Button onClick={() => handleOpenModal()}>
              Adicionar primeira despesa
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <AnimatedListItem key={expense.id} isRemoving={removingIds.includes(expense.id)}>
                <Card>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-1 h-6 rounded-sm flex-shrink-0" 
                        style={{ backgroundColor: expense.category?.id ? (categoryColorMap[expense.category.id] || getCategoryColorForPalette(expense.category.color, colorPalette)) : 'var(--color-primary)' }} 
                      />
                      <p className="font-medium text-primary truncate">
                        {expense.description || expense.category?.name || 'Sem descrição'}
                      </p>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {expense.category?.name} • {formatDate(expense.date)}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <IconButton
                        icon={<Edit2 size={16} />}
                        variant="neutral"
                        size="sm"
                        label="Editar despesa"
                        onClick={() => handleOpenModal(expense)}
                      />
                      <IconButton
                        icon={<Trash2 size={16} />}
                        variant="danger"
                        size="sm"
                        label="Deletar despesa"
                        onClick={() => handleDelete(expense.id)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <p className="text-lg font-semibold text-primary">
                      {formatCurrency(expense.amount)}
                    </p>
                  </div>
                </div>
                </Card>
              </AnimatedListItem>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0,00"
            required
          />

          <Input
            label="Data"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Categoria
            </label>
            <Select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              options={categories.map((cat) => ({
                value: cat.id,
                label: cat.name,
              }))}
              required
            />
          </div>

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Almoço, Uber..."
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
            <Button 
              type="submit" 
              fullWidth
              disabled={!formData.category_id}
            >
              {editingExpense ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

