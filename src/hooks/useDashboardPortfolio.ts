import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction } from '@/types'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { logger } from '@/utils/logger'

interface UseDashboardPortfolioReturn {
  portfolioId: string
  portfolioTransactions: PortfolioTransaction[]
  loadPortfolioTransactions: () => Promise<void>
  loading: boolean
}

/**
 * Hook que carrega os dados de portfólio para o Dashboard.
 * Gerencia o ciclo de vida: buscar ou criar portfólio, carregar transações.
 */
export function useDashboardPortfolio(): UseDashboardPortfolioReturn {
  const [portfolioId, setPortfolioId] = useState('')
  const [portfolioTransactions, setPortfolioTransactions] = useState<PortfolioTransaction[]>([])
  const [loading, setLoading] = useState(false)

  const loadPortfolioTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setPortfolioId('')
        setPortfolioTransactions([])
        return
      }

      let { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle()

      if (!portfolio) {
        const { data: newPort, error: createError } = await supabase
          .from('portfolios')
          .insert({ client_id: user.id, cash_balance: 0 })
          .select('id')
          .single()

        if (createError) throw createError
        portfolio = newPort
      }

      setPortfolioId(portfolio.id)

      const transactions = await fetchAllPortfolioTransactions(portfolio.id, {
        select: 'id, portfolio_id, ticker, operation_type, quantity, price, date, created_at'
      })
      setPortfolioTransactions(transactions)
    } catch (err) {
      logger.error('Erro ao carregar livro-razão no dashboard:', err)
      setPortfolioId('')
      setPortfolioTransactions([])
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    portfolioId,
    portfolioTransactions,
    loadPortfolioTransactions,
    loading,
  }
}
