import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import {
  executeAndPersistDailyClose,
  type DailyCloseInput,
} from '@/services/returns/portfolioCloseService'
import type { PortfolioShareDailyRow } from '@/types'
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

  return {
    closing,
    runClose,
    loadShareDaily,
  }
}
