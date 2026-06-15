import React, { useEffect, useState } from 'react'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Button from '@/components/Button'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import { Check } from 'lucide-react'
import { AVAILABLE_ICONS } from '@/utils/categoryIcons'
import {
  DEFAULT_CATEGORY_COLOR_HEX,
  VIVID_COLORS,
  generateCategoryColor,
} from '@/utils/categoryColors'
import type { Category, IncomeCategory } from '@/types'

// Duplicate functions from Categories.tsx to maintain standalone modal behavior
function detectSuggestionRuleFromName(name: string): string {
  const normalized = name.toLowerCase().trim()

  if (
    normalized.includes('morad') ||
    normalized.includes('casa') ||
    normalized.includes('aluguel') ||
    normalized.includes('condominio')
  ) {
    return 'moradia'
  }

  if (
    normalized.includes('aliment') ||
    normalized.includes('comer') ||
    normalized.includes('restaurante') ||
    normalized.includes('supermercado') ||
    normalized.includes('mercado')
  ) {
    return 'alimentacao'
  }

  if (
    normalized.includes('transp') ||
    normalized.includes('carro') ||
    normalized.includes('combustivel') ||
    normalized.includes('gasolina') ||
    normalized.includes('uber')
  ) {
    return 'transporte'
  }

  if (
    normalized.includes('saude') ||
    normalized.includes('medico') ||
    normalized.includes('remedio') ||
    normalized.includes('farmacia') ||
    normalized.includes('hospital')
  ) {
    return 'saude'
  }

  if (
    normalized.includes('educa') ||
    normalized.includes('escola') ||
    normalized.includes('faculdade') ||
    normalized.includes('curso')
  ) {
    return 'educacao'
  }

  if (
    normalized.includes('lazer') ||
    normalized.includes('cinema') ||
    normalized.includes('show') ||
    normalized.includes('festa') ||
    normalized.includes('bar') ||
    normalized.includes('netflix') ||
    normalized.includes('spotify') ||
    normalized.includes('academia')
  ) {
    return 'lazer'
  }

  if (
    normalized.includes('compra') ||
    normalized.includes('vestuario') ||
    normalized.includes('roupa') ||
    normalized.includes('shopping')
  ) {
    return 'compras'
  }

  return 'outros'
}

function getCategoryIconName(name: string): string {
  const normalized = name.toLowerCase().trim()

  if (
    normalized.includes('mercado') ||
    normalized.includes('supermercado') ||
    normalized.includes('feira') ||
    normalized.includes('aliment') ||
    normalized.includes('comer') ||
    normalized.includes('restaurante') ||
    normalized.includes('lanche') ||
    normalized.includes('pizz') ||
    normalized.includes('ifood')
  ) {
    return 'Utensils'
  }

  if (
    normalized.includes('aluguel') ||
    normalized.includes('casa') ||
    normalized.includes('morad') ||
    normalized.includes('condominio') ||
    normalized.includes('luz') ||
    normalized.includes('energia') ||
    normalized.includes('agua') ||
    normalized.includes('gas') ||
    normalized.includes('internet')
  ) {
    return 'Home'
  }

  if (
    normalized.includes('bus') ||
    normalized.includes('metr') ||
    normalized.includes('transp') ||
    normalized.includes('passagem') ||
    normalized.includes('viagem') ||
    normalized.includes('uber') ||
    normalized.includes('taxi') ||
    normalized.includes('carro') ||
    normalized.includes('moto') ||
    normalized.includes('combustivel') ||
    normalized.includes('gasolina')
  ) {
    return 'Car'
  }

  if (
    normalized.includes('farmacia') ||
    normalized.includes('remedio') ||
    normalized.includes('saude') ||
    normalized.includes('medico') ||
    normalized.includes('dentista') ||
    normalized.includes('consulta') ||
    normalized.includes('exame') ||
    normalized.includes('hospital') ||
    normalized.includes('plano')
  ) {
    return 'HeartPulse'
  }

  if (
    normalized.includes('escola') ||
    normalized.includes('faculdade') ||
    normalized.includes('curso') ||
    normalized.includes('livro') ||
    normalized.includes('educa') ||
    normalized.includes('mensalidade') ||
    normalized.includes('estudo')
  ) {
    return 'GraduationCap'
  }

  if (
    normalized.includes('cinema') ||
    normalized.includes('show') ||
    normalized.includes('lazer') ||
    normalized.includes('festa') ||
    normalized.includes('bar') ||
    normalized.includes('cerveja') ||
    normalized.includes('balada') ||
    normalized.includes('netflix') ||
    normalized.includes('spotify') ||
    normalized.includes('jogo') ||
    normalized.includes('game') ||
    normalized.includes('academia') ||
    normalized.includes('esporte') ||
    normalized.includes('clube')
  ) {
    return 'Sparkles'
  }

  if (
    normalized.includes('compra') ||
    normalized.includes('vestuario') ||
    normalized.includes('roupa') ||
    normalized.includes('sapato') ||
    normalized.includes('shopping') ||
    normalized.includes('presente') ||
    normalized.includes('eletronico') ||
    normalized.includes('celular')
  ) {
    return 'ShoppingBag'
  }

  if (
    normalized.includes('salario') ||
    normalized.includes('rendimento') ||
    normalized.includes('receita') ||
    normalized.includes('provento') ||
    normalized.includes('dividendos') ||
    normalized.includes('reembolso') ||
    normalized.includes('pix') ||
    normalized.includes('ted') ||
    normalized.includes('estorno')
  ) {
    return 'TrendingUp'
  }

  return 'Tag'
}

interface CategoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, combinedColor: string) => Promise<void>
  editingCategory: Category | IncomeCategory | null
  tabType: 'expenses' | 'incomes'
  loading?: boolean
}

export default function CategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingCategory,
  tabType,
  loading = false,
}: CategoryFormModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR_HEX)
  const [icon, setIcon] = useState('Tag')
  const [suggestion, setSuggestion] = useState('outros')

  const [userCustomizedColor, setUserCustomizedColor] = useState(false)
  const [userCustomizedIcon, setUserCustomizedIcon] = useState(false)
  const [userCustomizedSuggestion, setUserCustomizedSuggestion] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingCategory) {
        const [colorPart, iconPart, suggestionPart] = editingCategory.color
          ? editingCategory.color.split('|')
          : []
        setName(editingCategory.name)
        setColor(colorPart || DEFAULT_CATEGORY_COLOR_HEX)
        setIcon(iconPart || 'Tag')
        setSuggestion(
          suggestionPart || detectSuggestionRuleFromName(editingCategory.name)
        )
        setUserCustomizedColor(true)
        setUserCustomizedIcon(true)
        setUserCustomizedSuggestion(true)
      } else {
        setName('')
        setColor(DEFAULT_CATEGORY_COLOR_HEX)
        setIcon('Tag')
        setSuggestion('outros')
        setUserCustomizedColor(false)
        setUserCustomizedIcon(false)
        setUserCustomizedSuggestion(false)
      }
    }
  }, [isOpen, editingCategory])

  // Intelligent defaults based on entered name
  useEffect(() => {
    if (isOpen && !editingCategory && name.trim()) {
      const updates: { icon?: string; color?: string; suggestion?: string } = {}

      if (!userCustomizedIcon) {
        updates.icon = getCategoryIconName(name)
      }

      if (!userCustomizedColor) {
        const generatedColorVar = generateCategoryColor(name, 'vivid')
        const match = generatedColorVar.match(/vivid-(\d+)/)
        if (match && match[1]) {
          const index = parseInt(match[1])
          const hex = VIVID_COLORS[index]
          if (hex) {
            updates.color = hex
          }
        }
      }

      if (!userCustomizedSuggestion) {
        updates.suggestion = detectSuggestionRuleFromName(name)
      }

      if (updates.icon) setIcon(updates.icon)
      if (updates.color) setColor(updates.color)
      if (updates.suggestion) setSuggestion(updates.suggestion)
    }
  }, [
    name,
    isOpen,
    editingCategory,
    userCustomizedColor,
    userCustomizedIcon,
    userCustomizedSuggestion,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const combinedColor =
      tabType === 'expenses'
        ? `${color}|${icon}|${suggestion}`
        : `${color}|${icon}`

    await onSubmit(name.trim(), combinedColor)
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingCategory
          ? tabType === 'expenses'
            ? 'Editar categoria'
            : 'Editar categoria de renda'
          : tabType === 'expenses'
          ? 'Adicionar categoria'
          : 'Adicionar categoria de renda'
      }
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={editingCategory ? 'Salvar alterações' : 'Salvar'}
          submitDisabled={loading}
        />
      )}
    >
      <div className="space-y-4 text-left">
        <Input
          label="Nome da Categoria"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Alimentação, Transporte, Salário..."
          required
          autoFocus
        />

        {tabType === 'expenses' && (
          <Select
            label="Grupo de Sugestão de Limite"
            value={suggestion}
            onChange={(e) => {
              setSuggestion(e.target.value)
              setUserCustomizedSuggestion(true)
            }}
            options={[
              { value: 'moradia', label: 'Moradia' },
              { value: 'alimentacao', label: 'Alimentação' },
              { value: 'transporte', label: 'Transporte' },
              { value: 'saude', label: 'Saúde' },
              { value: 'educacao', label: 'Educação' },
              { value: 'lazer', label: 'Lazer' },
              { value: 'compras', label: 'Compras' },
              { value: 'outros', label: 'Outros' },
            ]}
          />
        )}

        {/* Icon Picker */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">
            Selecione o Ícone
          </span>
          <div className="grid grid-cols-7 gap-2 max-h-36 overflow-y-auto p-1 border border-glass rounded-xl surface-glass scrollbar-thin">
            {Object.entries(AVAILABLE_ICONS).map(([key, Icon]) => {
              const isSelected = icon === key
              return (
                <Button
                  key={key}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIcon(key)
                    setUserCustomizedIcon(true)
                  }}
                  className={`flex items-center justify-center p-2 h-auto w-auto rounded-lg transition-all border ${
                    isSelected
                      ? 'border-primary text-primary scale-105 shadow-sm'
                      : 'border-transparent text-secondary hover:bg-secondary hover:bg-opacity-10 hover:text-primary'
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: 'color-mix(in srgb, var(--color-text-secondary) 25%, transparent)' }
                      : undefined
                  }
                  title={key}
                >
                  <Icon size={16} />
                </Button>
              )
            })}
          </div>
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">
            Selecione a Cor
          </span>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 p-1.5 border border-glass rounded-xl surface-glass justify-items-center">
            {VIVID_COLORS.map((colorHex) => {
              const isSelected = color === colorHex
              return (
                <Button
                  key={colorHex}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setColor(colorHex)
                    setUserCustomizedColor(true)
                  }}
                  style={{ backgroundColor: colorHex }}
                  className={`h-6 w-6 p-0 rounded-full flex items-center justify-center border-2 transition-all relative min-w-0 ${
                    isSelected
                      ? 'border-white scale-110 shadow-[0_0_8px_rgba(0,0,0,0.15)] ring-2 ring-primary/45 hover:bg-transparent'
                      : 'border-transparent hover:scale-105 hover:bg-transparent'
                  }`}
                  title={colorHex}
                >
                  {isSelected && (
                    <Check
                      size={10}
                      className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                    />
                  )}
                  </Button>
                )
              })}
          </div>
        </div>
      </div>
    </ModalForm>
  )
}
