import { useEffect, useState } from 'react'
import { getCurrentMonthString } from '@/utils/format'
import { hasExplicitCreditCardsDeepLink } from '@/utils/creditCardMonthSelection'
import type { CreditCard } from '@/types'

interface UseContasNavigationParams {
  searchParams: URLSearchParams
  currentMonth: string
  creditCards: CreditCard[]
  expensesByCard: Record<string, number>
  loadingCards: boolean
  loadingBills: boolean
  isMobile: boolean
  setCurrentMonth: (month: string) => void
  setExpandedItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  loadBillData: (silent?: boolean) => Promise<void>
}

/**
 * useContasNavigation — efeitos de navegação da página Contas (extraído do
 * orquestrador). Resolve o mês inicial vindo da busca/deep-link, carrega os
 * dados da fatura ao trocar de mês, expande pendências/cartões destacados pela
 * busca e faz scroll até o cartão alvo.
 */
export function useContasNavigation({
  searchParams,
  currentMonth,
  creditCards,
  expensesByCard,
  loadingCards,
  loadingBills,
  isMobile,
  setCurrentMonth,
  setExpandedItems,
  loadBillData,
}: UseContasNavigationParams) {
  const [hasResolvedInitialMonth, setHasResolvedInitialMonth] = useState(false)

  useEffect(() => {
    if (hasResolvedInitialMonth) return
    if (loadingCards) return

    // Tenta navegar para o mês vindo da busca (?month=YYYY-MM)
    const targetMonth = searchParams.get('month')
    if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
      setCurrentMonth(targetMonth)
    } else if (hasExplicitCreditCardsDeepLink(searchParams, getCurrentMonthString())) {
      const cardMonth = searchParams.get('month')
      if (cardMonth && /^\d{4}-\d{2}$/.test(cardMonth)) {
        setCurrentMonth(cardMonth)
      }
    } else {
      setCurrentMonth(getCurrentMonthString())
    }
    setHasResolvedInitialMonth(true)
  }, [hasResolvedInitialMonth, loadingCards, searchParams, setCurrentMonth])

  useEffect(() => {
    if (!hasResolvedInitialMonth) return
    const hasData = Object.keys(expensesByCard).length > 0
    void loadBillData(hasData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResolvedInitialMonth, currentMonth, creditCards])

  // Expande debts no mobile quando navega por resultado da busca
  useEffect(() => {
    const shouldExpand = searchParams.get('expand') === '1'
    const highlightId = searchParams.get('highlight')
    if (shouldExpand && highlightId && isMobile) {
      setExpandedItems((prev) => ({ ...prev, [highlightId]: true }))
    }
  }, [searchParams, isMobile, setExpandedItems])

  useEffect(() => {
    const targetCardId = searchParams.get('card')
    if (!targetCardId || loadingCards || loadingBills) return
    const targetElement = document.getElementById(`credit-card-${targetCardId}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Expande o card no mobile
      if (isMobile) {
        setExpandedItems((prev) => ({ ...prev, [targetCardId]: true }))
      }
    }
  }, [searchParams, loadingCards, loadingBills, currentMonth, isMobile, setExpandedItems])

  return hasResolvedInitialMonth
}
