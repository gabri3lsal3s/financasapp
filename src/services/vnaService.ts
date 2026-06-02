import { supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/services/offlineCache'

const VNA_CACHE_KEY = 'vna-daily-map'
const DEFAULT_VNA = 4500

/** VNA de referência quando ANBIMA não está disponível (MVP). */
export const FALLBACK_VNA = DEFAULT_VNA

export async function loadVnaMap(startDate: string, endDate: string): Promise<Record<string, number>> {
  const cacheKey = `${VNA_CACHE_KEY}-${startDate}-${endDate}`
  const cached = await getCache<Record<string, number>>(cacheKey)
  if (cached) return cached

  const { data, error } = await supabase
    .from('vna_daily')
    .select('reference_date, vna_value')
    .gte('reference_date', startDate)
    .lte('reference_date', endDate)
    .order('reference_date')

  const map: Record<string, number> = {}
  if (!error && data) {
    for (const row of data) {
      map[row.reference_date] = Number(row.vna_value)
    }
  }

  setCache(cacheKey, map)
  return map
}

export function resolveVnaForDate(vnaMap: Record<string, number>, date: string): number {
  if (vnaMap[date] != null) return vnaMap[date]

  const sorted = Object.keys(vnaMap).sort()
  let last = FALLBACK_VNA
  for (const d of sorted) {
    if (d > date) break
    last = vnaMap[d]
  }
  return last
}

export async function upsertVnaRow(referenceDate: string, vnaValue: number): Promise<void> {
  await supabase.from('vna_daily').upsert(
    { reference_date: referenceDate, vna_value: vnaValue, source: 'manual' },
    { onConflict: 'reference_date' }
  )
}
