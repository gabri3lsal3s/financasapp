import { useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useIncomes } from '@/hooks/useIncomes'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Income } from '@/types'
import { formatCurrency, formatDate, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import MonthSelector from '@/components/MonthSelector'
import { LIST_ITEM_EXIT_MS } from '@/constants/animation'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import AnimatedListItem from '@/components/AnimatedListItem'

export default function Incomes() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const { incomes, loading, createIncome, updateIncome, deleteIncome } = useIncomes(currentMonth)
  const { incomeCategories } = useIncomeCategories()
  const { colorPalette } = usePaletteColors()
  const assignedIncomeCategories = assignUniquePaletteColors(incomeCategories, colorPalette)
  const incomeCategoryColorMap: Record<string, string> = {}
  incomeCategories.forEach((c, i) => {
    if (c && c.id) incomeCategoryColorMap[c.id] = assignedIncomeCategories[i] || getCategoryColorForPalette(c.color, colorPalette)
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    income_category_id: '',
    description: '',
  })

  const [removingIds, setRemovingIds] = useState<string[]>([])

  const handleOpenModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income)
      setFormData({
        amount: income.amount.toString(),
        date: income.date,
        income_category_id: income.income_category_id,
        description: income.description || '',
      })
    } else {
      setEditingIncome(null)
      setFormData({
        amount: '',
        date: `${currentMonth}-01`,
        income_category_id: incomeCategories[0]?.id || '',
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingIncome(null)
    setFormData({
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      income_category_id: incomeCategories[0]?.id || '',
      description: '',
    })
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || !formData.income_category_id) {
      alert('Por favor, preencha todos os campos obrigatórios')
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const incomeData: Omit<Income, 'id' | 'created_at' | 'income_category' | 'type'> = {
      amount,
      date: formData.date,
      income_category_id: formData.income_category_id,
      ...(formData.description && { description: formData.description }),
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
    if (!confirm('Tem certeza que deseja excluir esta renda?')) return

    setRemovingIds((s) => [...s, id])

    setTimeout(async () => {
      const { error } = await deleteIncome(id)
      if (error) {
        alert('Erro ao deletar renda: ' + error)
      }
      setRemovingIds((s) => s.filter((x) => x !== id))
    }, LIST_ITEM_EXIT_MS)
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.incomes.title}
        subtitle={PAGE_HEADERS.incomes.description}
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
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
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
              <AnimatedListItem key={income.id} isRemoving={removingIds.includes(income.id)}>
                <Card>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: income.income_category?.id ? (incomeCategoryColorMap[income.income_category.id] || getCategoryColorForPalette(income.income_category.color, colorPalette)) : 'var(--color-income)' }}
                        />
                        <p className="font-medium text-[var(--color-text-primary)] truncate">
                          {income.description || income.income_category?.name}
                        </p>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {income.income_category?.name} • {formatDate(income.date)}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <IconButton
                          icon={<Edit2 size={16} />}
                          variant="neutral"
                          size="sm"
                          label="Editar renda"
                          onClick={() => handleOpenModal(income)}
                        />
                        <IconButton
                          icon={<Trash2 size={16} />}
                          variant="danger"
                          size="sm"
                          label="Deletar renda"
                          onClick={() => handleDelete(income.id)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <p className="text-lg font-semibold text-primary">
                        {formatCurrency(income.amount)}
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
            label="Categoria de Renda"
            value={formData.income_category_id}
            onChange={(e) => setFormData({ ...formData, income_category_id: e.target.value })}
            options={incomeCategories.map((cat) => ({
              value: cat.id,
              label: cat.name,
            }))}
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


