import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { useIncomes } from '@/hooks/useIncomes'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Income } from '@/types'
import { clampMonthToAppStart, formatDate, getCurrentMonthString } from '@/utils/format'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TransactionCard from '@/components/TransactionCard'
import IncomeFormModal from '@/components/IncomeFormModal'

export default function Incomes() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false)
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
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
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

      <div className="p-4 lg:p-6 animate-page-enter">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />
        <div
          className="transition-all duration-150 ease-in-out"
          style={{
            opacity: isMonthTransitioning ? 0 : 1,
            transform: isMonthTransitioning ? 'translateY(4px)' : 'translateY(0)'
          }}
        >
          {loading && incomes.length === 0 ? (
            <Loader text="Carregando rendas..." className="py-12" />
          ) : incomes.length === 0 ? (
            <Card className="text-center py-10 space-y-3">
              <p className="text-secondary">Nenhuma renda no mês selecionado.</p>
              <div className="flex justify-center">
                <Button onClick={() => handleOpenModal()}>Adicionar renda</Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-3 lg:gap-4">
              {incomes.map((income, index) => {
                const category = incomeCategories.find((c) => c.id === income.income_category_id)
                const categoryColor = category?.color
                  ? getCategoryColorForPalette(category.color, colorPalette)
                  : 'var(--color-income)'
                const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
                const staggerClass = index < 5 ? staggerClasses[index] : ''

                return (
                  <TransactionCard
                    key={income.id}
                    title={income.description || category?.name || 'Renda'}
                    subtitle={category?.name || 'Sem categoria'}
                    amount={getWeightedReportAmount(income.amount, income.report_weight)}
                    originalAmount={income.amount}
                    dateLabel={formatDate(income.date)}
                    categoryColor={categoryColor}
                    isOffline={income.id.startsWith('offline-')}
                    onClick={() => handleOpenModal(income)}
                    staggerClass={staggerClass}
                  />
                )
              })}
            </div>
          )}
        </div>
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
    </div>
  )
}
