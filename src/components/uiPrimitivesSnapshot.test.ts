/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import ModalActionFooter from '@/components/ModalActionFooter'

describe('UI primitives snapshots', () => {
  it('Button variants render consistently', () => {
    const { container } = render(
      createElement('div', { className: 'space-y-2' },
        createElement(Button, { variant: 'primary', children: 'Primário' }),
        createElement(Button, { variant: 'outline', children: 'Outline' }),
        createElement(Button, { variant: 'danger', size: 'sm', children: 'Danger' }),
      ),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('Input renders label and error state consistently', () => {
    const { container } = render(
      createElement(Input, {
        label: 'Valor',
        value: '1.000,00',
        onChange: vi.fn(),
        error: 'Campo obrigatório',
      }),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('Select renders options and error state consistently', () => {
    const { container } = render(
      createElement(Select, {
        label: 'Categoria',
        value: 'alimentacao',
        onChange: vi.fn(),
        options: [
          { value: 'alimentacao', label: 'Alimentação' },
          { value: 'transporte', label: 'Transporte' },
        ],
        error: 'Selecione uma categoria',
      }),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('Card renders clickable state consistently', () => {
    const { container } = render(
      createElement(Card, { onClick: vi.fn(), children: createElement('p', null, 'Conteúdo do card') }),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('Modal open state renders consistently', () => {
    render(
      createElement(Modal, {
        isOpen: true,
        onClose: vi.fn(),
        title: 'Editar lançamento',
        children: createElement('div', null, createElement('p', null, 'Conteúdo do modal')),
      }),
    )

    expect(document.body).toMatchSnapshot()
  })

  it('PageHeader renders title, subtitle and action consistently', () => {
    const { container } = render(
      createElement(PageHeader, {
        title: 'Relatórios',
        subtitle: 'Resumo anual e mensal',
        action: createElement(Button, { size: 'sm', children: 'Exportar' }),
      }),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('ModalActionFooter renders with delete action consistently', () => {
    const { container } = render(
      createElement('form', null,
        createElement(ModalActionFooter, {
          onCancel: vi.fn(),
          submitLabel: 'Salvar alterações',
          submitDisabled: true,
          deleteLabel: 'Excluir item',
          onDelete: vi.fn(),
        }),
      ),
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})
