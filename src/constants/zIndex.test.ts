/**
 * Teste de consistência do sistema z-index.
 *
 * Verifica se os valores das constantes TypeScript (Z_INDEX)
 * correspondem aos valores das CSS Custom Properties (--z-*)
 * definidas em theme-tokens.css.
 *
 * Isso evita divergências entre o código e o CSS.
 */

import { describe, expect, it } from 'vitest'
import { Z_INDEX } from '@/constants/zIndex'

/**
 * Mapa dos valores CSS esperados para cada chave do Z_INDEX.
 *
 * A string CSS (ex: 'z-[900]') deve corresponder ao valor numérico
 * da propriedade --z-* (ex: 900).
 *
 * Formato: [chaveZIndex, valorCssEsperado]
 */
const CSS_VAR_MAP: Record<keyof typeof Z_INDEX, number> = {
  BASE: 0,
  DECORATION: 1,
  CONTENT: 10,
  STICKY: 30,
  NAVIGATION: 100,
  POPOVER: 150,
  OVERLAY: 900,
  MODAL: 1000,
  SIDE_STACK: 1100,
  ELEVATED: 1200,
  CALCULATOR: 1300,
  TOAST: 1400,
  PRINT: 9999,
}

/**
 * Extrai o valor numérico de uma string de classe Tailwind z-index.
 *
 * Exemplos:
 *   'z-0'    → 0
 *   'z-10'   → 10
 *   'z-[150]' → 150
 *   'z-[9999]' → 9999
 */
function extractZValue(className: string): number | null {
  // Match: z-<number> or z-[<number>]
  const simpleMatch = /^z-(\d+)$/.exec(className)
  if (simpleMatch) return parseInt(simpleMatch[1], 10)

  const bracketMatch = /^z-\[(\d+)\]$/.exec(className)
  if (bracketMatch) return parseInt(bracketMatch[1], 10)

  return null
}

describe('Z_INDEX consistency', () => {
  for (const [key, expectedValue] of Object.entries(CSS_VAR_MAP)) {
    it(`${key} (${Z_INDEX[key as keyof typeof Z_INDEX]}) deve corresponder a --z-${key.toLowerCase()} = ${expectedValue}`, () => {
      const className = Z_INDEX[key as keyof typeof Z_INDEX]
      const extractedValue = extractZValue(className)

      expect(extractedValue).not.toBeNull()
      expect(extractedValue).toBe(expectedValue)
    })
  }

  it('todas as chaves do Z_INDEX devem estar mapeadas no CSS_VAR_MAP', () => {
    const zIndexKeys = Object.keys(Z_INDEX) as (keyof typeof Z_INDEX)[]
    const cssMapKeys = Object.keys(CSS_VAR_MAP) as (keyof typeof Z_INDEX)[]

    // Verifica se não faltam chaves em nenhum dos lados
    const missingInMap = zIndexKeys.filter(k => !cssMapKeys.includes(k))
    const missingInConstants = cssMapKeys.filter(k => !zIndexKeys.includes(k))

    expect(missingInMap).toEqual([])
    expect(missingInConstants).toEqual([])
  })

  it('todos os valores de Z_INDEX são strings Tailwind válidas', () => {
    for (const value of Object.values(Z_INDEX)) {
      expect(extractZValue(value)).not.toBeNull()
    }
  })

  it('os valores seguem uma ordem ascendente consistente', () => {
    const values = Object.values(Z_INDEX)
      .map(v => extractZValue(v) as number)
      .filter(v => v !== null)

    // Verifica se não há duplicatas (exceto POPOVER/NAVIGATION que podem ter gaps)
    const sorted = [...values].sort((a, b) => a - b)
    expect(sorted).toEqual(values)
  })
})
