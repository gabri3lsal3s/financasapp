import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { setCache } from '@/services/offlineCache'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { getCurrentMonthString, addMonths } from '@/utils/format'
import { format } from 'date-fns'

export function useBackgroundCache() {
    const { isOnline } = useNetworkStatus()

    const cacheMonthData = useCallback(async (month: string) => {
        if (!isOnline) return

        try {
            const monthStr = month.length === 7 ? month : month.substring(0, 7)
            const [year, monthNum] = monthStr.split('-').map(Number)
            const startDate = new Date(year, monthNum - 1, 1)
            const endDate = new Date(year, monthNum, 0)
            const startDateStr = format(startDate, 'yyyy-MM-dd')
            const endDateStr = format(endDate, 'yyyy-MM-dd')

            // 1. Cache Expenses
            const { data: expenses } = await supabase
                .from('expenses')
                .select(`
          *,
          category:categories(*),
          credit_card:credit_cards(*)
        `)
                .gte('date', startDateStr)
                .lte('date', endDateStr)
                .order('date', { ascending: false })

            if (expenses) {
                await setCache(`expenses-${monthStr}`, expenses)
            }

            // 2. Cache Incomes
            const { data: incomes } = await supabase
                .from('incomes')
                .select('*, income_category:income_categories(*)')
                .gte('date', startDateStr)
                .lte('date', endDateStr)
                .order('date', { ascending: false })

            if (incomes) {
                await setCache(`incomes-${monthStr}`, incomes)
            }

            // 3. Cache Investments
            const { data: investments } = await supabase
                .from('investments')
                .select('*')
                .eq('month', monthStr)
                .order('month', { ascending: false })

            if (investments) {
                await setCache(`investments-${monthStr}`, investments)
            }

            console.log(`[BackgroundCache] Month ${monthStr} cached successfully.`)
        } catch (error) {
            console.error(`[BackgroundCache] Error caching month ${month}:`, error)
        }
    }, [isOnline])

    useEffect(() => {
        if (!isOnline) return

        const currentMonth = getCurrentMonthString()
        const prevMonth = addMonths(currentMonth, -1)
        const nextMonth = addMonths(currentMonth, 1)

        const monthsToCache = [prevMonth, currentMonth, nextMonth]

        const runCache = async () => {
            // Run sequentially to avoid overwhelming the connection/Supabase
            for (const month of monthsToCache) {
                await cacheMonthData(month)
            }
        }

        runCache()
    }, [isOnline, cacheMonthData])
}
