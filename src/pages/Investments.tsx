import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { useInvestments } from '@/hooks/useInvestments'
import { Investment } from '@/types'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { clampMonthToAppStart, formatMonth, getCurrentMonthString } from '@/utils/format'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import TransactionCard from '@/components/TransactionCard'
import InvestmentFormModal from '@/components/InvestmentFormModal'

export default function Investments() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false)
  const { investments, loading, createInvestment, updateInvestment, deleteInvestment } = useInvestments(currentMonth)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOnline } = useNetworkStatus()

  const handleOpenModal = (investment?: Investment) => {
    setEditingInvestment(investment || null)
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
                  <TransactionCard
                    key={inv.id}
                    title={inv.description || 'Investimento'}
                    subtitle="Investimento"
                    amount={inv.amount}
                    dateLabel={(() => {
                      const formatted = formatMonth(inv.month)
                      return formatted.charAt(0).toUpperCase() + formatted.slice(1)
                    })()}
                    categoryColor="#10b981"
                    isOffline={inv.id.startsWith('offline-')}
                    onClick={() => handleOpenModal(inv)}
                    staggerClass={staggerClass}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      <InvestmentFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingInvestment={editingInvestment}
        defaultMonth={currentMonth}
        onCreate={createInvestment}
        onUpdate={updateInvestment}
        onDelete={deleteInvestment}
      />
    </div>
  )
}
