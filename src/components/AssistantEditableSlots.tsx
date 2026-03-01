import Input from '@/components/Input'
import Select from '@/components/Select'
import { formatMoneyInput, parseMoneyInput } from '@/utils/format'
import type { AssistantIntent, AssistantResolvedCategory, AssistantSlots } from '@/types'

interface CategoryOption {
  id: string
  name: string
}

interface AssistantEditableSlotsProps {
  editableSlots: AssistantSlots | null
  intent: AssistantIntent
  categories: CategoryOption[]
  incomeCategories: CategoryOption[]
  disabled: boolean
  fallbackMonth?: string
  onUpdate: (updater: (previous: AssistantSlots) => AssistantSlots) => void
}

const resolveSingleTransactionType = (slots: AssistantSlots | null, intent: AssistantIntent): 'expense' | 'income' | 'investment' => {
  if (slots?.transactionType) return slots.transactionType
  if (intent === 'add_investment') return 'investment'
  if (intent === 'add_income') return 'income'
  return 'expense'
}

export default function AssistantEditableSlots({
  editableSlots,
  intent,
  categories,
  incomeCategories,
  disabled,
  fallbackMonth,
  onUpdate,
}: AssistantEditableSlotsProps) {
  const setSlotCategory = (categoryId: string, transactionType: 'expense' | 'income') => {
    if (!categoryId) {
      onUpdate((previous) => ({ ...previous, category: undefined }))
      return
    }

    const sourceList = transactionType === 'expense' ? categories : incomeCategories
    const selected = sourceList.find((item) => item.id === categoryId)
    if (!selected) return

    const categoryPayload: AssistantResolvedCategory = {
      id: selected.id,
      name: selected.name,
      confidence: 0.99,
      source: 'name_match',
    }

    onUpdate((previous) => ({ ...previous, category: categoryPayload }))
  }

  const setItemCategory = (index: number, categoryId: string, transactionType: 'expense' | 'income') => {
    if (!categoryId) {
      onUpdate((previous) => ({
        ...previous,
        items: (previous.items || []).map((item, itemIndex) => (
          itemIndex === index
            ? { ...item, category: undefined }
            : item
        )),
      }))
      return
    }

    const sourceList = transactionType === 'expense' ? categories : incomeCategories
    const selected = sourceList.find((item) => item.id === categoryId)
    if (!selected) return

    const categoryPayload: AssistantResolvedCategory = {
      id: selected.id,
      name: selected.name,
      confidence: 0.99,
      source: 'name_match',
    }

    onUpdate((previous) => ({
      ...previous,
      items: (previous.items || []).map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, category: categoryPayload }
          : item
      )),
    }))
  }

  if ((editableSlots?.items?.length || 0) > 0) {
    return (
      <div className="space-y-3">
        {(editableSlots?.items || []).map((item, index) => {
          const transactionType = item.transactionType || 'expense'
          const reportAmount = item.amount > 0 && Number.isFinite(item.report_weight)
            ? item.amount * Number(item.report_weight)
            : item.amount

          return (
            <div key={`assistant-item-${index}`} className="rounded-md border border-primary bg-tertiary p-3 space-y-2">
              <p className="text-xs font-medium text-secondary">Lançamento {index + 1}</p>

              <Select
                label="Tipo"
                value={transactionType}
                onChange={(event) => {
                  const nextType = event.target.value as 'expense' | 'income' | 'investment'
                  onUpdate((previous) => ({
                    ...previous,
                    items: (previous.items || []).map((currentItem, itemIndex) => (
                      itemIndex === index
                        ? {
                          ...currentItem,
                          transactionType: nextType,
                          category: nextType === 'investment' ? undefined : currentItem.category,
                        }
                        : currentItem
                    )),
                  }))
                }}
                options={[
                  { value: 'expense', label: 'Despesa' },
                  { value: 'income', label: 'Renda' },
                  { value: 'investment', label: 'Investimento' },
                ]}
                disabled={disabled}
              />

              <Input
                label="Descrição"
                value={item.description || ''}
                onChange={(event) => {
                  const value = event.target.value
                  onUpdate((previous) => ({
                    ...previous,
                    items: (previous.items || []).map((currentItem, itemIndex) => (
                      itemIndex === index
                        ? { ...currentItem, description: value }
                        : currentItem
                    )),
                  }))
                }}
                disabled={disabled}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  label="Valor"
                  type="text"
                  inputMode="decimal"
                  value={formatMoneyInput(Number(item.amount || 0))}
                  onChange={(event) => {
                    const parsed = parseMoneyInput(event.target.value)
                    if (Number.isNaN(parsed)) return
                    onUpdate((previous) => ({
                      ...previous,
                      items: (previous.items || []).map((currentItem, itemIndex) => (
                        itemIndex === index
                          ? { ...currentItem, amount: parsed }
                          : currentItem
                      )),
                    }))
                  }}
                  disabled={disabled}
                />

                {transactionType === 'expense' && (
                  <Input
                    label="Parcelas"
                    type="number"
                    min="1"
                    max="60"
                    value={String(item.installment_count || 1)}
                    onChange={(event) => {
                      const parsed = Number(event.target.value)
                      if (!Number.isInteger(parsed) || parsed < 1) return
                      onUpdate((previous) => ({
                        ...previous,
                        items: (previous.items || []).map((currentItem, itemIndex) => (
                          itemIndex === index
                            ? { ...currentItem, installment_count: Math.min(60, parsed) }
                            : currentItem
                        )),
                      }))
                    }}
                    disabled={disabled}
                  />
                )}

                {transactionType !== 'investment' && (
                  <Input
                    label="Valor no relatório"
                    type="text"
                    inputMode="decimal"
                    value={formatMoneyInput(Number(reportAmount || 0))}
                    onChange={(event) => {
                      const parsed = parseMoneyInput(event.target.value)
                      if (Number.isNaN(parsed) || !item.amount || item.amount <= 0) return
                      const reportWeight = Math.min(1, Math.max(0, Number((parsed / item.amount).toFixed(4))))
                      onUpdate((previous) => ({
                        ...previous,
                        items: (previous.items || []).map((currentItem, itemIndex) => (
                          itemIndex === index
                            ? { ...currentItem, report_weight: reportWeight }
                            : currentItem
                        )),
                      }))
                    }}
                    disabled={disabled}
                  />
                )}
              </div>

              {transactionType === 'expense' && (
                <Select
                  label="Categoria"
                  value={item.category?.id || ''}
                  onChange={(event) => setItemCategory(index, event.target.value, 'expense')}
                  options={[{ value: '', label: 'Selecionar categoria' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
                  disabled={disabled}
                />
              )}

              {transactionType === 'income' && (
                <Select
                  label="Categoria de renda"
                  value={item.category?.id || ''}
                  onChange={(event) => setItemCategory(index, event.target.value, 'income')}
                  options={[{ value: '', label: 'Selecionar categoria' }, ...incomeCategories.map((category) => ({ value: category.id, label: category.name }))]}
                  disabled={disabled}
                />
              )}

              {transactionType === 'investment' ? (
                <Input
                  label="Mês"
                  type="month"
                  value={item.month || editableSlots?.month || ''}
                  onChange={(event) => {
                    const value = event.target.value
                    onUpdate((previous) => ({
                      ...previous,
                      items: (previous.items || []).map((currentItem, itemIndex) => (
                        itemIndex === index
                          ? { ...currentItem, month: value }
                          : currentItem
                      )),
                    }))
                  }}
                  disabled={disabled}
                />
              ) : (
                <Input
                  label="Data"
                  type="date"
                  value={item.date || editableSlots?.date || ''}
                  onChange={(event) => {
                    const value = event.target.value
                    onUpdate((previous) => ({
                      ...previous,
                      items: (previous.items || []).map((currentItem, itemIndex) => (
                        itemIndex === index
                          ? { ...currentItem, date: value }
                          : currentItem
                      )),
                    }))
                  }}
                  disabled={disabled}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const singleTransactionType = resolveSingleTransactionType(editableSlots, intent)

  return (
    <>
      <Select
        label="Tipo"
        value={singleTransactionType}
        onChange={(event) => {
          const nextType = event.target.value as 'expense' | 'income' | 'investment'
          onUpdate((previous) => {
            const fallbackMonthValue = fallbackMonth || new Date().toISOString().slice(0, 7)
            const nextMonth = previous.month || previous.date?.substring(0, 7) || fallbackMonthValue
            const nextDate = previous.date || `${nextMonth}-01`

            return {
              ...previous,
              transactionType: nextType,
              category: nextType === 'investment' ? undefined : previous.category,
              date: nextType === 'investment' ? previous.date : nextDate,
              month: nextType === 'investment' ? nextMonth : previous.month,
            }
          })
        }}
        options={[
          { value: 'expense', label: 'Despesa' },
          { value: 'income', label: 'Renda' },
          { value: 'investment', label: 'Investimento' },
        ]}
        disabled={disabled}
      />

      <Input
        label="Descrição"
        value={editableSlots?.description || ''}
        onChange={(event) => onUpdate((previous) => ({ ...previous, description: event.target.value }))}
        disabled={disabled}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          label="Valor"
          type="text"
          inputMode="decimal"
          value={formatMoneyInput(Number(editableSlots?.amount || 0))}
          onChange={(event) => {
            const parsed = parseMoneyInput(event.target.value)
            if (Number.isNaN(parsed)) return
            onUpdate((previous) => ({ ...previous, amount: parsed }))
          }}
          disabled={disabled}
        />

        {singleTransactionType === 'expense' && (
          <Input
            label="Parcelas"
            type="number"
            min="1"
            max="60"
            value={String(editableSlots?.installment_count || 1)}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (!Number.isInteger(parsed) || parsed < 1) return
              onUpdate((previous) => ({ ...previous, installment_count: Math.min(60, parsed) }))
            }}
            disabled={disabled}
          />
        )}

        {singleTransactionType === 'investment' ? (
          <Input
            label="Mês"
            type="month"
            value={editableSlots?.month || ''}
            onChange={(event) => onUpdate((previous) => ({ ...previous, month: event.target.value }))}
            disabled={disabled}
          />
        ) : (
          <Input
            label="Data"
            type="date"
            value={editableSlots?.date || ''}
            onChange={(event) => onUpdate((previous) => ({ ...previous, date: event.target.value }))}
            disabled={disabled}
          />
        )}
      </div>

      {singleTransactionType === 'expense' && (
        <Select
          label="Categoria"
          value={editableSlots?.category?.id || ''}
          onChange={(event) => setSlotCategory(event.target.value, 'expense')}
          options={[{ value: '', label: 'Selecionar categoria' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
          disabled={disabled}
        />
      )}

      {singleTransactionType === 'income' && (
        <Select
          label="Categoria de renda"
          value={editableSlots?.category?.id || ''}
          onChange={(event) => setSlotCategory(event.target.value, 'income')}
          options={[{ value: '', label: 'Selecionar categoria' }, ...incomeCategories.map((category) => ({ value: category.id, label: category.name }))]}
          disabled={disabled}
        />
      )}
    </>
  )
}
