import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useExpenses } from '@/hooks/useExpenses'
import { useCategories } from '@/hooks/useCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Expense } from '@/types'
import { APP_START_DATE, clampMonthToAppStart, formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

export default function Expenses() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses(currentMonth)
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
    report_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    installment_total: '1',
    category_id: '',
    description: '',
  })
  const [searchParams, setSearchParams] = useSearchParams()

  const handleAmountChange = (nextAmount: string) => {
    setFormData((prev) => {
      const prevAmount = parseMoneyInput(prev.amount)
      const prevReportAmount = parseMoneyInput(prev.report_amount)
      const shouldSyncReportAmount =
        !prev.report_amount ||
        (!Number.isNaN(prevAmount) &&
          !Number.isNaN(prevReportAmount) &&
          Math.abs(prevReportAmount - prevAmount) < 0.009)

      return {
        ...prev,
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : prev.report_amount,
      }
    })
  }

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        amount: formatMoneyInput(expense.amount),
        report_amount: formatMoneyInput(expense.amount * (expense.report_weight ?? 1)),
        date: expense.date,
        installment_total: String(expense.installment_total || 1),
        category_id: expense.category_id,
        description: expense.description || '',
      })
    } else {
      setEditingExpense(null)
      setFormData({
        amount: '',
        report_amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        installment_total: '1',
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
      report_amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      installment_total: '1',
      category_id: categories[0]?.id || '',
      description: '',
    })
  }

  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    const monthParam = searchParams.get('month')
    const isValidMonth = monthParam ? /^\d{4}-\d{2}$/.test(monthParam) : false

    if (isValidMonth && monthParam) {
      const clampedMonth = clampMonthToAppStart(monthParam)
      if (clampedMonth !== currentMonth) {
        setCurrentMonth(clampedMonth)
      }
    }

    if (quickAdd === '1') {
      setEditingExpense(null)
      setFormData({
        amount: '',
        report_amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        installment_total: '1',
        category_id: categories[0]?.id || '',
        description: '',
      })
      setIsModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, categories, currentMonth])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || !formData.category_id) return

    const amount = parseMoneyInput(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount = formData.report_amount ? parseMoneyInput(formData.report_amount) : amount
    if (isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da despesa')
      return
    }

    const reportWeight = amount > 0 ? Number((reportAmount / amount).toFixed(4)) : 1
    const installmentTotal = Math.max(1, Math.min(60, Number(formData.installment_total || '1')))

    if (!Number.isInteger(installmentTotal) || installmentTotal < 1) {
      alert('Informe um número válido de parcelas (mínimo 1).')
      return
    }

    const expenseData: Omit<Expense, 'id' | 'created_at' | 'category'> = {
      amount,
      report_weight: reportWeight,
      date: formData.date,
      installment_total: installmentTotal,
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

  const handleDeleteFromModal = async () => {
    if (!editingExpense) return
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return

    const { error } = await deleteExpense(editingExpense.id)
    if (error) {
      alert('Erro ao excluir despesa: ' + error)
      return
    }

    handleCloseModal()
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.expenses.title}
        subtitle={PAGE_HEADERS.expenses.description}
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
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : expenses.length === 0 ? (
          <Card className="text-center py-10 space-y-3">
            <p className="text-secondary">Nenhuma despesa no mês selecionado.</p>
            <Button onClick={() => handleOpenModal()}>
              Adicionar despesa
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-secondary">Clique em um item para editar ou excluir.</p>
            {expenses.map((expense) => (
                <Card key={expense.id} className="py-3" onClick={() => handleOpenModal(expense)}>
                <div className="flex items-start justify-between gap-3">
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
                    <p className="text-sm text-secondary">
                      {expense.category?.name} • {formatDate(expense.date)}
                      {Number(expense.installment_total || 1) > 1 && (
                        <> • Parcela {expense.installment_number || 1}/{expense.installment_total}</>
                      )}
                    </p>
                  </div>
                  <div className="ml-2 text-right">
                    <p className="text-lg font-semibold text-primary">
                      {formatCurrency(expense.amount)}
                    </p>
                    {Math.abs(expense.amount - (expense.amount * (expense.report_weight ?? 1))) > 0.009 && (
                      <p className="text-xs text-secondary">
                        {formatCurrency(expense.amount * (expense.report_weight ?? 1))}
                      </p>
                    )}
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
        title={editingExpense ? 'Editar despesa' : 'Adicionar despesa'}
      >
        <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-4">
          <Input
            label="Valor"
            type="text"
            inputMode="decimal"
            value={formData.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            onBlur={() => {
              const parsed = parseMoneyInput(formData.amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                handleAmountChange(formatMoneyInput(parsed))
              }
            }}
            placeholder="0,00"
            required
          />

          <Input
            label="Valor no relatório (opcional)"
            type="text"
            inputMode="decimal"
            value={formData.report_amount}
            onChange={(e) => setFormData({ ...formData, report_amount: e.target.value })}
            onBlur={() => {
              if (!formData.report_amount) return
              const parsed = parseMoneyInput(formData.report_amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                setFormData({ ...formData, report_amount: formatMoneyInput(parsed) })
              }
            }}
            placeholder="Se vazio, usa o valor total"
          />

          <Input
            label="Data"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            min={APP_START_DATE}
            required
          />

          {!editingExpense && (
            <Input
              label="Parcelas"
              type="number"
              min="1"
              max="60"
              value={formData.installment_total}
              onChange={(e) => setFormData({ ...formData, installment_total: e.target.value })}
              placeholder="1"
            />
          )}

          {editingExpense && Number(editingExpense.installment_total || 1) > 1 && (
            <p className="text-xs text-secondary">
              Esta despesa pertence ao parcelamento {editingExpense.installment_number || 1}/{editingExpense.installment_total}. A edição afeta apenas esta parcela.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
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
            <Button type="button" variant="outline" fullWidth onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth disabled={!formData.category_id}>
              {editingExpense ? 'Salvar alterações' : 'Salvar'}
            </Button>
          </div>

          {editingExpense && (
            <Button type="button" variant="danger" fullWidth onClick={handleDeleteFromModal}>
              Excluir despesa
            </Button>
          )}
        </form>
      </Modal>
    </div>
  )
}

