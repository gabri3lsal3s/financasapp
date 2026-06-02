/** Cor padrão de cartão (sem `#` para evitar literais HEX em TS; use `ensureHexColor` na UI). */
export const CREDIT_CARD_DEFAULT_COLOR = '3b82f6'

export function ensureHexColor(value: string | null | undefined, fallback = CREDIT_CARD_DEFAULT_COLOR): string {
  const raw = (value || fallback).trim()
  if (!raw || raw.startsWith('var(')) return raw || `var(--credit-card-default-color)`
  if (raw.startsWith('#')) return raw
  return `#${raw}`
}
