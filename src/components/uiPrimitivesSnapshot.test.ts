/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Card from '@/components/Card'
import Modal from '@/components/Modal'
import ModalFooter from '@/components/ModalFooter'
import GlassChoiceCard from '@/components/GlassChoiceCard'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import ModalInfoPanel from '@/components/ModalInfoPanel'
import ModalSummaryPanel from '@/components/ModalSummaryPanel'
import Checkbox from '@/components/Checkbox'
import ConfirmModal from '@/components/ConfirmModal'
import { TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

describe('UI primitives snapshots', () => {
  it('Button variants render consistently', () => {
    const { container } = render(
      createElement('div', { className: 'space-y-2' },
        createElement(Button, { variant: 'primary', children: 'Primário' }),
        createElement(Button, { variant: 'outline', children: 'Outline' }),
        createElement(Button, { variant: 'danger', size: 'sm', children: 'Danger' }),
        createElement(Button, { variant: 'income', size: 'sm', children: 'Renda' }),
        createElement(Button, { variant: 'expense', size: 'sm', children: 'Despesa' }),
        createElement(Button, { variant: 'success', size: 'sm', children: 'Sucesso' }),
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

  it('ModalFooter renders with delete action consistently (mobile icons)', () => {
    const { container } = render(
      createElement('form', null,
        createElement(ModalFooter, {
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

  it('GlassChoiceCard renders consistently', () => {
    const { container } = render(
      createElement(GlassChoiceCard, {
        label: 'Renda',
        icon: createElement(TrendingUp, { size: 24 }),
        intent: 'income',
        onClick: vi.fn(),
      }),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('ModalIntro center alignment renders consistently', () => {
    const { container } = render(
      createElement(ModalIntro, { align: 'center', children: 'Escolha o tipo de lançamento.' }),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('ModalChoiceGrid with GlassChoiceCard renders consistently', () => {
    const { container } = render(
      createElement(ModalChoiceGrid, null,
        createElement(GlassChoiceCard, {
          label: 'Renda',
          icon: createElement(TrendingUp, { size: 24 }),
          intent: 'income',
          onClick: vi.fn(),
        }),
        createElement(GlassChoiceCard, {
          label: 'Despesa',
          icon: createElement(TrendingDown, { size: 24 }),
          intent: 'expense',
          onClick: vi.fn(),
        }),
        createElement(GlassChoiceCard, {
          label: 'Investimento',
          icon: createElement(PiggyBank, { size: 24 }),
          intent: 'balance',
          onClick: vi.fn(),
        }),
      ),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('ModalInfoPanel with Checkbox renders consistently', () => {
    const { container } = render(
      createElement(ModalInfoPanel, null,
        createElement(Checkbox, {
          label: 'Vinculado à B3',
          description: 'Sincroniza a cotação do ativo automaticamente a mercado',
          checked: true,
          onChange: vi.fn(),
        }),
      ),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('ModalSummaryPanel balance intent renders consistently', () => {
    const { container } = render(
      createElement(ModalSummaryPanel, {
        title: 'Cálculo de Aporte com Caixa',
        intent: 'balance',
        rows: [
          { label: 'Valor do Aporte:', value: 'R$ 355,00' },
          { label: '(-) Saldo em Caixa:', value: 'R$ 642,50', valueClassName: 'text-balance' },
        ],
        total: { label: 'Aporte Líquido:', value: 'R$ 0,00' },
        note: 'O saldo em caixa cobre integralmente este aporte.',
      }),
    )

    expect(container.firstChild).toMatchSnapshot()
  })

  it('ConfirmModal hybrid layout renders consistently', () => {
    render(
      createElement(ConfirmModal, {
        isOpen: true,
        onClose: vi.fn(),
        title: 'Excluir categoria',
        confirmLabel: 'Confirmar exclusão',
        onConfirm: vi.fn(),
        children: createElement('p', null, 'Tem certeza que deseja excluir?'),
      }),
    )

    expect(document.body).toMatchSnapshot()
  })
})
