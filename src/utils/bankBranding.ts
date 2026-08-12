/**
 * Branding institucional de bancos — fonte única de cores de marca (DRY).
 *
 * Usado em cartões de crédito (Contas) e widgets do Dashboard. A cor escolhida
 * manualmente pelo usuário (`card.color`) SEMPRE tem precedência sobre a marca;
 * a marca só entra como fallback inteligente por nome da instituição.
 */

interface BrandColorRule {
  match: RegExp
  color: string
}

const BRAND_COLOR_RULES: BrandColorRule[] = [
  { match: /nubank/i, color: '#820ad1' },
  { match: /inter\b|banco inter/i, color: '#ff7a00' },
  { match: /ita[uú]/i, color: '#2d5ee6' },
  { match: /c6\b/i, color: '#8a94a6' },
  { match: /bradesco/i, color: '#cc092f' },
  { match: /santander/i, color: '#ec0000' },
  { match: /caixa|cef\b/i, color: '#005ca9' },
  { match: /brasil|bb\b/i, color: '#fedd00' },
  { match: /will\b/i, color: '#111827' },
  { match: /picpay|pic pay/i, color: '#21c25e' },
  { match: /neon\b/i, color: '#2f2fd8' },
  { match: /mercado\s?pago/i, color: '#00a1e9' },
  { match: /wise|transferwise/i, color: '#0f2027' },
  { match: /revolut/i, color: '#191c1f' },
  { match: /cora\b/i, color: '#ff7a1a' },
  { match: /xp\b/i, color: '#141414' },
]

/** Cor padrão quando o nome não corresponde a nenhuma instituição conhecida. */
export const DEFAULT_BRAND_COLOR = '#3b82f6'

/**
 * Overlay de contraste para cartões com cores claras (ex.: BB amarelo).
 * Garante texto legível (≥ 4.5:1) sobre qualquer cor de instituição.
 */
export const BANK_CARD_SCRIM = 'linear-gradient(160deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0.55) 100%)'

/**
 * Resolve a cor de marca de uma instituição pelo nome do cartão.
 * Retorna `null` quando não há correspondência (o chamador decide o fallback).
 */
export function getBankBrandColor(cardName: string): string | null {
  const normalized = String(cardName || '').trim()
  if (!normalized) return null

  for (const rule of BRAND_COLOR_RULES) {
    if (rule.match.test(normalized)) return rule.color
  }

  return null
}

/**
 * Cor efetiva de um cartão: preferência do usuário → cor de marca → padrão.
 */
export function resolveCardColor(cardName: string, userColor?: string | null): string {
  if (userColor) return userColor
  return getBankBrandColor(cardName) ?? DEFAULT_BRAND_COLOR
}
