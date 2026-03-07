import { describe, expect, it, vi } from 'vitest'
import {
  hasExplicitCreditCardsDeepLink,
  resolveInitialCreditCardsMonth,
  shiftMonth,
} from '@/utils/creditCardMonthSelection'

describe('creditCardMonthSelection', () => {
  it('avança para o próximo mês em aberto quando o mês atual está quitado', async () => {
    const hasPendingForMonth = vi.fn(async (month: string) => month === '2026-04')

    const month = await resolveInitialCreditCardsMonth({
      currentMonth: '2026-03',
      appStartMonth: '2026-01',
      hasPendingForMonth,
    })

    expect(month).toBe('2026-04')
  })

  it('mantém o mês pendente mais recente no passado quando existir débito anterior', async () => {
    const hasPendingForMonth = vi.fn(async (month: string) => month === '2026-02')

    const month = await resolveInitialCreditCardsMonth({
      currentMonth: '2026-03',
      appStartMonth: '2026-01',
      hasPendingForMonth,
    })

    expect(month).toBe('2026-02')
  })

  it('mantém mês atual quando já existe pendência nele', async () => {
    const hasPendingForMonth = vi.fn(async (month: string) => month === '2026-03')

    const month = await resolveInitialCreditCardsMonth({
      currentMonth: '2026-03',
      appStartMonth: '2026-01',
      hasPendingForMonth,
    })

    expect(month).toBe('2026-03')
  })

  it('não entra em loop no mês inicial da aplicação e mantém o atual sem pendências', async () => {
    const hasPendingForMonth = vi.fn(async () => false)

    const month = await resolveInitialCreditCardsMonth({
      currentMonth: '2026-01',
      appStartMonth: '2026-01',
      hasPendingForMonth,
    })

    expect(month).toBe('2026-01')
    expect(hasPendingForMonth).toHaveBeenCalledTimes(2)
    expect(hasPendingForMonth).toHaveBeenNthCalledWith(1, '2026-01')
    expect(hasPendingForMonth).toHaveBeenNthCalledWith(2, '2026-02')
  })

  it('não considera deep link quando month na URL é igual ao mês atual', () => {
    const params = new URLSearchParams('month=2026-03')

    const result = hasExplicitCreditCardsDeepLink(params, '2026-03')
    expect(result).toBe(false)
  })

  it('considera deep link explícito quando card ou month diferente estiver na URL', () => {
    const paramsWithCard = new URLSearchParams('card=card-1')
    const paramsWithDifferentMonth = new URLSearchParams('month=2026-04')

    expect(hasExplicitCreditCardsDeepLink(paramsWithCard, '2026-03')).toBe(true)
    expect(hasExplicitCreditCardsDeepLink(paramsWithDifferentMonth, '2026-03')).toBe(true)
  })

  it('desloca mês sem clamp para trás e para frente', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})
