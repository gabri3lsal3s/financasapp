import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

interface SGSResponseItem {
  data: string // dd/mm/yyyy
  valor: string // valor percentual em string
}

function parseSgsDate(dateStr: string): string {
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}` // YYYY-MM-DD
  }
  return dateStr
}

/**
 * Converte taxa anual em percentual para taxa diária decimal (CDI/SELIC a.a.).
 */
export function annualPercentToDailyDecimal(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 252) - 1
}

/**
 * Converte taxa diária percentual para taxa diária decimal (SELIC a.d.).
 */
export function dailyPercentToDailyDecimal(dailyPercent: number): number {
  return dailyPercent / 100
}

/**
 * Busca taxas da API SGS do Banco Central e salva no cache index_rates do Supabase.
 */
export async function syncIndexRates(
  indexer: 'cdi' | 'selic',
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
): Promise<number> {
  const seriesCode = indexer === 'cdi' ? 12 : 11 // CDI = 12 (a.a.), SELIC = 11 (a.d.)

  // Formato da data para o BCB: dd/mm/yyyy
  const formatDateForBcb = (isoDate: string) => {
    const parts = isoDate.split('-')
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  const startBcb = formatDateForBcb(startDate)
  const endBcb = formatDateForBcb(endDate)

  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados?formato=json&dataInicial=${startBcb}&dataFinal=${endBcb}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`SGS API respondeu com status: ${response.status}`)
    }

    const data = (await response.json()) as SGSResponseItem[]
    if (!Array.isArray(data) || data.length === 0) {
      return 0
    }

    const rows = data.map((item) => {
      const rateDate = parseSgsDate(item.data)
      const rawVal = parseFloat(item.valor)
      
      // Converter para taxa diária decimal
      const dailyRate = indexer === 'cdi'
        ? annualPercentToDailyDecimal(rawVal) // CDI é divulgado anualizado
        : dailyPercentToDailyDecimal(rawVal) // SELIC acumulada é divulgada diária

      return {
        rate_date: rateDate,
        indexer,
        daily_rate: dailyRate
      }
    })

    // Upsert no banco de dados em lotes para evitar limitações de payload
    const chunkSize = 200
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('index_rates')
        .upsert(chunk, { onConflict: 'rate_date,indexer' })

      if (error) {
        logger.error(`Erro ao inserir taxas de ${indexer} no Supabase:`, error)
        throw error
      }
    }

    return rows.length
  } catch (err) {
    logger.warn(`[syncIndexRates] Falha ao sincronizar taxas de ${indexer}:`, err)
    return 0
  }
}

/**
 * Busca taxas acumuladas na tabela local 'index_rates' para valoração.
 */
export async function loadIndexRatesFromDb(
  indexer: 'cdi' | 'selic' | 'ipca',
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const rates: Record<string, number> = {}

  try {
    const { data, error } = await supabase
      .from('index_rates')
      .select('rate_date, daily_rate')
      .eq('indexer', indexer)
      .gte('rate_date', startDate)
      .lte('rate_date', endDate)

    if (!error && data) {
      for (const row of data) {
        rates[row.rate_date] = Number(row.daily_rate)
      }
    }
  } catch (err) {
    logger.error('Erro ao ler taxas do index rates:', err)
  }

  return rates
}
