import AssistantEditableSlots from '@/components/AssistantEditableSlots'
import Button from '@/components/Button'
import Input from '@/components/Input'
import type { AssistantIntent, AssistantSlots } from '@/types'
import { Loader2 } from 'lucide-react'

interface CategoryOption {
  id: string
  name: string
}

interface AssistantConfirmationPanelProps {
  intent: AssistantIntent
  editableConfirmationText: string
  onEditableConfirmationTextChange: (value: string) => void
  editableSlots: AssistantSlots | null
  categories: CategoryOption[]
  incomeCategories: CategoryOption[]
  creditCards: Array<{ id: string; name: string }>
  disabled: boolean
  fallbackMonth?: string
  onUpdateSlots: (updater: (previous: AssistantSlots) => AssistantSlots) => void
  touchConfirmationEnabled: boolean
  voiceConfirmationEnabled: boolean
  actionColumnsClass: string
  onConfirm: () => void
  onDeny: () => void
  onVoiceConfirm: () => void
  voiceConfirmDisabled: boolean
  voiceListening: boolean
  containerClassName?: string
}

export default function AssistantConfirmationPanel({
  intent,
  editableConfirmationText,
  onEditableConfirmationTextChange,
  editableSlots,
  categories,
  incomeCategories,
  creditCards,
  disabled,
  fallbackMonth,
  onUpdateSlots,
  touchConfirmationEnabled,
  voiceConfirmationEnabled,
  actionColumnsClass,
  onConfirm,
  onDeny,
  onVoiceConfirm,
  voiceConfirmDisabled,
  voiceListening,
  containerClassName = 'space-y-3',
}: AssistantConfirmationPanelProps) {
  return (
    <div className={containerClassName}>
      <div className="rounded-lg border border-primary bg-primary p-3 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-secondary">Campos editáveis antes do lançamento</p>

        <Input
          label="Resumo da confirmação"
          value={editableConfirmationText}
          onChange={(event) => onEditableConfirmationTextChange(event.target.value)}
          disabled={disabled}
        />

        <AssistantEditableSlots
          editableSlots={editableSlots}
          intent={intent}
          categories={categories}
          incomeCategories={incomeCategories}
          creditCards={creditCards}
          disabled={disabled}
          fallbackMonth={fallbackMonth}
          onUpdate={onUpdateSlots}
        />
      </div>

      <div className={`grid grid-cols-1 gap-2 ${actionColumnsClass}`}>
        {touchConfirmationEnabled && (
          <>
            <Button
              onClick={onConfirm}
              disabled={disabled}
              fullWidth
            >
              Confirmar
            </Button>
            <Button
              onClick={onDeny}
              disabled={disabled}
              variant="outline"
              fullWidth
            >
              Negar
            </Button>
          </>
        )}
        {voiceConfirmationEnabled && (
          <Button
            onClick={onVoiceConfirm}
            disabled={voiceConfirmDisabled}
            variant="outline"
            fullWidth
          >
            {voiceListening ? (
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Ouvindo...</span>
              </div>
            ) : 'Confirmar por Voz'}
          </Button>
        )}
      </div>

    </div>
  )
}
