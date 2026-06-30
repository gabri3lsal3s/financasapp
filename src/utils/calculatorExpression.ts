/**
 * Utilitários de expressão matemática para a calculadora flutuante.
 * Funções puras — sem dependência de React ou DOM.
 */

/**
 * Normaliza um valor de input: trim e substitui vírgulas por pontos.
 */
export function normalizeInputValue(value: string): string {
  return value.trim().replace(/,/g, '.')
}

/**
 * Converte um valor para string numérica canônica (espaços removidos, vírgulas → pontos).
 */
export function toCanonicalNumericString(value: string): string {
  const compact = value.trim().replace(/\s/g, '')
  if (!compact) return ''
  return compact.replace(/,/g, '.')
}

/**
 * Formata um número canônico (com ponto decimal) para exibição PT-BR (com vírgula decimal).
 */
export function formatCanonicalNumberToPtBr(value: string): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return value
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(parsed)
}

/**
 * Formata uma expressão matemática para exibição, convertendo
 * pontos decimais para vírgulas e agrupando inteiros.
 */
export function formatExpressionForDisplay(expression: string): string {
  let formatted = ''
  let numericToken = ''

  const flushNumericToken = () => {
    if (!numericToken) return

    const hasTrailingDot = numericToken.endsWith('.')
    const [rawIntegerPart = '', rawDecimalPart = ''] = numericToken.split('.')
    const integerPart = rawIntegerPart.replace(/\D/g, '') || '0'
    const formattedIntegerPart = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(integerPart))

    if (hasTrailingDot) {
      formatted += `${formattedIntegerPart},`
      numericToken = ''
      return
    }

    if (numericToken.includes('.')) {
      formatted += `${formattedIntegerPart},${rawDecimalPart}`
      numericToken = ''
      return
    }

    formatted += formattedIntegerPart
    numericToken = ''
  }

  for (const char of expression) {
    if (/\d|\./.test(char)) {
      numericToken += char
      continue
    }
    flushNumericToken()
    formatted += char
  }

  flushNumericToken()
  return formatted
}

/**
 * Avalia uma expressão matemática string e retorna o resultado como string,
 * ou null se inválida.
 * Suporta: +, -, *, /, (, ), %, ^ (potência).
 */
export function evaluateExpression(expression: string): string | null {
  const normalizedExpression = normalizeInputValue(expression)

  if (!normalizedExpression) return null
  if (!/^[0-9+\-*/().\s%^]+$/.test(normalizedExpression)) return null

  const executableExpression = normalizedExpression.replace(/\^/g, '**')

  try {
    const rawValue = Function(`"use strict"; return (${executableExpression})`)()
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return null

    const roundedValue = Math.round(rawValue * 100000000) / 100000000
    return String(roundedValue)
  } catch {
    return null
  }
}
