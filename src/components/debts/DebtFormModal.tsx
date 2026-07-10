import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Input from '@/components/Input'
import CurrencyInput from '@/components/CurrencyInput'
import Select from '@/components/Select'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import type { Debt } from '@/types'

interface DebtFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (payload: {
    name: string
    type: 'payable' | 'receivable'
    amount: number
    due_date: string
    description: string
    status: 'pending' | 'paid'
  }) => Promise<void>
  editingDebt: Debt | null
  loading: boolean
}

type DebtFormState = {
  name: string
  type: 'payable' | 'receivable'
  amount: number
  due_date: string
  description: string
  status: 'pending' | 'paid'
}

const DEFAULT_DEBT_FORM = (): DebtFormState => ({
  name: '',
  type: 'payable',
  amount: 0,
  due_date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  status: 'pending',
})

export default function DebtFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingDebt,
  loading,
}: DebtFormModalProps) {
  const [form, setForm] = useState<DebtFormState>(DEFAULT_DEBT_FORM())

  useEffect(() => {
    if (isOpen) {
      if (editingDebt) {
        setForm({
          name: editingDebt.name,
          type: editingDebt.type,
          amount: editingDebt.amount,
          due_date: editingDebt.due_date,
          description: editingDebt.description || '',
          status: editingDebt.status,
        })
      } else {
        setForm(DEFAULT_DEBT_FORM())
      }
    }
  }, [editingDebt, isOpen])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.name.trim()) {
      alert('Informe o nome da pendência.')
      return
    }

    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      alert('Informe um valor maior que zero.')
      return
    }

    await onSubmit({
      name: form.name.trim(),
      type: form.type,
      amount: form.amount,
      due_date: form.due_date,
      description: form.description.trim(),
      status: form.status,
    })
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={editingDebt ? 'Editar Pendência' : 'Nova Pendência'}
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={editingDebt ? 'Salvar Alterações' : 'Salvar Lançamento'}
          submitDisabled={loading}
        />
      )}
    >
      <Input
        label="Título/Nome"
        value={form.name}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, name: e.target.value }))
        }
        placeholder="Ex: Empréstimo do João, Conta de Energia..."
        required
      />

      <Select
        label="Tipo"
        value={form.type}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            type: e.target.value as 'payable' | 'receivable',
          }))
        }
        options={[
          {
            value: 'payable',
            label: 'A Pagar (Saída / Pendência de Pagamento)',
          },
          {
            value: 'receivable',
            label: 'A Receber (Entrada / Pendência de Recebimento)',
          },
        ]}
        required
      />

      <CurrencyInput
        label="Valor"
        value={form.amount}
        onChange={(_e, val) =>
          setForm((prev) => ({ ...prev, amount: val }))
        }
        required
      />

      <Input
        label="Data de Vencimento"
        type="date"
        value={form.due_date}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, due_date: e.target.value }))
        }
        required
      />

      <Select
        label="Status Inicial"
        value={form.status}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            status: e.target.value as 'pending' | 'paid',
          }))
        }
        options={[
          { value: 'pending', label: 'Pendente' },
          { value: 'paid', label: 'Pago / Recebido' },
        ]}
        required
      />

      <Input
        label="Descrição/Observação (opcional)"
        value={form.description}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, description: e.target.value }))
        }
        placeholder="Adicione notas adicionais..."
      />
    </ModalForm>
  )
}
