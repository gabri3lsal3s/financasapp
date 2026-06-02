import { describe, it, expect } from 'vitest'
import { guardMarketPrice } from '@/services/priceService'

describe('guardMarketPrice', () => {
  it('rejeita variação acima de 50% e mantém último preço', () => {
    const { price, rejectedSpike } = guardMarketPrice(20, 10)
    expect(rejectedSpike).toBe(true)
    expect(price).toBe(10)
  })

  it('aceita variação moderada', () => {
    const { price, rejectedSpike } = guardMarketPrice(11, 10)
    expect(rejectedSpike).toBe(false)
    expect(price).toBe(11)
  })
})
