import { useEffect, useState } from 'react'
import Input from '@/components/Input'
import Select from '@/components/Select'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import CardColorField from '@/components/creditCards/CardColorField'
import { CREDIT_CARD_DEFAULT_COLOR } from '@/utils/colorValue'
import type { CreditCard } from '@/types'

interface CardFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (payload: {
    name: string
    brand: string | null
    limit_total: number | null
    closing_day: number
    due_day: number
    color: string | null
    is_active: boolean
  }) => Promise<void>
  editingCard: CreditCard | null
  loading: boolean
  onStartDelete?: () => void
}

type CardFormState = {
  name: string
  brand: string
  limit_total: string
  closing_day: string
  due_day: string
  color: string
  is_active: string
}

const DEFAULT_FORM: CardFormState = {
  name: '',
  brand: '',
  limit_total: '',
  closing_day: '8',
  due_day: '15',
  color: CREDIT_CARD_DEFAULT_COLOR,
  is_active: 'true',
}

export default function CardFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingCard,
  loading,
  onStartDelete,
}: CardFormModalProps) {
  const [form, setForm] = useState<CardFormState>(DEFAULT_FORM)

  useEffect(() => {
    if (isOpen) {
      if (editingCard) {
        setForm({
          name: editingCard.name,
          brand: editingCard.brand || '',
          limit_total: editingCard.limit_total ? String(editingCard.limit_total) : '',
          closing_day: String(editingCard.closing_day),
          due_day: String(editingCard.due_day),
          color: editingCard.color || CREDIT_CARD_DEFAULT_COLOR,
          is_active: editingCard.is_active === false ? 'false' : 'true',
        })
      } else {
        setForm(DEFAULT_FORM)
      }
    }
  }, [editingCard, isOpen])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      alert('Informe o nome do cartão.')
      return
    }

    const closingDay = Number(form.closing_day)
    const dueDay = Number(form.due_day)

    if (!Number.isFinite(closingDay) || closingDay < 1 || closingDay > 31) {
      alert('O dia de fechamento deve estar entre 1 e 31.')
      return
    }
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      alert('O dia de vencimento deve estar entre 1 e 31.')
      return
    }

    const limitTotal = form.limit_total ? Number(form.limit_total) : null
    if (limitTotal !== null && (!Number.isFinite(limitTotal) || limitTotal < 0)) {
      alert('O limite deve ser zero ou maior.')
      return
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      limit_total: limitTotal,
      closing_day: closingDay,
      due_day: dueDay,
      color: form.color || null,
      is_active: form.is_active !== 'false',
    }

    await onSubmit(payload)
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={editingCard ? 'Editar cartão de crédito' : 'Novo cartão de crédito'}
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={editingCard ? 'Salvar alterações' : 'Salvar cartão'}
          submitDisabled={loading}
          onDelete={editingCard ? onStartDelete : undefined}
          deleteLabel="Excluir cartão"
        />
      )}
    >
      <Input
        label="Nome do Cartão"
        value={form.name}
        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        required
      />

      <Input
        label="Bandeira"
        value={form.brand}
        onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
        placeholder="Ex: Visa, Master"
      />

      <Input
        label="Limite total (opcional)"
        type="number"
        min="0"
        step="0.01"
        value={form.limit_total}
        onChange={(event) => setForm((prev) => ({ ...prev, limit_total: event.target.value }))}
      />

      <div className="modal-field-row">
        <Input
          label="Dia de fechamento"
          type="number"
          min="1"
          max="31"
          value={form.closing_day}
          onChange={(event) => setForm((prev) => ({ ...prev, closing_day: event.target.value }))}
          required
        />
        <Input
          label="Dia de vencimento"
          type="number"
          min="1"
          max="31"
          value={form.due_day}
          onChange={(event) => setForm((prev) => ({ ...prev, due_day: event.target.value }))}
          required
        />
      </div>

      <div className="modal-field-row">
        <CardColorField
          value={form.color}
          onChange={(color) => setForm((prev) => ({ ...prev, color }))}
        />
        <Select
          label="Status"
          value={form.is_active}
          onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value }))}
          options={[
            { value: 'true', label: 'Ativo' },
            { value: 'false', label: 'Inativo' },
          ]}
        />
      </div>
    </ModalForm>
  )
}
