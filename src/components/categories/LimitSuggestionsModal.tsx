import React, { useState, useEffect } from 'react'
import Input from '@/components/Input'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'

interface LimitSuggestionsModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (suggestions: Record<string, number>) => void
  initialSuggestions: Record<string, number>
}

export default function LimitSuggestionsModal({
  isOpen,
  onClose,
  onSubmit,
  initialSuggestions,
}: LimitSuggestionsModalProps) {
  const [suggestionsForm, setSuggestionsForm] = useState(initialSuggestions)

  // Sync state when modal opens or initialSuggestions changes
  useEffect(() => {
    if (isOpen) {
      setSuggestionsForm(initialSuggestions)
    }
  }, [isOpen, initialSuggestions])

  const totalSum =
    (suggestionsForm.moradia || 0) +
    (suggestionsForm.alimentacao || 0) +
    (suggestionsForm.transporte || 0) +
    (suggestionsForm.saude || 0) +
    (suggestionsForm.educacao || 0) +
    (suggestionsForm.lazer || 0) +
    (suggestionsForm.compras || 0) +
    (suggestionsForm.outros || 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(suggestionsForm)
  }

  const handleValueChange = (key: string, val: string) => {
    const num = Number(val)
    setSuggestionsForm((prev) => ({
      ...prev,
      [key]: Number.isNaN(num) ? 0 : num,
    }))
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Ajustar Sugestões de Limites"
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Salvar Sugestões"
        />
      )}
    >
      <div className="space-y-4">
        <p className="text-xs text-secondary">
          Personalize as porcentagens de recomendação com base na sua renda média. A soma recomendada é de 100%, mas você pode configurar como preferir.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Moradia (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.moradia}
            onChange={(e) => handleValueChange('moradia', e.target.value)}
            required
          />
          <Input
            label="Alimentação (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.alimentacao}
            onChange={(e) => handleValueChange('alimentacao', e.target.value)}
            required
          />
          <Input
            label="Transporte (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.transporte}
            onChange={(e) => handleValueChange('transporte', e.target.value)}
            required
          />
          <Input
            label="Saúde (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.saude}
            onChange={(e) => handleValueChange('saude', e.target.value)}
            required
          />
          <Input
            label="Educação (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.educacao}
            onChange={(e) => handleValueChange('educacao', e.target.value)}
            required
          />
          <Input
            label="Lazer (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.lazer}
            onChange={(e) => handleValueChange('lazer', e.target.value)}
            required
          />
          <Input
            label="Compras (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.compras}
            onChange={(e) => handleValueChange('compras', e.target.value)}
            required
          />
          <Input
            label="Outros (%)"
            type="number"
            min="0"
            max="100"
            value={suggestionsForm.outros}
            onChange={(e) => handleValueChange('outros', e.target.value)}
            required
          />
        </div>

        <div className="pt-3 border-t border-glass flex justify-between items-center text-xs">
          <span className="text-secondary font-bold">Soma das Sugestões:</span>
          <span
            className={`font-mono font-bold text-sm ${
              totalSum === 100 ? 'text-income' : 'text-warning'
            }`}
          >
            {totalSum}%
          </span>
        </div>
      </div>
    </ModalForm>
  )
}
