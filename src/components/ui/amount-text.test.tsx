/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AmountText from '@/components/ui/amount-text'

describe('AmountText', () => {
  it('renderiza valor BRL formatado com classes padrão (snapshot)', () => {
    const { container } = render(<AmountText value={248.5} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('formata BRL com 2 casas decimais', () => {
    render(<AmountText value={6250} />)
    expect(screen.getByText(/R\$\s*6\.250,00/)).toBeTruthy()
  })

  it('formata USD quando informado', () => {
    render(<AmountText value={1250} currency="USD" />)
    expect(screen.getByText(/US\$\s*1\.250,00/)).toBeTruthy()
  })

  it('formata valores negativos', () => {
    render(<AmountText value={-2840} tone="expense" />)
    expect(screen.getByText(/-R\$\s*2\.840,00/)).toBeTruthy()
  })

  it('prefixa + quando forceSign e valor positivo', () => {
    render(<AmountText value={5000} forceSign tone="income" />)
    expect(screen.getByText(/\+R\$\s*5\.000,00/)).toBeTruthy()
  })

  it('aplica tone e peso (classes utilitárias)', () => {
    const { container } = render(<AmountText value={10} tone="income" weight="extrabold" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('text-income')
    expect(el.className).toContain('font-extrabold')
    expect(el.className).toContain('tabular-nums')
  })

  it('renderiza zero', () => {
    render(<AmountText value={0} />)
    expect(screen.getByText(/R\$\s*0,00/)).toBeTruthy()
  })
})
