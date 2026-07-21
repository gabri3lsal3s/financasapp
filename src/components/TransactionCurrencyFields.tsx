import { useCallback } from 'react'
import CurrencyInput from '@/components/CurrencyInput'
import { useFormAmountSync } from '@/hooks/useFormAmountSync'

interface TransactionCurrencyFieldsProps {
  amount: number
  reportAmount: number | null
  /** Atualiza amount e report_amount no formData do pai (valores numéricos) */
  onSetAmounts: (next: { amount: number; report_amount: number | null }) => void
  /** Efeito colateral quando o amount muda (ex: sync linkedDebt no ExpenseForm) */
  onAmountChanged?: (nextAmount: number) => void
}

/**
 * Par de campos Valor + Valor no relatório com sincronização automática.
 *
 * Se reportAmount for null (vazio), o campo exibe o placeholder e usa o valor total.
 * Se reportAmount for 0, o campo exibe "R$ 0,00" e a despesa/renda é zerada no relatório.
 */
export default function TransactionCurrencyFields({
  amount,
  reportAmount,
  onSetAmounts,
  onAmountChanged,
}: TransactionCurrencyFieldsProps) {
  const { handleAmountChange } = useFormAmountSync({
    amount,
    reportAmount,
    setAmounts: onSetAmounts,
  })

  const handleAmountCurrencyChange = useCallback(
    (_e: React.ChangeEvent<HTMLInputElement>, numericValue: number | null) => {
      const nextVal = numericValue ?? 0
      handleAmountChange(nextVal)
      onAmountChanged?.(nextVal)
    },
    [handleAmountChange, onAmountChanged],
  )

  return (
    <>
      <CurrencyInput
        label="Valor"
        value={amount}
        onChange={handleAmountCurrencyChange}
        required
      />

      <CurrencyInput
        label="Valor no relatório (opcional)"
        value={reportAmount}
        onChange={(_e, val) => onSetAmounts({ amount, report_amount: val })}
        placeholder="Se vazio, usa o valor total"
      />
    </>
  )
}
