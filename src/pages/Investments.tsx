import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import { useInvestments } from '@/hooks/useInvestments'
import { Investment } from '@/types'
import { APP_START_DATE, clampMonthToAppStart, formatCurrency, formatMoneyInput, formatMonth, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

export default function Investments() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const { investments, loading, createInvestment, updateInvestment, deleteInvestment } = useInvestments(currentMonth)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    month: getCurrentMonthString(),
    description: '',
  })
  const [searchParams, setSearchParams] = useSearchParams()

  const handleAmountChange = (nextAmount: string) => {
    setFormData((prev) => ({ ...prev, amount: nextAmount }))
  }

  const handleOpenModal = (investment?: Investment) => {
    if (investment) {
      setEditingInvestment(investment)
      setFormData({
        amount: formatMoneyInput(investment.amount),
        date: `${investment.month}-01`,
        month: investment.month,
        description: investment.description || '',
      })
    } else {
      setEditingInvestment(null)
      setFormData({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        month: currentMonth,
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingInvestment(null)
  }

  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    const monthParam = searchParams.get('month')
    const isValidMonth = monthParam ? /^\d{4}-\d{2}$/.test(monthParam) : false
    const targetMonth = isValidMonth && monthParam
      ? clampMonthToAppStart(monthParam)
      : currentMonth

    if (isValidMonth && monthParam && targetMonth !== currentMonth) {
      setCurrentMonth(targetMonth)
    }

    if (quickAdd === '1') {
      setEditingInvestment(null)
      setFormData({
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        month: targetMonth,
        description: '',
      })
      setIsModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, currentMonth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount) return

    const amount = parseMoneyInput(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const selectedDate = formData.date || format(new Date(), 'yyyy-MM-dd')
    const selectedMonth = selectedDate.substring(0, 7)

    const investmentData: Omit<Investment, 'id' | 'created_at'> = {
      amount,
      month: selectedMonth,
      description: formData.description || undefined,
    }

    if (editingInvestment) {
      const { error } = await updateInvestment(editingInvestment.id, investmentData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao atualizar investimento: ' + error)
      }
    } else {
      const { error } = await createInvestment(investmentData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao criar investimento: ' + error)
      }
    }
  }

  const handleDeleteFromModal = async () => {
    if (!editingInvestment) return
    if (!confirm('Tem certeza que deseja excluir este investimento?')) return

    const { error } = await deleteInvestment(editingInvestment.id)
    if (error) {
      alert('Erro ao excluir investimento: ' + error)
      return
    }

    handleCloseModal()
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.investments.title}
        subtitle={PAGE_HEADERS.investments.description}
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
        ) : investments.length === 0 ? (
          <Card className="text-center py-10 space-y-3">
            <p className="text-secondary">Nenhum investimento no mês selecionado.</p>
            <Button onClick={() => handleOpenModal()}>Adicionar investimento</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-secondary">Clique em um item para editar ou excluir.</p>
            {investments.map((investment) => (
                  <Card key={investment.id} className="py-3" onClick={() => handleOpenModal(investment)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: 'var(--color-balance)',
                          }}
                        />
                        <p className="font-medium text-primary truncate">
                          {investment.description || 'Investimento'}
                        </p>
                      </div>
                      <p className="text-sm text-secondary">
                        {formatMonth(investment.month)}
                      </p>
                    </div>
                    <div className="ml-2 text-right">
                      <p className="text-lg font-semibold text-primary">
                        {formatCurrency(investment.amount)}
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
        title={editingInvestment ? 'Editar investimento' : 'Adicionar investimento'}
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
            label="Data"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            min={APP_START_DATE}
            required
          />

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Reserva de emergência, Ações..."
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" fullWidth onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              {editingInvestment ? 'Salvar alterações' : 'Salvar'}
            </Button>
          </div>

          {editingInvestment && (
            <Button type="button" variant="danger" fullWidth onClick={handleDeleteFromModal}>
              Excluir investimento
            </Button>
          )}
        </form>
      </Modal>
    </div>
  )
}

