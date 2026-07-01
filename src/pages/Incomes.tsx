import { useEffect, useState } from 'react'
import { usePageActions } from '@/hooks/usePageActions'
import { SkeletonTransactionList } from '@/components/Skeleton'
import { useIncomes } from '@/hooks/useIncomes'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Income } from '@/types'
import { useSearchHighlight } from '@/utils/pageTitles'
import { clampMonthToAppStart, formatDate, getCurrentMonthString } from '@/utils/format'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import { Plus, TrendingUp } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import TransactionCard from '@/components/TransactionCard'
import IncomeFormModal from '@/components/IncomeFormModal'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import ConfirmModal from '@/components/ConfirmModal'
import EmptyState from '@/components/EmptyState'
import { getStaggerClass } from '@/constants/animation'

const INCOME_TYPE_LABELS: Record<NonNullable<Income['type']>, string> = {
  other: 'Outros',
  cash: 'Dinheiro',
  pix: 'PIX',
  transfer: 'Transferência',
}

const INCOME_TYPE_COLORS: Record<NonNullable<Income['type']>, string> = {
  other: 'var(--color-text-secondary)',
  cash: 'var(--color-text-secondary)',
  pix: 'var(--color-income)',
  transfer: 'var(--color-primary)',
}

export default function Incomes() {
  useSearchHighlight()
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string, isDefaultExpanded: boolean) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !(prev[id] !== undefined ? prev[id] : isDefaultExpanded),
    }))
  }
  const { incomes, loading, createIncome, updateIncome, deleteIncome } = useIncomes(currentMonth)
  const { categories, loading: categoriesLoading } = useCategories()
  const { incomeCategories, loading: incomeCategoriesLoading } = useIncomeCategories()
  const { colorPalette } = usePaletteColors()
  
  const assignedIncomeCategories = assignUniquePaletteColors(incomeCategories, colorPalette)
  const incomeCategoryColorMap: Record<string, string> = {}
  incomeCategories.forEach((c, i) => {
    if (c && c.id) {
      incomeCategoryColorMap[c.id] = assignedIncomeCategories[i] || getCategoryColorForPalette(c.color, colorPalette)
    }
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  usePageActions(
    [
      {
        icon: Plus,
        label: 'Adicionar',
        intent: 'primary',
        actionRole: 'launch',
        onClick: () => handleOpenModal(),
        compactOnMobile: true,
      },
    ],
    isModalOpen
  )
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean
    id: string
  } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOnline } = useNetworkStatus()

  useEffect(() => {
    const isReady = !loading && !categoriesLoading && !incomeCategoriesLoading
    if (isReady && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [loading, categoriesLoading, incomeCategoriesLoading, categories.length, incomeCategories.length, navigate])

  const handleMonthChange = (month: string) => {
    if (month === currentMonth) return
    setCurrentMonth(month)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('month', month)
      return next
    })
  }

  const swipeHandlers = useSwipeMonth(currentMonth, handleMonthChange)

  const handleOpenModal = (income?: Income) => {
    setEditingIncome(income || null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingIncome(null)
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
      setIsModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, incomeCategories, currentMonth])

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
      <div className="p-4 lg:p-6 animate-page-enter">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />
        <MonthTransitionView month={currentMonth}>
          {loading && incomes.length === 0 ? (
            <SkeletonTransactionList />
          ) : incomes.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={32} />}
              title="Nenhuma renda no mês selecionado"
              description="Você ainda não registrou nenhuma renda neste mês."
              action={{
                label: 'Adicionar renda',
                onClick: () => handleOpenModal(),
                className: 'bg-income border-income hover:bg-income/90 text-white font-bold',
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-3 lg:gap-4">
              {incomes.map((income, index) => {
                 const category = incomeCategories.find((c) => c.id === income.income_category_id)
                const categoryColor = category?.color
                  ? getCategoryColorForPalette(category.color, colorPalette)
                  : 'var(--color-income)'
                const [_, categoryIconName] = (category?.color || '').split('|')
                const staggerClass = getStaggerClass(index)

                const isDefaultExpanded = false
                const isExpanded = expandedIds[income.id] !== undefined ? expandedIds[income.id] : isDefaultExpanded

                return (
                  <div key={income.id} id={`item-${income.id}`}>
                    <TransactionCard
                      title={income.description || category?.name || 'Renda'}
                      subtitle={category?.name || 'Sem categoria'}
                      amount={getWeightedReportAmount(income.amount, income.report_weight)}
                      originalAmount={income.amount}
                      dateLabel={formatDate(income.date).substring(0, 5)}
                      categoryColor={categoryColor}
                      categoryIconName={categoryIconName}
                      isOffline={income.id.startsWith('offline-')}
                      onClick={() => handleOpenModal(income)}
                      staggerClass={staggerClass}
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleExpand(income.id, isDefaultExpanded)}
                      onEdit={() => handleOpenModal(income)}
                      onDelete={async () => {
                        setDeleteConfirmState({
                          isOpen: true,
                          id: income.id,
                        })
                      }}
                      paymentLabel={INCOME_TYPE_LABELS[income.type || 'other']}
                      paymentColor={INCOME_TYPE_COLORS[income.type || 'other']}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </MonthTransitionView>
      </div>

      <IncomeFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingIncome={editingIncome}
        incomeCategories={incomeCategories}
        onCreate={createIncome}
        onUpdate={updateIncome}
        onDelete={deleteIncome}
      />


      <ConfirmModal
        isOpen={deleteConfirmState?.isOpen || false}
        onClose={() => setDeleteConfirmState(null)}
        title="Excluir renda"
        confirmLabel="Excluir renda"
        confirmVariant="danger"
        requireCheckbox={true}
        checkboxLabel="Estou ciente de que esta renda será excluída permanentemente."
        onConfirm={async () => {
          if (deleteConfirmState) {
            const { error } = await deleteIncome(deleteConfirmState.id)
            if (error) {
              alert(`Erro ao excluir renda: ${error}`)
            }
            setDeleteConfirmState(null)
          }
        }}
      >
        <p className="text-sm text-primary">Tem certeza que deseja excluir esta renda?</p>
      </ConfirmModal>
    </div>
  )
}
