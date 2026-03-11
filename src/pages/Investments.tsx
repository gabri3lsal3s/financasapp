import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import { useInvestments } from '@/hooks/useInvestments'
import { Investment } from '@/types'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { APP_START_DATE, clampMonthToAppStart, formatCurrency, formatMoneyInput, formatMonth, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

export default function Investments() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false)
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
  const { isOnline } = useNetworkStatus()

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

  const handleMonthChange = (month: string) => {
    if (month === currentMonth) return
    setIsMonthTransitioning(true)
    setTimeout(() => {
      setCurrentMonth(month)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('month', month)
        return next
      })
      setTimeout(() => setIsMonthTransitioning(false), 50)
    }, 150)
  }

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
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-page-enter">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />
        <div
          className="transition-all duration-150 ease-in-out"
          style={{
            opacity: isMonthTransitioning ? 0 : 1,
            transform: isMonthTransitioning ? 'translateY(4px)' : 'translateY(0)'
          }}
        >
          {loading && investments.length === 0 ? (
            <Loader text="Carregando investimentos..." className="py-12" />
          ) : investments.length === 0 ? (
            <Card className="text-center py-10 space-y-3">
              <p className="text-secondary">Nenhum investimento no mês selecionado.</p>
              <Button onClick={() => handleOpenModal()}>Adicionar investimento</Button>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-3 lg:gap-4">
              {investments.map((inv, index) => {
                const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
                const staggerClass = index < 5 ? staggerClasses[index] : ''

                return (
                  <Card
                    key={inv.id}
                    onClick={() => handleOpenModal(inv)}
                    className={`flex-1 min-w-full sm:min-w-[calc(50%-1rem)] hover:border-primary transition-colors cursor-pointer p-0 overflow-hidden animate-stagger-item ${staggerClass}`}
                  >
                    <div className="flex bg-primary">
                      <div className="w-1 flex-shrink-0 bg-primary" />
                      <div className="flex-1 p-3.5 flex flex-col justify-center min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-primary truncate flex items-center gap-2">
                              {inv.description || 'Investimento'}
                              {inv.id.startsWith('offline-') && (
                                <span title="Pendente de sincronização" className="flex-shrink-0 flex">
                                  <RefreshCw size={12} className="text-accent animate-spin" />
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[13px] text-secondary truncate">
                              <span className="truncate">Investimento</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <p className="text-base font-bold text-primary leading-tight">
                              {formatCurrency(inv.amount)}
                            </p>
                            <p className="text-xs text-secondary mt-1 uppercase tracking-tight font-medium">
                              {formatMonth(inv.month)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
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

          <ModalActionFooter
            onCancel={handleCloseModal}
            submitLabel={editingInvestment ? 'Salvar alterações' : 'Salvar'}
            deleteLabel={editingInvestment ? 'Excluir investimento' : undefined}
            onDelete={editingInvestment ? handleDeleteFromModal : undefined}
          />
        </form>
      </Modal>
    </div>
  )
}

