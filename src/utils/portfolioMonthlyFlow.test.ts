import { describe, expect, it } from 'vitest'
import {
  portfolioInvestmentByDay,
  sumPortfolioTransactionsForMonth,
  transactionInvestmentAmount,
} from './portfolioMonthlyFlow'

describe('transactionInvestmentAmount', () => {
  it('soma compras e subscrições', () => {
    expect(transactionInvestmentAmount('buy', 10, 5)).toBe(50)
    expect(transactionInvestmentAmount('subscription', 2, 100)).toBe(200)
  })

  it('subtrai vendas e proventos', () => {
    expect(transactionInvestmentAmount('sell', 10, 5)).toBe(-50)
    expect(transactionInvestmentAmount('dividend', 1, 30)).toBe(-30)
  })

  it('ignora desdobramento', () => {
    expect(transactionInvestmentAmount('split', 2, 10)).toBe(0)
  })
})

describe('sumPortfolioTransactionsForMonth', () => {
  it('considera apenas transações do mês pela data', () => {
    const total = sumPortfolioTransactionsForMonth(
      [
        { date: '2026-05-10', operation_type: 'buy', quantity: 10, price: 20 },
        { date: '2026-04-28', operation_type: 'buy', quantity: 1, price: 1000 },
        { date: '2026-05-15', operation_type: 'sell', quantity: 5, price: 22 },
      ],
      '2026-05'
    )
    expect(total).toBe(200 - 110)
  })
})

describe('portfolioInvestmentByDay', () => {
  it('distribui por dia do mês', () => {
    const byDay = portfolioInvestmentByDay(
      [{ date: '2026-05-03', operation_type: 'buy', quantity: 2, price: 50 }],
      '2026-05',
      31
    )
    expect(byDay[2]).toBe(100)
    expect(byDay[0]).toBe(0)
  })
})
