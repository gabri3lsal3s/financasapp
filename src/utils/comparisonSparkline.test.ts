import { describe, expect, it } from 'vitest'
import { accumulateSeries, buildSparklinePath } from '@/utils/comparisonSparkline'

describe('buildSparklinePath', () => {
  it('gera path com M inicial para série única', () => {
    const path = buildSparklinePath([10, 20, 30], 100, 40, 0, 30)
    expect(path).toMatch(/^M /)
    expect(path).toContain(' L ')
  })

  it('retorna vazio para série vazia', () => {
    expect(buildSparklinePath([], 100, 40, 0, 10)).toBe('')
  })

  it('centraliza ponto único', () => {
    const path = buildSparklinePath([15], 100, 40, 10, 20)
    expect(path).toContain('50.00')
  })
})

describe('accumulateSeries', () => {
  it('acumula valores em curva acumulada', () => {
    expect(accumulateSeries([10, 20, 5])).toEqual([10, 30, 35])
  })

  it('respeita a quantidade de casas decimais', () => {
    expect(accumulateSeries([0.1, 0.2, 0.3], 2)).toEqual([0.1, 0.3, 0.6])
  })

  it('retorna vazio para entrada vazia', () => {
    expect(accumulateSeries([])).toEqual([])
  })
})
