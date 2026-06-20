/**
 * InlinePriceEditor.tsx
 *
 * Componente focado para edição inline de cotação de um ativo.
 * Antes duplicado em AssetsTable (desktop) e AssetCardMobile.
 */
import Input from '@/components/Input'
import IconButton from '@/components/IconButton'
import Button from '@/components/Button'
import { Check, X } from 'lucide-react'

interface InlinePriceEditorProps {
  ticker: string
  value: string
  saving: boolean
  /** Variante de renderização: 'table' = ícones compactos, 'card' = botões com label */
  variant?: 'table' | 'card'
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}

export default function InlinePriceEditor({
  ticker,
  value,
  saving,
  variant = 'table',
  onChange,
  onSave,
  onCancel,
}: InlinePriceEditorProps) {
  if (variant === 'card') {
    return (
      <div className="p-3 bg-balance/5 border border-balance/20 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <span className="text-[9px] uppercase font-extrabold text-secondary block mb-1.5">
          Atualizar Preço ({ticker})
        </span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave()
              if (e.key === 'Escape') onCancel()
            }}
            disabled={saving}
            className="flex-1 !py-1.5 !px-3 text-xs !border-balance font-mono h-9"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost-success"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="h-9 px-3 font-semibold text-xs"
          >
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost-danger"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className="h-9 px-3 font-semibold text-xs"
          >
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  // variant === 'table'
  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        disabled={saving}
        className="!w-20 !py-0.5 !px-1.5 text-xs text-right !border-balance font-mono"
        autoFocus
      />
      <IconButton
        type="button"
        variant="success"
        size="sm"
        icon={<Check size={12} />}
        label="Salvar"
        onClick={onSave}
        disabled={saving}
        className="!rounded"
      />
      <IconButton
        type="button"
        variant="danger"
        size="sm"
        icon={<X size={12} />}
        label="Cancelar"
        onClick={onCancel}
        disabled={saving}
        className="!rounded"
      />
    </div>
  )
}
