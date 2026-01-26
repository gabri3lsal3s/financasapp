import { useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useIncomes } from '@/hooks/useIncomes'
import { Income, IncomeType } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const INCOME_TYPES: { value: IncomeType; label: string }[] = [
  { value: 'salary', label: 'Salário' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'dividends', label: 'Dividendos' },
  { value: 'rent', label: 'Aluguel' },
  { value: 'other', label: 'Outros' },
]

export default function Incomes() {
  const { incomes, loading, createIncome, updateIncome, deleteIncome } = useIncomes()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'salary' as IncomeType,
    description: '',
  })

  const handleOpenModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income)
      setFormData({
        amount: income.amount.toString(),
        date: income.date,
        type: income.type,
        description: income.description || '',
      })
    } else {
      setEditingIncome(null)
      setFormData({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'salary',
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingIncome(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount) return

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const incomeData: Omit<Income, 'id' | 'created_at'> = {
      amount,
      date: formData.date,
      type: formData.type,
      description: formData.description || undefined,
    }

    if (editingIncome) {
      const { error } = await updateIncome(editingIncome.id, incomeData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao atualizar renda: ' + error)
      }
    } else {
      const { error } = await createIncome(incomeData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao criar renda: ' + error)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta renda?')) {
      const { error } = await deleteIncome(id)
      if (error) {
        alert('Erro ao deletar renda: ' + error)
      }
    }
  }

  const getIncomeTypeLabel = (type: IncomeType) => {
    return INCOME_TYPES.find((t) => t.value === type)?.label || type
  }

  return (
    <div>
      <PageHeader
        title="Rendas"
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
        ) : incomes.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-secondary mb-4">Nenhuma renda cadastrada</p>
            <Button onClick={() => handleOpenModal()}>Adicionar primeira renda</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {incomes.map((income) => (
              <Card key={income.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-1 h-6 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: 'var(--color-income)',
                        }}
                      />
                      <p className="font-medium text-primary truncate">
                        {income.description || getIncomeTypeLabel(income.type)}
                      </p>
                    </div>
                    <p className="text-sm text-secondary">
                      {getIncomeTypeLabel(income.type)} • {formatDate(income.date)}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleOpenModal(income)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors"
                      >
                        <Edit2 size={16} className="text-accent-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(income.id)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors"
                      >
                        <Trash2 size={16} style={{ color: 'var(--color-expense)' }} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <p className="text-lg font-semibold text-primary">
                      {formatCurrency(income.amount)}
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
        title={editingIncome ? 'Editar Renda' : 'Nova Renda'}
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

          <Select
            label="Tipo de Renda"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as IncomeType })}
            options={INCOME_TYPES}
            required
          />

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Salário mensal, Projeto X..."
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
              {editingIncome ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

