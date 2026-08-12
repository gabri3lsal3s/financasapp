import { useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { buildRefundNote, parseRefundNote } from '@/utils/refundNote'
import { formatCurrency, roundToDecimals } from '@/utils/format'
import type { CreditCard, Debt, Expense, Income, IncomeCategory } from '@/types'
import type { BillExpenseItem, BillPaymentDisplayItem } from '@/utils/creditCardBilling'
import type { MonthlyCycleRow } from '@/components/creditCards/CreditCardTimeline'
import type { UseContasModalsReturn } from '@/hooks/useContasModals'

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'

export interface UseContasActionsParams {
  modals: UseContasModalsReturn
  currentMonth: string
  debts: Debt[]
  incomeCategories: IncomeCategory[]
  monthlyCyclesByCard: Record<string, MonthlyCycleRow>
  createExpense: (data: Omit<Expense, 'id' | 'created_at' | 'category' | 'credit_card'>) => Promise<{ data: Expense | null; error: string | null }>
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<{ error: string | null }>
  deleteExpense: (id: string, mode?: 'single' | 'all' | 'subsequent') => Promise<{ error: string | null }>
  createIncome: (data: Omit<Income, 'id' | 'created_at' | 'income_category'>) => Promise<{ error: string | null }>
  createDebt: (payload: Omit<Debt, 'id' | 'created_at'>) => Promise<{ error: string | null }>
  updateDebt: (id: string, updates: Partial<Debt>) => Promise<{ error: string | null }>
  deleteDebt: (id: string, mode?: 'single' | 'all' | 'subsequent') => Promise<{ error: string | null }>
  createCreditCard: (payload: Omit<CreditCard, 'id' | 'created_at'>) => Promise<{ error: string | null }>
  updateCreditCard: (id: string, updates: Partial<CreditCard>) => Promise<{ error: string | null }>
  deleteCreditCard: (id: string) => Promise<{ error: string | null }>
  refreshCreditCards: () => Promise<unknown>
  loadBillData: (silent?: boolean) => Promise<void>
}

/**
 * useContasActions — handlers de negócio da página Contas (extraídos do
 * orquestrador). Centraliza toda a lógica de mutação (cartões, faturas,
 * estornos, ciclos, pendências e integrações) em um único hook.
 */
export function useContasActions(params: UseContasActionsParams) {
  const {
    modals,
    currentMonth,
    debts,
    incomeCategories,
    monthlyCyclesByCard,
    createExpense,
    updateExpense,
    deleteExpense,
    createIncome,
    createDebt,
    updateDebt,
    deleteDebt,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
    refreshCreditCards,
    loadBillData,
  } = params

  const getOrCreateRefundIncomeCategoryId = useCallback(async () => {
    const existing = incomeCategories.find((category) => {
      const normalizedName = String(category.name || '').trim().toLowerCase()
      return normalizedName === REFUND_INCOME_CATEGORY_NAME.toLowerCase()
        || normalizedName === LEGACY_REFUND_INCOME_CATEGORY_NAME.toLowerCase()
    })

    if (existing?.id) {
      if (String(existing.name || '').trim().toLowerCase() === LEGACY_REFUND_INCOME_CATEGORY_NAME.toLowerCase()) {
        await supabase
          .from('income_categories')
          .update({ name: REFUND_INCOME_CATEGORY_NAME })
          .eq('id', existing.id)
      }
      return existing.id
    }

    const { data, error } = await supabase
      .from('income_categories')
      .insert([{
        name: REFUND_INCOME_CATEGORY_NAME,
        color: 'var(--credit-card-refund-category-color)',
      }])
      .select('id')
      .single()

    if (error || !data?.id) {
      throw new Error(error?.message || 'Não foi possível criar a categoria de renda Estorno.')
    }

    return String(data.id)
  }, [incomeCategories])

  const handleConfirmDelete = useCallback(async (migrationCardId: string | null) => {
    if (!modals.editingCard) return

    try {
      modals.setDeleting(true)

      if (migrationCardId) {
        const { error: migrationError } = await supabase
          .from('expenses')
          .update({ credit_card_id: migrationCardId })
          .eq('credit_card_id', modals.editingCard.id)

        if (migrationError) throw migrationError
      } else {
        const { error: unbindError } = await supabase
          .from('expenses')
          .update({ credit_card_id: null, payment_method: 'other' })
          .eq('credit_card_id', modals.editingCard.id)

        if (unbindError) throw unbindError
      }

      await Promise.all([
        supabase.from('credit_card_bill_payments').delete().eq('credit_card_id', modals.editingCard.id),
        supabase.from('credit_card_monthly_cycles').delete().eq('credit_card_id', modals.editingCard.id),
      ])

      const { error: deleteError } = await deleteCreditCard(modals.editingCard.id)
      if (deleteError) throw new Error(deleteError)

      modals.handleCancelDelete()
      modals.closeCardModal()
      await refreshCreditCards()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao excluir cartão: ${err instanceof Error ? err.message : 'Ocorreu um erro inesperado'}`)
    } finally {
      modals.setDeleting(false)
    }
  }, [modals, deleteCreditCard, refreshCreditCards, loadBillData])

  const handleOpenPaymentItem = useCallback(async (paymentItem: BillPaymentDisplayItem) => {
    const parsedRefund = parseRefundNote(paymentItem.note)
    if (parsedRefund.isRefund && parsedRefund.incomeId) {
      const { data, error } = await supabase
        .from('incomes')
        .select('*')
        .eq('id', parsedRefund.incomeId)
        .maybeSingle()

      if (error) {
        alert('Não foi possível obter dados detalhados deste estorno.')
        return
      }
      if (!data) {
        alert('Este estorno não possui mais uma renda correspondente ativa no sistema.')
        return
      }
      modals.setEditingRefundPaymentItem(paymentItem)
      modals.setEditingRefundIncomeId(parsedRefund.incomeId)
      modals.setEditingRefundIncomeInitialData({
        amount: data.amount,
        report_amount: data.report_weight !== undefined && data.report_weight !== null
          ? roundToDecimals(data.amount * data.report_weight, 2)
          : 0,
        date: data.date,
        income_category_id: data.income_category_id,
        description: data.description || '',
      })
      modals.setIsRefundIncomeEditModalOpen(true)
    } else {
      modals.openPaymentEditModal(paymentItem)
    }
  }, [modals])

  const handleSubmitEditRefundIncome = useCallback(async (payload: {
    amount: number
    reportAmount: number
    date: string
    incomeCategoryId: string
    description: string
  }) => {
    if (!modals.editingRefundPaymentItem || !modals.editingRefundIncomeId) return

    const { amount, reportAmount, date, incomeCategoryId, description } = payload
    const reportWeight = amount > 0 ? roundToDecimals(reportAmount / amount, 4) : 1

    try {
      const { error: incomeUpdateError } = await supabase
        .from('incomes')
        .update({
          amount,
          report_weight: reportWeight,
          date,
          income_category_id: incomeCategoryId,
          description: description || null,
        })
        .eq('id', modals.editingRefundIncomeId)

      if (incomeUpdateError) throw incomeUpdateError

      const refundNoteText = buildRefundNote(modals.editingRefundIncomeId, description || '')
      const { error: paymentUpdateError } = await supabase
        .from('credit_card_bill_payments')
        .update({
          amount: -amount,
          payment_date: date,
          note: refundNoteText,
        })
        .eq('id', modals.editingRefundPaymentItem.id)

      if (paymentUpdateError) throw paymentUpdateError

      modals.closeRefundIncomeEditModal()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao atualizar estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }, [modals, loadBillData])

  const handleDeleteRefundIncome = useCallback(async () => {
    const refundPaymentItem = modals.editingRefundPaymentItem
    const refundIncomeId = modals.editingRefundIncomeId
    if (!refundPaymentItem || !refundIncomeId) return
    modals.setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir estorno',
      message: 'Deseja realmente excluir este estorno?',
      checkboxLabel: 'Estou ciente de que este estorno será excluído permanentemente.',
      onConfirm: async () => {
        try {
          const { error: incomeDeleteError } = await supabase
            .from('incomes')
            .delete()
            .eq('id', refundIncomeId)

          if (incomeDeleteError) throw incomeDeleteError

          const { error: paymentDeleteError } = await supabase
            .from('credit_card_bill_payments')
            .delete()
            .eq('id', refundPaymentItem.id)

          if (paymentDeleteError) throw paymentDeleteError

          modals.closeRefundIncomeEditModal()
          await loadBillData(true)
        } catch (err) {
          alert(`Erro ao excluir estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
        }
      },
    })
  }, [modals, loadBillData])

  const handleSubmitRefund = useCallback(async (amount: number, date: string, description: string) => {
    if (!modals.refundCardId) return

    try {
      const estornoCategoryId = await getOrCreateRefundIncomeCategoryId()
      const { data: incomeData, error: incomeError } = await supabase
        .from('incomes')
        .insert([{
          amount,
          report_weight: 1.0,
          date,
          type: 'other',
          income_category_id: estornoCategoryId,
          description: description || 'Estorno fatura',
        }])
        .select('id')
        .single()

      if (incomeError) throw incomeError
      if (!incomeData?.id) throw new Error('Não foi possível obter o ID gerado para a receita de estorno.')

      const refundNoteText = buildRefundNote(String(incomeData.id), description || 'Estorno fatura')

      const { error: paymentError } = await supabase
        .from('credit_card_bill_payments')
        .insert([{
          credit_card_id: modals.refundCardId,
          bill_competence: currentMonth,
          amount: -amount,
          payment_date: date,
          note: refundNoteText,
        }])

      if (paymentError) {
        await supabase.from('incomes').delete().eq('id', incomeData.id)
        throw paymentError
      }

      modals.closeRefundModal()
      await loadBillData(true)
    } catch (err) {
      alert(`Erro ao registrar estorno: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }, [modals, currentMonth, getOrCreateRefundIncomeCategoryId, loadBillData])

  const handleSubmitCard = useCallback(async (payload: Omit<CreditCard, 'id' | 'created_at'>) => {
    if (modals.editingCard) {
      const { error } = await updateCreditCard(modals.editingCard.id, payload)
      if (error) {
        alert(`Erro ao atualizar cartão: ${error}`)
        return
      }
    } else {
      const { error } = await createCreditCard(payload)
      if (error) {
        alert(`Erro ao criar cartão: ${error}`)
        return
      }
    }

    modals.closeCardModal()
    await refreshCreditCards()
    await loadBillData(true)
  }, [modals, createCreditCard, updateCreditCard, refreshCreditCards, loadBillData])

  const handleSubmitPayment = useCallback(async (amount: number, date: string, note: string) => {
    if (!modals.paymentCardId) {
      alert('Selecione um cartão válido.')
      return
    }

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .insert([{
        credit_card_id: modals.paymentCardId,
        bill_competence: currentMonth,
        amount: amount,
        payment_date: date,
        ...(note.trim() ? { note: note.trim() } : {}),
      }])

    if (error) {
      alert(`Erro ao registrar pagamento: ${error.message}`)
      return
    }

    modals.closePaymentModal()
    await loadBillData(true)
  }, [modals, currentMonth, loadBillData])

  const handleSubmitEditPayment = useCallback(async (amount: number, date: string, note: string) => {
    if (!modals.editingPaymentItem) return

    const { error } = await supabase
      .from('credit_card_bill_payments')
      .update({
        amount: amount,
        payment_date: date,
        note: note.trim() || null,
      })
      .eq('id', modals.editingPaymentItem.id)

    if (error) {
      alert(`Erro ao atualizar pagamento: ${error.message}`)
      return
    }

    modals.closePaymentEditModal()
    await loadBillData(true)
  }, [modals, loadBillData])

  const handleDeletePayment = useCallback(async () => {
    const paymentItem = modals.editingPaymentItem
    if (!paymentItem) return
    modals.setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir pagamento',
      message: 'Deseja excluir este pagamento?',
      checkboxLabel: 'Estou ciente de que este pagamento será excluído permanentemente.',
      onConfirm: async () => {
        const { error } = await supabase
          .from('credit_card_bill_payments')
          .delete()
          .eq('id', paymentItem.id)

        if (error) {
          alert(`Erro ao excluir pagamento: ${error.message}`)
          return
        }

        modals.closePaymentEditModal()
        await loadBillData(true)
      },
    })
  }, [modals, loadBillData])

  const handleSubmitCycle = useCallback(async (closingDay: number, dueDay: number) => {
    if (!modals.selectedCardIdForCycle) return

    const existingCycle = monthlyCyclesByCard[modals.selectedCardIdForCycle]

    if (existingCycle) {
      const { error } = await supabase
        .from('credit_card_monthly_cycles')
        .update({ closing_day: closingDay, due_day: dueDay })
        .eq('id', existingCycle.id)

      if (error) {
        alert(`Erro ao salvar ajuste de ciclo: ${error.message}`)
        return
      }
    } else {
      const { error } = await supabase
        .from('credit_card_monthly_cycles')
        .insert([{
          credit_card_id: modals.selectedCardIdForCycle,
          competence: currentMonth,
          closing_day: closingDay,
          due_day: dueDay,
        }])

      if (error) {
        alert(`Erro ao criar ajuste de ciclo: ${error.message}`)
        return
      }
    }

    modals.closeCycleModal()
    await loadBillData(true)
  }, [modals, currentMonth, monthlyCyclesByCard, loadBillData])

  const handleResetCycleToCardDefault = useCallback(async () => {
    if (!modals.selectedCardIdForCycle) return
    const existingCycle = monthlyCyclesByCard[modals.selectedCardIdForCycle]
    if (!existingCycle) {
      modals.closeCycleModal()
      return
    }

    const { error } = await supabase
      .from('credit_card_monthly_cycles')
      .delete()
      .eq('id', existingCycle.id)

    if (error) {
      alert(`Erro ao remover ajuste de ciclo: ${error.message}`)
      return
    }

    modals.closeCycleModal()
    await loadBillData(true)
  }, [modals, monthlyCyclesByCard, loadBillData])

  const handleSubmitEditExpense = useCallback(async (payload: {
    amount: number
    reportAmount: number
    date: string
    paymentMethod: string
    creditCardId: string
    categoryId: string
    description: string
  }) => {
    if (!modals.editingExpenseItem) return

    const isRefund = Number(modals.editingExpenseItem.base_amount ?? modals.editingExpenseItem.amount ?? 0) < 0
    const signedAmount = isRefund ? -Math.abs(payload.amount) : payload.amount
    const reportWeight = payload.amount > 0 ? roundToDecimals(payload.reportAmount / payload.amount, 4) : 1

    const { error } = await updateExpense(modals.editingExpenseItem.id, {
      amount: signedAmount,
      report_weight: reportWeight,
      date: payload.date,
      payment_method: payload.paymentMethod as BillExpenseItem['payment_method'],
      credit_card_id: payload.paymentMethod === 'credit_card' ? payload.creditCardId : null,
      category_id: payload.categoryId,
      description: payload.description || undefined,
    })

    if (error) {
      alert(`Erro ao editar despesa: ${error}`)
      return
    }

    modals.closeExpenseEditModal()
    await loadBillData(true)
  }, [modals, updateExpense, loadBillData])

  const handleDeleteExpense = useCallback(async () => {
    const expenseItem = modals.editingExpenseItem
    if (!expenseItem?.id) return

    if (Number(expenseItem.installment_total || 1) > 1) {
      modals.setDeleteModalState({
        isOpen: true,
        type: 'expense',
        id: expenseItem.id,
        installmentNumber: expenseItem.installment_number || 1,
        installmentTotal: expenseItem.installment_total || 1,
      })
      modals.closeExpenseEditModal()
    } else {
      modals.setDeleteConfirmState({
        isOpen: true,
        title: 'Excluir despesa',
        message: 'Deseja excluir esta despesa?',
        checkboxLabel: 'Estou ciente de que esta despesa será excluída permanentemente.',
        onConfirm: async () => {
          const { error } = await deleteExpense(expenseItem.id)
          if (error) {
            alert(`Erro ao excluir despesa: ${error}`)
            return
          }

          modals.closeExpenseEditModal()
          await loadBillData(true)
        },
      })
    }
  }, [modals, deleteExpense, loadBillData])

  const handleSubmitDebt = useCallback(async (payload: {
    name: string
    type: 'payable' | 'receivable'
    amount: number
    due_date: string
    description: string
    status: 'pending' | 'paid'
  }) => {
    if (modals.editingDebt) {
      const { error } = await updateDebt(modals.editingDebt.id, payload)
      if (error) {
        alert(`Erro ao atualizar: ${error}`)
        return
      }
    } else {
      const { error } = await createDebt(payload)
      if (error) {
        alert(`Erro ao criar: ${error}`)
        return
      }
    }

    modals.closeDebtModal()
  }, [modals, createDebt, updateDebt])

  const handleDeleteDebt = useCallback(async (debtId: string) => {
    const debt = debts.find((d) => d.id === debtId)
    if (debt && debt.expense?.installment_group_id && Number(debt.expense?.installment_total || 1) > 1) {
      modals.setDeleteModalState({
        isOpen: true,
        type: 'debt',
        id: debtId,
        installmentNumber: debt.expense.installment_number || 1,
        installmentTotal: debt.expense.installment_total || 1,
      })
    } else {
      modals.setDeleteConfirmState({
        isOpen: true,
        title: 'Excluir pendência',
        message: 'Deseja excluir este registro de pendência?',
        checkboxLabel: 'Estou ciente de que esta pendência será excluída permanentemente.',
        onConfirm: async () => {
          const { error } = await deleteDebt(debtId)
          if (error) {
            alert(`Erro ao excluir: ${error}`)
            return
          }
        },
      })
    }
  }, [debts, modals, deleteDebt])

  const resolveIncomeCategoryId = useCallback(async () => {
    let cat = incomeCategories.find(c => (c.name || '').toLowerCase() === 'outros')
    if (cat) return cat.id

    cat = incomeCategories.find(c => (c.name || '').toLowerCase() === 'sem categoria')
    if (cat) return cat.id

    if (incomeCategories.length > 0) return incomeCategories[0].id

    const { data } = await supabase
      .from('income_categories')
      .select('id')
      .eq('name', 'Sem categoria')
      .maybeSingle()

    if (data?.id) return data.id

    const { data: inserted, error: insertError } = await supabase
      .from('income_categories')
      .insert([{ name: 'Sem categoria', color: 'var(--category-fallback-muted)' }])
      .select('id')
      .single()

    if (insertError || !inserted?.id) {
      throw new Error('Não foi possível obter ou criar categoria para a renda.')
    }
    return inserted.id
  }, [incomeCategories])

  const handleConfirmWithIncome = useCallback(async () => {
    if (!modals.selectedDebtForIncome) return
    try {
      const categoryId = await resolveIncomeCategoryId()
      const { error: incomeError } = await createIncome({
        amount: modals.selectedDebtForIncome.amount,
        description: modals.selectedDebtForIncome.name,
        date: modals.selectedDebtForIncome.due_date || format(new Date(), 'yyyy-MM-dd'),
        income_category_id: categoryId,
        report_weight: 1.0,
        type: 'other',
      })
      if (incomeError) {
        alert(`Erro ao criar receita: ${incomeError}`)
      }
    } catch (err) {
      alert(`Erro ao criar receita: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }

    const { error } = await updateDebt(modals.selectedDebtForIncome.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    modals.setIsIncomeConfirmModalOpen(false)
    modals.setSelectedDebtForIncome(null)
  }, [modals, resolveIncomeCategoryId, createIncome, updateDebt])

  const handleConfirmWithoutIncome = useCallback(async () => {
    if (!modals.selectedDebtForIncome) return
    const { error } = await updateDebt(modals.selectedDebtForIncome.id, { status: 'paid' })
    if (error) {
      alert(`Erro ao atualizar status do recebimento: ${error}`)
    }

    modals.setIsIncomeConfirmModalOpen(false)
    modals.setSelectedDebtForIncome(null)
  }, [modals, updateDebt])

  const handleConfirmIntegrated = useCallback(async () => {
    if (!modals.selectedDebtForIntegrated || !modals.linkedExpense) return

    const finalValue = modals.integratedReportValueInput
    if (Number.isNaN(finalValue) || finalValue < 0 || finalValue > modals.linkedExpense.amount) {
      alert(`Valor inválido. Deve ser entre 0 e ${formatCurrency(modals.linkedExpense.amount)}.`)
      return
    }

    try {
      const reportWeight = modals.linkedExpense.amount > 0 ? roundToDecimals(finalValue / modals.linkedExpense.amount, 4) : 1
      const { error: updateExpenseError } = await updateExpense(modals.linkedExpense.id, {
        report_weight: reportWeight,
      })

      if (updateExpenseError) {
        alert(`Erro ao atualizar despesa vinculada: ${updateExpenseError}`)
        return
      }

      const { error } = await updateDebt(modals.selectedDebtForIntegrated.id, {
        status: 'paid',
      })
      if (error) {
        alert(`Erro ao atualizar status do recebimento: ${error}`)
      }
    } catch (err) {
      alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }

    modals.setIsIntegratedModalOpen(false)
    modals.setSelectedDebtForIntegrated(null)
    modals.setLinkedExpense(null)
  }, [modals, updateExpense, updateDebt])

  const handleCreateExpenseForPayable = useCallback(async (expenseData: Omit<Expense, 'id' | 'created_at' | 'category'>) => {
    if (!modals.selectedDebtForPayableExpense) return { data: null, error: 'Dívida não selecionada' }

    const { data: createdExpense, error } = await createExpense(expenseData)

    if (error) {
      return { data: null, error }
    }

    if (createdExpense) {
      const { error: updateDebtError } = await updateDebt(modals.selectedDebtForPayableExpense.id, {
        status: 'paid',
        expense_id: createdExpense.id,
      })

      if (updateDebtError) {
        alert(`Erro ao vincular despesa à dívida: ${updateDebtError}`)
      }
    }

    modals.setIsPayableExpenseModalOpen(false)
    modals.setSelectedDebtForPayableExpense(null)

    return { data: createdExpense, error: null }
  }, [modals, createExpense, updateDebt])

  const handleConfirmPayableWithoutExpenseDirect = useCallback(async () => {
    if (modals.selectedDebtForPayableExpense) {
      const { error } = await updateDebt(modals.selectedDebtForPayableExpense.id, { status: 'paid' })
      if (error) {
        alert(`Erro ao marcar dívida como paga: ${error}`)
      }
    }
    modals.setIsPayableConfirmModalOpen(false)
    modals.setSelectedDebtForPayableExpense(null)
  }, [modals, updateDebt])

  const handleToggleDebtStatus = useCallback(async (debt: Debt) => {
    const nextStatus = debt.status === 'pending' ? 'paid' : 'pending'

    if (nextStatus === 'paid') {
      if (debt.type === 'receivable') {
        if (debt.expense_id) {
          try {
            const { data: expense, error: fetchExpenseError } = await supabase
              .from('expenses')
              .select('*')
              .eq('id', debt.expense_id)
              .maybeSingle()

            if (fetchExpenseError) throw fetchExpenseError

            if (expense) {
              const currentReportValue = roundToDecimals(expense.amount * (expense.report_weight ?? 1), 2)
              const finalValue = Math.max(0, roundToDecimals(currentReportValue - debt.amount, 2))

              modals.setLinkedExpense(expense)
              modals.setSelectedDebtForIntegrated(debt)
              modals.setIntegratedReportValueInput(finalValue)
              modals.setIsIntegratedModalOpen(true)
              return
            }
          } catch (err) {
            alert(`Erro ao processar integração da cobrança: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
            return
          }
        } else {
          modals.setSelectedDebtForIncome(debt)
          modals.setIsIncomeConfirmModalOpen(true)
          return
        }
      } else if (debt.type === 'payable') {
        modals.setSelectedDebtForPayableExpense(debt)
        modals.setIsPayableConfirmModalOpen(true)
        return
      }
    }

    const { error } = await updateDebt(debt.id, { status: nextStatus })
    if (error) {
      alert(`Erro ao atualizar status: ${error}`)
    }
  }, [modals, updateDebt])

  return {
    handleConfirmDelete,
    handleOpenPaymentItem,
    handleSubmitEditRefundIncome,
    handleDeleteRefundIncome,
    handleSubmitRefund,
    handleSubmitCard,
    handleSubmitPayment,
    handleSubmitEditPayment,
    handleDeletePayment,
    handleSubmitCycle,
    handleResetCycleToCardDefault,
    handleSubmitEditExpense,
    handleDeleteExpense,
    handleSubmitDebt,
    handleDeleteDebt,
    handleConfirmWithIncome,
    handleConfirmWithoutIncome,
    handleConfirmIntegrated,
    handleCreateExpenseForPayable,
    handleConfirmPayableWithoutExpenseDirect,
    handleToggleDebtStatus,
  }
}

export type UseContasActionsReturn = ReturnType<typeof useContasActions>
