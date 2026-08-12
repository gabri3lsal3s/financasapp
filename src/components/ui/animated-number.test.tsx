/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import AnimatedNumber from '@/components/ui/animated-number'

describe('AnimatedNumber', () => {
  it('formata o valor final com formatNumberBR (pt-BR)', () => {
    const { getByText } = render(
      <AnimatedNumber value={1234.5} formatOptions={{ maximumFractionDigits: 1 }} />
    )
    expect(getByText('1.234,5')).toBeTruthy()
  })

  it('formata valores inteiros por padrão', () => {
    const { getByText } = render(<AnimatedNumber value={42} />)
    expect(getByText('42')).toBeTruthy()
  })

  it('aceita formatter customizado', () => {
    const { getByText } = render(
      <AnimatedNumber value={99} format={(n) => `${Math.round(n)}%`} />
    )
    expect(getByText('99%')).toBeTruthy()
  })

  it('respeita prefers-reduced-motion (valor direto, sem animação)', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMediaMock)

    const { getByText } = render(<AnimatedNumber value={77} />)
    expect(getByText('77')).toBeTruthy()

    vi.unstubAllGlobals()
  })

  it('usa font-mono tabular para evitar layout shift', () => {
    const { container } = render(<AnimatedNumber value={10} />)
    const span = container.querySelector('span')
    expect(span?.className).toContain('font-mono')
    expect(span?.className).toContain('tabular-nums')
  })
})
