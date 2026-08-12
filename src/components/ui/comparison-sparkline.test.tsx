/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import ComparisonSparkline from '@/components/ui/comparison-sparkline'

describe('ComparisonSparkline', () => {
  it('renderiza linha atual sólida + anterior pontilhada quando há comparação', () => {
    const { container } = render(
      <ComparisonSparkline data={[1, 3, 2]} compareData={[2, 2, 3]} ariaLabel="teste" />,
    )
    const paths = container.querySelectorAll('svg path')
    // 1 área + 1 anterior + 1 atual
    expect(paths.length).toBe(3)
    expect(container.querySelectorAll('path[stroke-dasharray]').length).toBe(1)
  })

  it('fallback para linha única sem histórico anterior', () => {
    const { container } = render(<ComparisonSparkline data={[1, 3, 2]} />)
    const paths = container.querySelectorAll('svg path')
    expect(paths.length).toBe(2) // 1 área + 1 atual
    expect(container.querySelectorAll('path[stroke-dasharray]').length).toBe(0)
  })

  it('retorna null quando não há dados atuais', () => {
    const { container } = render(<ComparisonSparkline data={[]} compareData={[1, 2]} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('expõe aria-label acessível', () => {
    const { container } = render(
      <ComparisonSparkline data={[1, 2, 3]} ariaLabel="Fluxo mensal" />,
    )
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Fluxo mensal')
  })
})
