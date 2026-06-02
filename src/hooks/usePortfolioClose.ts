import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import {
  executeAndPersistDailyClose,
  runMonthEndSnapshots,
  type DailyCloseInput,
} from '@/services/returns/portfolioCloseService'
import type { PortfolioPeriodSnapshotRow, PortfolioShareDailyRow } from '@/types'
import { supabase } from '@/lib/supabase'

export function usePortfolioClose() {
  const [closing, setClosing] = useState(false)

  const runClose = useCallback(async (input: DailyCloseInput) => {
    setClosing(true)
    try {
      const result = await executeAndPersistDailyClose(input)
      toast.success('Fechamento da carteira atualizado.')
      window.dispatchEvent(new Event('local-data-changed'))
      return result
    } catch {
      toast.error('Não foi possível atualizar o fechamento.')
      return null
    } finally {
      setClosing(false)
    }
  }, [])

  const runMonthEnd = useCallback(
    async (portfolioId: string, monthKey: string, input: DailyCloseInput) => {
      setClosing(true)
      try {
        await executeAndPersistDailyClose(input)
        await runMonthEndSnapshots(portfolioId, monthKey, input.transactions)
        toast.success('Snapshot mensal gravado.')
        window.dispatchEvent(new Event('local-data-changed'))
      } catch {
        toast.error('Erro ao fechar o mês.')
      } finally {
        setClosing(false)
      }
    },
    []
  )

  const loadShareDaily = useCallback(
    async (portfolioId: string, limit = 400): Promise<PortfolioShareDailyRow[]> => {
      const { data } = await supabase
        .from('portfolio_share_daily')
        .select('portfolio_id, rate_date, share_value, gross_pl, net_pl, total_shares')
        .eq('portfolio_id', portfolioId)
        .order('rate_date', { ascending: true })
        .limit(limit)
      return (data ?? []) as PortfolioShareDailyRow[]
    },
    []
  )

  const loadPeriodSnapshots = useCallback(
    async (portfolioId: string): Promise<PortfolioPeriodSnapshotRow[]> => {
      const { data } = await supabase
        .from('portfolio_period_snapshots')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('period_key', { ascending: true })
      return (data ?? []) as PortfolioPeriodSnapshotRow[]
    },
    []
  )

  return {
    closing,
    runClose,
    runMonthEnd,
    loadShareDaily,
    loadPeriodSnapshots,
  }
}
