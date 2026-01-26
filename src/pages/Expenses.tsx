import { useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import CategoryColorBar from '@/components/CategoryColorBar'
import { useExpenses } from '@/hooks/useExpenses'
import { useCategories } from '@/hooks/useCategories'
import { Expense, Category } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#6b7280', '#374151', '#1f2937',
]

export default function Expenses() {
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses()
  const { categories, createCategory } = useCategories()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryData, setNewCategoryData] = useState({ name: '' })
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
    description: '',
    is_fixed: false,
    is_recurring: false,
    installments: '',
  })

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        amount: expense.amount.toString(),
        date: expense.date,
        category_id: expense.category_id,
        description: expense.description || '',
        is_fixed: expense.is_fixed,
        is_recurring: expense.is_recurring,
        installments: expense.installments?.toString() || '',
      })
    } else {
      setEditingExpense(null)
      setFormData({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        category_id: categories[0]?.id || '',
        description: '',
        is_fixed: false,
        is_recurring: false,
        installments: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
    setShowNewCategory(false)
    setNewCategoryData({ name: '' })
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!newCategoryData.name.trim()) return

    // Gerar cor aleatória para a categoria
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)]
    const categoryData = { ...newCategoryData, color: randomColor }

    const { data, error } = await createCategory(categoryData as Omit<Category, 'id' | 'created_at'>)
    if (!error && data) {
      setFormData({ ...formData, category_id: data.id })
      setShowNewCategory(false)
      setNewCategoryData({ name: '' })
    } else {
      alert('Erro ao criar categoria: ' + (error || 'Erro desconhecido'))
    }
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
      description: formData.description || undefined,
      is_fixed: formData.is_fixed,
      is_recurring: formData.is_recurring,
      installments: formData.installments ? parseInt(formData.installments) : undefined,
    }

    if (expenseData.installments && (isNaN(expenseData.installments) || expenseData.installments < 1)) {
      alert('O número de parcelas deve ser maior que zero')
      return
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

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
      const { error } = await deleteExpense(id)
      if (error) {
        alert('Erro ao deletar despesa: ' + error)
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Despesas"
        action={
          <Button
            size="sm"
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
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : expenses.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-secondary mb-4">Nenhuma despesa cadastrada</p>
            <Button onClick={() => handleOpenModal()}>
              Adicionar primeira despesa
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <Card key={expense.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CategoryColorBar color={expense.category?.color || 'var(--color-primary)'} />
                      <p className="font-medium text-primary truncate">
                        {expense.description || expense.category?.name || 'Sem descrição'}
                      </p>
                    </div>
                    <p className="text-sm text-secondary">
                      {expense.category?.name} • {formatDate(expense.date)}
                    </p>
                    {expense.installments && (
                      <p className="text-xs text-secondary mt-1">
                        Parcela {expense.current_installment}/{expense.installments}
                      </p>
                    )}
                    {(expense.is_fixed || expense.is_recurring) && (
                      <div className="flex gap-2 mt-2">
                        {expense.is_fixed && (
                          <span className="text-xs px-2 py-0.5 bg-accent-primary text-white rounded">
                            Fixa
                          </span>
                        )}
                        {expense.is_recurring && (
                          <span className="text-xs px-2 py-0.5" style={{ backgroundColor: 'var(--color-income)', color: 'white' }}>
                            Recorrente
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleOpenModal(expense)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors"
                      >
                        <Edit2 size={16} className="text-accent-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors"
                      >
                        <Trash2 size={16} style={{ color: 'var(--color-expense)' }} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <p className="text-lg font-semibold text-primary">
                      {formatCurrency(expense.amount)}
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-primary">
                Categoria
              </label>
              {!showNewCategory && (
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="text-xs hover:text-accent-primary flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} />
                  Nova categoria
                </button>
              )}
            </div>

            {showNewCategory ? (
              <div className="space-y-3 p-3 bg-secondary rounded-lg border border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">Criar nova categoria</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategory(false)
                      setNewCategoryData({ name: '', color: COLORS[0] })
                    }}
                    className="text-xs text-secondary hover:text-primary transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
                <form onSubmit={handleCreateCategory} className="space-y-3">
                  <Input
                    label="Nome da Categoria"
                    value={newCategoryData.name}
                    onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                    placeholder="Ex: Alimentação, Transporte..."
                    required
                  />
                  <Button type="submit" size="sm" fullWidth>
                    Criar Categoria
                  </Button>
                </form>
              </div>
            ) : (
              <Select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                options={categories.map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                }))}
                required
              />
            )}
          </div>

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Almoço, Uber..."
          />

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_fixed}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    is_fixed: e.target.checked,
                    installments: e.target.checked ? formData.installments : '',
                  })
                }}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Despesa fixa</span>
            </label>

            {formData.is_fixed && (
              <Input
                label="Número de parcelas (opcional)"
                type="number"
                min="1"
                value={formData.installments}
                onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                placeholder="Ex: 12"
              />
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Despesa recorrente (mensal)</span>
            </label>
          </div>

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
              disabled={!formData.category_id || showNewCategory}
            >
              {editingExpense ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

