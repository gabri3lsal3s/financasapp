import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import { Investment } from '@/types'
import {
  APP_START_DATE,
  formatMoneyInput,
  parseMoneyInput,
} from '@/utils/format'

interface InvestmentFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingInvestment: Investment | null
  defaultMonth: string
  onCreate: (
    investment: Omit<Investment, 'id' | 'created_at'>
  ) => Promise<{ data: Investment | null; error: string | null }>
  onUpdate: (
    id: string,
    updates: Partial<Investment>
  ) => Promise<{ data: Investment | null; error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
}

export default function InvestmentFormModal({
  isOpen,
  onClose,
  editingInvestment,
  defaultMonth,
  onCreate,
  onUpdate,
  onDelete,
}: InvestmentFormModalProps) {
  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    month: defaultMonth,
    description: '',
  })

  // Sincronizar dados do formulário quando abre para edição ou novo
  useEffect(() => {
    if (isOpen) {
      if (editingInvestment) {
        setFormData({
          amount: formatMoneyInput(editingInvestment.amount),
          date: `${editingInvestment.month}-01`,
          month: editingInvestment.month,
          description: editingInvestment.description || '',
        })
      } else {
        setFormData({
          amount: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          month: defaultMonth,
          description: '',
        })
      }
    }
  }, [isOpen, editingInvestment, defaultMonth])

  const handleAmountChange = (nextAmount: string) => {
    setFormData((prev) => ({ ...prev, amount: nextAmount }))
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
      const { error } = await onUpdate(editingInvestment.id, investmentData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao atualizar investimento: ' + error)
      }
    } else {
      const { error } = await onCreate(investmentData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao criar investimento: ' + error)
      }
    }
  }

  const handleDeleteFromModal = async () => {
    if (!editingInvestment) return
    if (!confirm('Tem certeza que deseja excluir este investimento?')) return

    const { error } = await onDelete(editingInvestment.id)
    if (error) {
      alert('Erro ao excluir investimento: ' + error)
      return
    }

    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
          onCancel={onClose}
          submitLabel={editingInvestment ? 'Salvar alterações' : 'Salvar'}
          deleteLabel={editingInvestment ? 'Excluir investimento' : undefined}
          onDelete={editingInvestment ? handleDeleteFromModal : undefined}
        />
      </form>
    </Modal>
  )
}
