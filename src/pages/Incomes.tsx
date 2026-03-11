import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useIncomes } from '@/hooks/useIncomes'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { supabase } from '@/lib/supabase'
import { Income } from '@/types'
import { APP_START_DATE, clampMonthToAppStart, formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import MonthSelector from '@/components/MonthSelector'
import CategoryBadge from '@/components/CategoryBadge'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, RefreshCw } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'
const REFUND_NOTE_PREFIX = '[REFUND]'

export default function Incomes() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false)
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
  const { isOnline } = useNetworkStatus()
  const [refundOriginLoading, setRefundOriginLoading] = useState(false)
  const [refundOrigin, setRefundOrigin] = useState<{ cardId: string; cardName: string; competence: string } | null>(null)

  const isRefundIncome = (income: Income | null) =>
    [REFUND_INCOME_CATEGORY_NAME, LEGACY_REFUND_INCOME_CATEGORY_NAME].includes(
      String(income?.income_category?.name || '').trim(),
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
    } finally {
      setRefundOriginLoading(false)
    }
  }

  // Limpeza automática de rendas de estorno sem par no cartão
  // Executa silenciosamente uma vez por sessão do navegador
  useEffect(() => {
    const SESSION_KEY = 'refund-orphan-cleanup-done'
    if (sessionStorage.getItem(SESSION_KEY)) return

    const runCleanup = async () => {
      try {
        // Buscar todas as rendas nas categorias de estorno
        const refundCategoryIds = incomeCategories
          .filter((c) =>
            [REFUND_INCOME_CATEGORY_NAME.toLowerCase(), LEGACY_REFUND_INCOME_CATEGORY_NAME.toLowerCase()].includes(
              String(c.name || '').trim().toLowerCase()
            )
          )
          .map((c) => c.id)

        if (!refundCategoryIds.length) return

        const { data: refundIncomes } = await supabase
          .from('incomes')
          .select('id')
          .in('income_category_id', refundCategoryIds)

        if (!refundIncomes?.length) return

        for (const income of refundIncomes) {
          const likePattern = `${REFUND_NOTE_PREFIX}%"incomeId":"${String(income.id)}"%`
          const { data: linkedPayment } = await supabase
            .from('credit_card_bill_payments')
            .select('id')
            .like('note', likePattern)
            .maybeSingle()

          if (!linkedPayment) {
            // Renda de estorno sem pagamento vinculado — excluir silenciosamente
            await supabase.from('incomes').delete().eq('id', income.id)
          }
        }

        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Ignora erros silenciosamente — limpeza será tentada na próxima sessão
      }
    }

    void runCleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeCategories.length])

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

  const incomeCategoriesForManualCreation = incomeCategories.filter(
    (category) => String(category.name || '').trim().toLowerCase() !== REFUND_INCOME_CATEGORY_NAME.toLowerCase(),
  )

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

      if (isRefundIncome(income)) {
        void loadRefundOrigin(income.id)
      } else {
        setRefundOrigin(null)
        setRefundOriginLoading(false)
      }
    } else {
      setEditingIncome(null)
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
    setRefundOrigin(null)
    setRefundOriginLoading(false)
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

    if (editingIncome && isRefundIncome(editingIncome)) {
      alert('Estornos devem ser editados pela tela de Cartões.')
      return
    }

    if (!formData.amount || !formData.income_category_id) {
      alert('Por favor, preencha todos os campos obrigatórios')
      return
    }

    if (!editingIncome) {
      const selectedCategory = incomeCategories.find((category) => category.id === formData.income_category_id)
      const selectedCategoryName = String(selectedCategory?.name || '').trim()
      if ([REFUND_INCOME_CATEGORY_NAME, LEGACY_REFUND_INCOME_CATEGORY_NAME].includes(selectedCategoryName)) {
        alert('A categoria Estorno é reservada para lançamentos automáticos de estorno no cartão.')
        return
      }
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

    if (isRefundIncome(editingIncome)) {
      alert('Estornos devem ser excluídos pela tela de Cartões.')
      return
    }

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
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        }
      />

      <div className="p-4 lg:p-6">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />
        <div
          className="transition-all duration-150 ease-in-out"
          style={{
            opacity: isMonthTransitioning ? 0 : 1,
            transform: isMonthTransitioning ? 'translateY(4px)' : 'translateY(0)'
          }}
        >
          {loading && incomes.length === 0 ? (
            <div className="text-center py-8 text-secondary">Carregando...</div>
          ) : incomes.length === 0 ? (
            <Card className="text-center py-10 space-y-3">
              <p className="text-secondary">Nenhuma renda no mês selecionado.</p>
              <div className="flex justify-center">
                <Button onClick={() => handleOpenModal()}>Adicionar renda</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {incomes.map((income) => (
                <Card key={income.id} className="py-3" onClick={() => handleOpenModal(income)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-1 h-6 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: income.income_category?.id ? (incomeCategoryColorMap[income.income_category.id] || getCategoryColorForPalette(income.income_category.color, colorPalette)) : 'var(--color-income)' }}
                        />
                        <p className="font-medium text-primary truncate flex items-center gap-2">
                          {income.description || income.income_category?.name}
                          {income.id.startsWith('offline-') && (
                            <span title="Pendente de sincronização" className="flex-shrink-0 flex">
                              <RefreshCw size={12} className="text-accent animate-spin" />
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm text-secondary">
                        {income.income_category?.name} • {formatDate(income.date)}
                      </p>
                      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                        <CategoryBadge
                          label={income.income_category?.name || 'Sem categoria'}
                          color={income.income_category?.id
                            ? (incomeCategoryColorMap[income.income_category.id] || getCategoryColorForPalette(income.income_category.color, colorPalette))
                            : 'var(--color-income)'}
                        />
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 text-right">
                      <p className="text-base sm:text-lg font-semibold text-primary">
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
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingIncome
          ? (isRefundIncome(editingIncome) ? 'Estorno (somente visualização)' : 'Editar renda')
          : 'Adicionar renda'}
      >
        {editingIncome && isRefundIncome(editingIncome) ? (
          <div className="w-full max-w-md mx-auto space-y-4">
            <div className="rounded-lg border border-primary bg-secondary p-3 space-y-2">
              <p className="text-xs text-secondary">Valor</p>
              <p className="text-base font-semibold text-primary">{formatCurrency(editingIncome.amount)}</p>
              <p className="text-xs text-secondary">Data: {formatDate(editingIncome.date)}</p>
              <p className="text-xs text-secondary">Categoria: {editingIncome.income_category?.name || REFUND_INCOME_CATEGORY_NAME}</p>
              <p className="text-xs text-secondary">Descrição: {editingIncome.description || 'Estorno de compra'}</p>
            </div>

            <div className="rounded-lg border border-primary bg-secondary p-3 space-y-2">
              {refundOriginLoading ? (
                <p className="text-sm text-secondary">Carregando origem do estorno...</p>
              ) : refundOrigin ? (
                <>
                  <p className="text-sm text-primary">
                    Este estorno foi criado no cartão <strong>{refundOrigin.cardName}</strong> na fatura <strong>{refundOrigin.competence}</strong>.
                  </p>
                  <Button
                    type="button"
                    fullWidth
                    onClick={() => {
                      navigate(`/credit-cards?month=${encodeURIComponent(refundOrigin.competence)}&card=${encodeURIComponent(refundOrigin.cardId)}`)
                      handleCloseModal()
                    }}
                  >
                    Ir para fatura no cartão
                  </Button>
                </>
              ) : (
                <p className="text-sm text-secondary">Não foi possível identificar a fatura/cartão de origem deste estorno.</p>
              )}
            </div>
          </div>
        ) : (
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
              options={(editingIncome ? incomeCategories : incomeCategoriesForManualCreation).map((cat) => ({
                value: cat.id,
                label: cat.name,
              }))}
              required
            />

            {!editingIncome && (
              <p className="text-xs text-secondary">A categoria Estorno é criada/gerenciada automaticamente pela tela de cartões.</p>
            )}

            <Input
              label="Descrição (opcional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Salário mensal, Projeto X..."
            />

            <ModalActionFooter
              onCancel={handleCloseModal}
              submitLabel={editingIncome ? 'Salvar alterações' : 'Salvar'}
              deleteLabel={editingIncome ? 'Excluir renda' : undefined}
              onDelete={editingIncome ? handleDeleteFromModal : undefined}
            />
          </form>
        )}
      </Modal>
    </div>
  )
}


