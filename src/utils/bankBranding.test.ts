import { describe, expect, it } from 'vitest'
import {
  BANK_CARD_SCRIM,
  DEFAULT_BRAND_COLOR,
  getBankBrandColor,
  resolveCardColor,
} from '@/utils/bankBranding'

describe('getBankBrandColor', () => {
  it('mapeia Nubank (roxo institucional)', () => {
    expect(getBankBrandColor('Nubank')).toBe('#820ad1')
  })

  it('mapeia Inter (laranja)', () => {
    expect(getBankBrandColor('Banco Inter')).toBe('#ff7a00')
  })

  it('mapeia Itaú ignorando acento', () => {
    expect(getBankBrandColor('Itaú')).toBe('#2d5ee6')
    expect(getBankBrandColor('Itau')).toBe('#2d5ee6')
  })

  it('mapeia C6 (chumbo)', () => {
    expect(getBankBrandColor('C6 Bank')).toBe('#8a94a6')
  })

  it('retorna null para nome desconhecido', () => {
    expect(getBankBrandColor('Meu Cartão')).toBeNull()
  })

  it('retorna null para nome vazio', () => {
    expect(getBankBrandColor('')).toBeNull()
    expect(getBankBrandColor(null as unknown as string)).toBeNull()
  })
})

describe('resolveCardColor', () => {
  it('prefere a cor escolhida pelo usuário', () => {
    expect(resolveCardColor('Nubank', '#123456')).toBe('#123456')
  })

  it('cai para a cor de marca quando o usuário não escolheu', () => {
    expect(resolveCardColor('Nubank', null)).toBe('#820ad1')
    expect(resolveCardColor('Itaú', '')).toBe('#2d5ee6')
  })

  it('cai para o padrão quando não há marca nem escolha', () => {
    expect(resolveCardColor('Cartão X', null)).toBe(DEFAULT_BRAND_COLOR)
  })
})

describe('BANK_CARD_SCRIM', () => {
  it('é um gradiente linear com escurecimento', () => {
    expect(BANK_CARD_SCRIM).toContain('linear-gradient')
    expect(BANK_CARD_SCRIM).toContain('rgba(0, 0, 0, 0.55)')
  })
})
