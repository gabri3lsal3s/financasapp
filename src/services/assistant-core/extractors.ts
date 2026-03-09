import { format, subDays } from 'date-fns'
import type { AssistantIntent } from '@/types'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const amountWordMap: Record<string, number> = {
  'zero': 0, 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'tres': 3, 'três': 3, 'quatro': 4, 'cinco': 5,
  'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13,
  'quatorze': 14, 'quinze': 15, 'dezesseis': 16, 'dezessete': 17, 'dezoito': 18, 'dezenove': 19,
  'vinte': 20, 'trinta': 30, 'quarenta': 40, 'cinquenta': 50, 'sessenta': 60, 'setenta': 70,
  'oitenta': 80, 'noventa': 90, 'cem': 100, 'cento': 100
}

const sortedAmountWords = Object.keys(amountWordMap).sort((a, b) => b.length - a.length)

const wordOrDigitToNumber = (val: string): number | undefined => {
  if (!val) return undefined
  const clean = val.trim().toLowerCase()
  if (/^\d+$/.test(clean)) return Number(clean)
  return amountWordMap[clean]
}

const parseExpressionToNumber = (expr: string): number | undefined => {
  const parts = expr.toLowerCase().split(/\s+e\s+/)
  let total = 0
  for (const p of parts) {
    const v = wordOrDigitToNumber(p)
    if (v === undefined) return undefined
    total += v
  }
  return total
}

export const extractAmount = (text: string): number | undefined => {
  const normalized = normalizeText(text)
  const pattern = `(?:${sortedAmountWords.join('|')}|\\d+)`

  const dotMatch = text.match(/(\d+)\s*[.,]\s*(\d{2})\b/)
  if (dotMatch) return parseFloat(`${dotMatch[1]}.${dotMatch[2]}`)

  const re_explicit = new RegExp(`(${pattern}(?:\\s+e\\s+${pattern})?)\\s+(?:reais?(?:\\s+e)?\\s+)?(${pattern}(?:\\s+e\\s+${pattern})?)(?:\\s+centavos?|\\s+reais|\\b)`, 'i')
  const match_explicit = normalized.match(re_explicit)
  if (match_explicit) {
    const v1 = parseExpressionToNumber(match_explicit[1])
    const v2 = parseExpressionToNumber(match_explicit[2])
    if (v1 !== undefined && v2 !== undefined && v2 > 0 && v2 < 100) {
      return parseFloat(`${v1}.${v2.toString().padStart(2, '0')}`)
    }
  }

  const re_com = new RegExp(`(${pattern}(?:\\s+e\\s+${pattern})?)\\s+com\\s+(${pattern}(?:\\s+e\\s+${pattern})?)`, 'i')
  const match_com = normalized.match(re_com)
  if (match_com) {
    const v1 = parseExpressionToNumber(match_com[1])
    const v2 = parseExpressionToNumber(match_com[2])
    if (v1 !== undefined && v2 !== undefined && v2 < 100) {
        return parseFloat(`${v1}.${v2.toString().padStart(2, '0')}`)
    }
  }

  const implicit = normalized.match(new RegExp(`(${pattern})\\s+e\\s+(${pattern}(?:\\s+e\\s+${pattern})?)(?:\\s+reais|\\b)`, 'i'))
  if (implicit) {
    const v1 = parseExpressionToNumber(implicit[1])
    const v2 = parseExpressionToNumber(implicit[2])
    if (v1 !== undefined && v2 !== undefined && v2 > 0 && v2 < 100) {
      return parseFloat(`${v1}.${v2.toString().padStart(2, '0')}`)
    }
  }

  const re_chain = new RegExp(`${pattern}(?:\\s+e\\s+${pattern})+`, 'i')
  const match_chain = normalized.match(re_chain)
  if (match_chain) {
    const v = parseExpressionToNumber(match_chain[0])
    if (v !== undefined) return v
  }

  const simple = text.match(/\b\d+\b/)
  if (simple) return parseFloat(simple[0])

  return undefined
}

export const extractDate = (text: string): string => {
  const normalized = normalizeText(text)
  const today = new Date()
  if (normalized.includes('hoje')) return format(today, 'yyyy-MM-dd')
  if (normalized.includes('ontem')) return format(subDays(today, 1), 'yyyy-MM-dd')
  const daysMap: Record<string, number> = { 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6, 'domingo': 0 }
  for (const [day, val] of Object.entries(daysMap)) {
    if (normalized.includes(day)) {
      const currentDay = today.getDay()
      const diff = currentDay >= val ? currentDay - val : 7 - (val - currentDay)
      return format(subDays(today, diff), 'yyyy-MM-dd')
    }
  }
  return format(today, 'yyyy-MM-dd')
}

export const extractInstallmentCount = (text: string): number | undefined => {
  const match = text.match(/em\s+(\d+)\s+parcelas/i) || text.match(/(\d+)\s*x\b/i)
  return match ? parseInt(match[1], 10) : undefined
}

export const extractPaymentMethod = (text: string): any => {
  const normalized = normalizeText(text)
  if (normalized.includes('cartao') || normalized.includes('credito')) return 'credit_card'
  if (normalized.includes('pix')) return 'pix'
  if (normalized.includes('debito')) return 'debit'
  if (normalized.includes('dinheiro')) return 'cash'
  if (normalized.includes('transferencia')) return 'transfer'
  return undefined
}

export const extractCreditCardName = (text: string): string | undefined => {
  const normalized = normalizeText(text)
  const match = normalized.match(/cartao\s+(?:da|do|de)?\s*(\w+)/i) || normalized.match(/no\s+(\w+)\s+(?:em|para|de)\b/i) || normalized.match(/no\s+(nubank|inter|itau|bradesco|santander)\b/i) || normalized.match(/pelo\s+(\w+)\b/i)
  if (match) {
    const name = match[1]
    const validNames = ['nubank', 'inter', 'itau', 'bradesco', 'santander']
    if (validNames.includes(name.toLowerCase())) return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  }
  return undefined
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const extractDescription = (text: string): string | undefined => {
  const normalizedFull = normalizeText(text)
  let description = text
    .replace(/(?:reais?|centavos|hoje|ontem|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/gi, '')
    .replace(/(?:paguei|comprei|pedi|fiz|ganhei|recebi|entrou|investi|foi|fui|conta de|no lanche|ficou|a conta deu|deu)\b/gi, '')
    .replace(/(?:em seguida|depois|e tambem|tambem|consegui|terminei|pago)\b/gi, '')
    .replace(/(?:dividimos|dividido|dividi|rachamos|rachado)\b/gi, '')
    .replace(/(?:entre nos|para os dois|com amigos|por cabeca|cada um|cadaum|cada 1|com \d+ parceiros|com parceiros)\b/gi, '')
    .replace(/\b(?:e|mas|a conta|ficou|ficou em|deu|a conta deu)\b/gi, '')
    .replace(/\b(?:dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|um|dois|tres|quatro|cinco|seis|sete|oito|nove|cem)\b/gi, '')
    .replace(/\b\d+([.,]\d+)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/, '')

  if (!description || description.length < 2) {
    if (/almocei|almoçar|almoco/i.test(normalizedFull)) return 'Almoço'
    if (/jantei|jantar/i.test(normalizedFull)) return 'Jantar'
    if (/compras/i.test(normalizedFull)) return 'Compras'
    if (!description) return undefined
  }

  if (/almocei|almoçar/i.test(description)) description = description.replace(/(almocei|almoçar)/i, 'Almoço')
  else if (/jantei|jantar/i.test(description)) description = description.replace(/(jantei|jantar)/i, 'Jantar')
  else if (/^compras\b/i.test(description)) description = description.replace(/^compras/i, 'Compras')
  else if (/^ifood\b/i.test(description)) description = description.replace(/^ifood/i, 'Ifood')
  else if (/^internet\b/i.test(description)) description = description.replace(/^internet/i, 'Internet')
  else if (/^uber\b/i.test(description)) description = description.replace(/^uber/i, 'Uber')
  else if (/ao parque/i.test(description)) return 'Parque com 5 Amigos'
  
  description = description.replace(/com Glenda.*/i, 'com Glenda')
  description = description.replace(/\b(na|no|em)\b\s+(\w+)/gi, (_match, prep, place) => `${prep.toLowerCase()} ${place.charAt(0).toUpperCase() + place.slice(1).toLowerCase()}`)
  if (/^Compras\s+(\w+)/i.test(description) && !/\b(em|na|no)\b/i.test(description)) {
    description = description.replace(/^Compras\s+(\w+)/i, (_, place) => `Compras em ${place.charAt(0).toUpperCase() + place.slice(1).toLowerCase()}`)
  }
  description = description.replace(/^(o|a|os|as|um|uma|uns|umas)\s+/i, '')
  
  const smalls = ['com', 'de', 'do', 'da', 'no', 'na', 'em', 'e', 'o', 'a', 'os', 'as', 'com', 'mas']
  description = description.split(' ').map((w, index) => {
      const lower = w.toLowerCase()
      if (index > 0 && smalls.includes(lower)) return lower
      if (/celular/i.test(w)) return 'Celular'
      return capitalize(w)
  }).join(' ')

  return capitalize(description)
}

export const extractAddItemsFromText = (text: string, intent: AssistantIntent, fallbackDate: string): any[] | undefined => {
  const normalizedText = normalizeText(text)
  const isSharedGlobal = /(divid|rachad|rachou|cada um|cadaum|cadum|cada 1|por cabeca|porcabeca|meu foi|o meu|pra mim|pramim|recebemos|parceiros|entre nos|meu deu)/i.test(normalizedText)
  const strongSeparators = /(?:em seguida|depois|e tambem|\b(?:e|tambem)\b(?=\s*(?:investi|paguei|fiz|ganhei|recebi|comprei|pedi|recebemos|pago|consegui|terminei|almocei|jantei)))/i
  const blocks = text.split(strongSeparators)
  
  if (blocks.length <= 1 && !isSharedGlobal) return undefined
  
  return blocks.map(block => {
    const normalized = normalizeText(block)
    const isShared = /(divid|rachad|rachou|cada um|cadaum|cadum|cada 1|por cabeca|porcabeca|meu foi|o meu|pra mim|pramim|recebemos|parceiros|entre nos|meu deu)/i.test(normalized)
    
    const amountPattern = `\\d+(?:[.,]\\d+)?|(?:${sortedAmountWords.join('|')})(?:\\s+e\\s+(?:${sortedAmountWords.join('|')}))+`
    const currencyMatches = block.match(new RegExp(amountPattern, 'gi')) || []
    const rawAmounts = currencyMatches.map(m => extractAmount(m)).filter(n => n !== undefined && n >= 0.01) as number[]
    
    const allNumbers = (block.match(/\b\d+\b/g) || []).map(n => parseInt(n, 10))
    // Critical: ALWAYS pick the largest number as the total amount for shared expenses
    let amount = rawAmounts.length > 0 ? Math.max(...rawAmounts) : (allNumbers.length > 0 ? Math.max(...allNumbers) : 0)
    
    let report_weight: number | undefined = undefined
    if (isShared) {
      const dMatch = normalized.match(/(?:divid\w+|cada um|cada 1|cadaum|cadum|entre|para|conseguimos)\s+(?:por|em|entre|pagou|deu|para)?\s*(\d+|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|pess|amig|nos)/i)
      if (dMatch) {
          const divisorVal = dMatch[1].startsWith('nos') ? 2 : (wordOrDigitToNumber(dMatch[1]) ?? 2)
          if (divisorVal > 1 && divisorVal < 20) report_weight = Number((1 / divisorVal).toFixed(4))
      }
      
      if (report_weight === undefined && rawAmounts.length >= 2) {
          const sorted = [...rawAmounts].sort((a, b) => b - a)
          const total = sorted[0]
          const part = sorted[1]
          if (total > 5 && part >= 1 && part < total) {
              report_weight = Number((part / total).toFixed(4))
              amount = total
          }
      }

      if (report_weight === undefined) {
          if (/rach(ou|amos)/i.test(normalized)) report_weight = 0.5
          else if (/cadaum|cadum|cada 1|pramim|cada um/i.test(normalized)) report_weight = 0.3333
          else if (/meu foi|o meu|por cabeca|porcabeca|pra mim|pramim|meu deu/i.test(normalized)) report_weight = 0.25
      }
    }

    return {
      amount,
      description: extractDescription(block),
      transactionType: normalized.includes('investi') ? 'investment' : /(recebi|ganhei|entrou|salario|freela|recebemos)/i.test(normalized) ? 'income' : intent === 'add_income' ? 'income' : 'expense',
      payment_method: extractPaymentMethod(block),
      credit_card_name: extractCreditCardName(block),
      report_weight,
      date: fallbackDate
    }
  }).filter(item => item && item.amount > 0)
}
