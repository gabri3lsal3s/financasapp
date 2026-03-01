import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useIncomes } from '@/hooks/useIncomes'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { Income } from '@/types'
import { APP_START_DATE, clampMonthToAppStart, formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

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
    report_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    income_category_id: '',
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

  const handleOpenModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income)
      setFormData({
        amount: formatMoneyInput(income.amount),
        report_amount: formatMoneyInput(income.amount * (income.report_weight ?? 1)),
        date: income.date,
        income_category_id: income.income_category_id,
        description: income.description || '',
      })
    } else {
      setEditingIncome(null)
      setFormData({
        amount: '',
        report_amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
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
      report_amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      income_category_id: incomeCategories[0]?.id || '',
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
      setEditingIncome(null)
      setFormData({
        amount: '',
        report_amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        income_category_id: incomeCategories[0]?.id || '',
        description: '',
      })
      setIsModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, incomeCategories, currentMonth])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || !formData.income_category_id) {
      alert('Por favor, preencha todos os campos obrigatórios')
      return
    }

    const amount = parseMoneyInput(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount = formData.report_amount ? parseMoneyInput(formData.report_amount) : amount
    if (isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da renda')
      return
    }

    const reportWeight = amount > 0 ? Number((reportAmount / amount).toFixed(4)) : 1

    const incomeData: Omit<Income, 'id' | 'created_at' | 'income_category' | 'type'> = {
      amount,
      report_weight: reportWeight,
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

  const handleDeleteFromModal = async () => {
    if (!editingIncome) return
    if (!confirm('Tem certeza que deseja excluir esta renda?')) return

    const { error } = await deleteIncome(editingIncome.id)
    if (error) {
      alert('Erro ao excluir renda: ' + error)
      return
    }

    handleCloseModal()
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
            Adicionar
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : incomes.length === 0 ? (
          <Card className="text-center py-10 space-y-3">
            <p className="text-secondary">Nenhuma renda no mês selecionado.</p>
            <Button onClick={() => handleOpenModal()}>Adicionar renda</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-secondary">Clique em um item para editar ou excluir.</p>
            {incomes.map((income) => (
                <Card key={income.id} className="py-3" onClick={() => handleOpenModal(income)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: income.income_category?.id ? (incomeCategoryColorMap[income.income_category.id] || getCategoryColorForPalette(income.income_category.color, colorPalette)) : 'var(--color-income)' }}
                        />
                        <p className="font-medium text-primary truncate">
                          {income.description || income.income_category?.name}
                        </p>
                      </div>
                      <p className="text-sm text-secondary">
                        {income.income_category?.name} • {formatDate(income.date)}
                      </p>
                    </div>
                    <div className="ml-2 text-right">
                      <p className="text-lg font-semibold text-primary">
                        {formatCurrency(income.amount)}
                      </p>
                      {Math.abs(income.amount - (income.amount * (income.report_weight ?? 1))) > 0.009 && (
                        <p className="text-xs text-secondary">
                          {formatCurrency(income.amount * (income.report_weight ?? 1))}
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
        title={editingIncome ? 'Editar renda' : 'Adicionar renda'}
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
            <Button type="button" variant="outline" fullWidth onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              {editingIncome ? 'Salvar alterações' : 'Salvar'}
            </Button>
          </div>

          {editingIncome && (
            <Button type="button" variant="danger" fullWidth onClick={handleDeleteFromModal}>
              Excluir renda
            </Button>
          )}
        </form>
      </Modal>
    </div>
  )
}


