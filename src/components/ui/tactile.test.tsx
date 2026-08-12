/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TactilePress from '@/components/ui/tactile'

describe('TactilePress', () => {
  it('renderiza o conteúdo filho (snapshot)', () => {
    const { container } = render(
      <TactilePress className="rounded-xl">
        <span>Card clicável</span>
      </TactilePress>
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('propaga onClick para o elemento raiz', () => {
    const onClick = vi.fn()
    render(
      <TactilePress onClick={onClick}>
        <span>Clique aqui</span>
      </TactilePress>
    )
    fireEvent.click(screen.getByText('Clique aqui'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('aplica className personalizada e will-change-transform', () => {
    const { container } = render(
      <TactilePress className="my-custom-card">
        <span>Conteúdo</span>
      </TactilePress>
    )
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('will-change-transform')
    expect(el.className).toContain('my-custom-card')
  })
})
