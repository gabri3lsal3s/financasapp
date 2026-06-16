import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/Modal'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ConfirmModal from '@/components/ConfirmModal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Button from '@/components/Button'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Income, IncomeCategory } from '@/types'
import {
  APP_START_DATE,
  formatCurrency,
  formatDate,
  formatMoneyInput,
  parseMoneyInput,
  roundToDecimals,
} from '@/utils/format'

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'
const REFUND_NOTE_PREFIX = '[REFUND]'

interface IncomeFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingIncome: Income | null
  incomeCategories: IncomeCategory[]
  onCreate: (
    income: Omit<Income, 'id' | 'created_at' | 'income_category' | 'type'>
  ) => Promise<{ data: Income | null; error: string | null }>
  onUpdate: (
    id: string,
    updates: Partial<Income>
  ) => Promise<{ data: Income | null; error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
}

export default function IncomeFormModal({
  isOpen,
  onClose,
  editingIncome,
  incomeCategories,
  onCreate,
  onUpdate,
  onDelete,
}: IncomeFormModalProps) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    amount: '',
    report_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    income_category_id: '',
    description: '',
  })

  const [refundOriginLoading, setRefundOriginLoading] = useState(false)
  const [refundOrigin, setRefundOrigin] = useState<{
    cardId: string
    cardName: string
    competence: string
  } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isRefundIncome = (income: Income | null) =>
    [REFUND_INCOME_CATEGORY_NAME, LEGACY_REFUND_INCOME_CATEGORY_NAME].includes(
      String(income?.income_category?.name || '').trim()
    )

  const loadRefundOrigin = async (incomeId: string) => {
    try {
      setRefundOriginLoading(true)
      setRefundOrigin(null)

      const likePattern = `${REFUND_NOTE_PREFIX}%"incomeId":"${String(incomeId)}"%`

      const { data: paymentRow, error: paymentError } = await supabase
        .from('credit_card_bill_payments')
        .select('credit_card_id, bill_competence, payment_date')
        .like('note', likePattern)
        .order('payment_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (paymentError || !paymentRow?.credit_card_id) {
        return
      }

      const { data: cardRow } = await supabase
        .from('credit_cards')
        .select('name')
        .eq('id', String(paymentRow.credit_card_id))
        .maybeSingle()

      setRefundOrigin({
        cardId: String(paymentRow.credit_card_id),
        cardName: String(cardRow?.name || 'Cartão'),
        competence: String(paymentRow.bill_competence || ''),
      })
    } catch (e) {
      console.error('Erro ao buscar origem do estorno:', e)
    } finally {
      setRefundOriginLoading(false)
    }
  }

  // Sincronizar dados ao abrir
  useEffect(() => {
    if (isOpen) {
      if (editingIncome) {
        setFormData({
          amount: formatMoneyInput(editingIncome.amount),
          report_amount: formatMoneyInput(
            editingIncome.amount * (editingIncome.report_weight ?? 1)
          ),
          date: editingIncome.date,
          income_category_id: editingIncome.income_category_id,
          description: editingIncome.description || '',
        })

        if (isRefundIncome(editingIncome)) {
          void loadRefundOrigin(editingIncome.id)
        } else {
          setRefundOrigin(null)
          setRefundOriginLoading(false)
        }
      } else {
        setFormData({
          amount: '',
          report_amount: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          income_category_id: incomeCategories[0]?.id || '',
          description: '',
        })
        setRefundOrigin(null)
        setRefundOriginLoading(false)
      }
    }
  }, [isOpen, editingIncome, incomeCategories])

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

  const incomeCategoriesForManualCreation = incomeCategories.filter(
    (category) =>
      String(category.name || '').trim().toLowerCase() !==
      REFUND_INCOME_CATEGORY_NAME.toLowerCase()
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingIncome && isRefundIncome(editingIncome)) {
      alert('Estornos devem ser editados pela tela de Cartões.')
      return
    }

    if (!formData.amount || !formData.income_category_id) {
      alert('Por favor, preencha todos os campos obrigatórios')
      return
    }

    if (!editingIncome) {
      const selectedCategory = incomeCategories.find(
        (category) => category.id === formData.income_category_id
      )
      const selectedCategoryName = String(selectedCategory?.name || '').trim()
      if (
        [REFUND_INCOME_CATEGORY_NAME, LEGACY_REFUND_INCOME_CATEGORY_NAME].includes(
          selectedCategoryName
        )
      ) {
        alert(
          'A categoria Estorno é reservada para lançamentos automáticos de estorno no cartão.'
        )
        return
      }
    }

    const amount = parseMoneyInput(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount = formData.report_amount
      ? parseMoneyInput(formData.report_amount)
      : amount
    if (isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da renda')
      return
    }

    const reportWeight =
      amount > 0 ? roundToDecimals(reportAmount / amount, 4) : 1

    const incomeData: Omit<
      Income,
      'id' | 'created_at' | 'income_category' | 'type'
    > = {
      amount,
      report_weight: reportWeight,
      date: formData.date,
      income_category_id: formData.income_category_id,
      ...(formData.description && { description: formData.description }),
    }

    if (editingIncome) {
      const { error } = await onUpdate(editingIncome.id, incomeData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao atualizar renda: ' + error)
      }
    } else {
      const { error } = await onCreate(incomeData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao criar renda: ' + error)
      }
    }
  }

  const handleDeleteFromModal = () => {
    if (!editingIncome) return

    if (isRefundIncome(editingIncome)) {
      alert('Estornos devem ser excluídos pela tela de Cartões.')
      return
    }

    setShowDeleteConfirm(true)
  }

  const confirmDeleteIncome = async () => {
    if (!editingIncome) return

    const { error } = await onDelete(editingIncome.id)
    if (error) {
      alert('Erro ao excluir renda: ' + error)
      return
    }

    setShowDeleteConfirm(false)
    onClose()
  }

  const showRefund = editingIncome && isRefundIncome(editingIncome)

  if (showRefund) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Estorno (somente visualização)"
      >
        <div className="modal-form-stack w-full">
          <div className="modal-panel-glass space-y-2 p-3">
            <p className="text-xs text-secondary">Valor</p>
            <p className="text-base font-semibold text-primary">
              {formatCurrency(editingIncome!.amount)}
            </p>
            <p className="text-xs text-secondary">Data: {formatDate(editingIncome!.date)}</p>
            <p className="text-xs text-secondary">
              Categoria:{' '}
              {editingIncome!.income_category?.name || REFUND_INCOME_CATEGORY_NAME}
            </p>
            <p className="text-xs text-secondary">
              Descrição: {editingIncome!.description || 'Estorno de compra'}
            </p>
          </div>

          <div className="modal-panel-glass space-y-2 p-3">
            {refundOriginLoading ? (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Loader2 size={16} className="animate-spin" />
                <span>Carregando origem do estorno...</span>
              </div>
            ) : refundOrigin ? (
              <>
                <p className="text-sm text-primary">
                  Este estorno foi criado no cartão <strong>{refundOrigin.cardName}</strong> na
                  fatura <strong>{refundOrigin.competence}</strong>.
                </p>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => {
                    navigate(
                      `/contas?month=${encodeURIComponent(
                        refundOrigin.competence
                      )}&card=${encodeURIComponent(refundOrigin.cardId)}`
                    )
                    onClose()
                  }}
                >
                  Ir para fatura no cartão
                </Button>
              </>
            ) : (
              <p className="text-sm text-secondary">
                Não foi possível identificar a fatura/cartão de origem deste estorno.
              </p>
            )}
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <>
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={editingIncome ? 'Editar renda' : 'Adicionar renda'}
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={editingIncome ? 'Salvar alterações' : 'Salvar'}
          deleteLabel={editingIncome ? 'Excluir renda' : undefined}
          onDelete={editingIncome ? handleDeleteFromModal : undefined}
        />
      )}
    >
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
            onChange={(e) =>
              setFormData({ ...formData, report_amount: e.target.value })
            }
            onBlur={() => {
              if (!formData.report_amount) return
              const parsed = parseMoneyInput(formData.report_amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                setFormData({
                  ...formData,
                  report_amount: formatMoneyInput(parsed),
                })
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
            onChange={(e) =>
              setFormData({ ...formData, income_category_id: e.target.value })
            }
            options={(editingIncome ? incomeCategories : incomeCategoriesForManualCreation).map(
              (cat) => ({
                value: cat.id,
                label: cat.name,
              })
            )}
            required
          />

          {!editingIncome && (
            <p className="text-xs text-secondary">
              A categoria Estorno é criada/gerenciada automaticamente pela tela de
              cartões.
            </p>
          )}

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Salário mensal, Projeto X..."
          />

    </ModalForm>

    <ConfirmModal
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      title="Excluir renda"
      confirmLabel="Excluir renda"
      confirmVariant="danger"
      requireCheckbox={true}
      checkboxLabel="Estou ciente de que esta renda será excluída permanentemente."
      onConfirm={() => void confirmDeleteIncome()}
    >
      <p className="text-sm text-primary">Tem certeza que deseja excluir esta renda?</p>
    </ConfirmModal>
    </>
  )
}
