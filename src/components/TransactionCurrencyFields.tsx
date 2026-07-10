import { useCallback } from 'react'
import CurrencyInput from '@/components/CurrencyInput'
import { useFormAmountSync } from '@/hooks/useFormAmountSync'

interface TransactionCurrencyFieldsProps {
  amount: number
  reportAmount: number
  /** Atualiza amount e report_amount no formData do pai (valores numéricos) */
  onSetAmounts: (next: { amount: number; report_amount: number }) => void
  /** Efeito colateral quando o amount muda (ex: sync linkedDebt no ExpenseForm) */
  onAmountChanged?: (nextAmount: number) => void
}

/**
 * Par de campos Valor + Valor no relatório com sincronização automática.
 *
 * Versão numérica que substitui TransactionAmountFields, usando CurrencyInput
 * com máscara reversa (estilo Nubank) em vez de AmountInput.
 *
 * Enquanto report_amount ≈ amount, os dois se movem juntos.
 * Assim que o usuário edita report_amount separadamente, a sincronização é suspensa.
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
    (_e: React.ChangeEvent<HTMLInputElement>, numericValue: number) => {
      handleAmountChange(numericValue)
      onAmountChanged?.(numericValue)
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
