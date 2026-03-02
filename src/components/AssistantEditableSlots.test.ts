import { describe, expect, it } from 'vitest'
import { assistantEditableSlotsInternals } from '@/components/AssistantEditableSlots'

describe('AssistantEditableSlots - resolução de categoria no select', () => {
  const sourceList = [
    { id: 'cat-1', name: 'Compras' },
    { id: 'cat-2', name: 'Alimentação' },
    { id: 'cat-3', name: 'Transporte' },
  ]

  it('usa o id informado quando ele existe na lista', () => {
    const resolved = assistantEditableSlotsInternals.resolveCategoryIdForSelect(
      { id: 'cat-3', name: 'Transporte', confidence: 0.9, source: 'name_match' },
      sourceList,
    )

    expect(resolved).toBe('cat-3')
  })

  it('faz fallback por nome quando o id não vem preenchido', () => {
    const resolved = assistantEditableSlotsInternals.resolveCategoryIdForSelect(
      { name: 'Compras', confidence: 0.9, source: 'keyword' },
      sourceList,
    )

    expect(resolved).toBe('cat-1')
  })

  it('faz fallback por nome ignorando acentos e caixa', () => {
    const resolved = assistantEditableSlotsInternals.resolveCategoryIdForSelect(
      { name: 'alimentacao', confidence: 0.8, source: 'mapping' },
      sourceList,
    )

    expect(resolved).toBe('cat-2')
  })

  it('retorna vazio quando não encontra correspondência', () => {
    const resolved = assistantEditableSlotsInternals.resolveCategoryIdForSelect(
      { name: 'Categoria inexistente', confidence: 0.7, source: 'fallback_uncategorized' },
      sourceList,
    )

    expect(resolved).toBe('')
  })
})
