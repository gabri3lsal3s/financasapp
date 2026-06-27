import { useCallback } from 'react'
import AmountInput from '@/components/AmountInput'
import { useFormAmountSync } from '@/hooks/useFormAmountSync'

interface TransactionAmountFieldsProps {
  amount: string
  reportAmount: string
  /** Atualiza amount e report_amount no formData do pai */
  onSetAmounts: (next: { amount: string; report_amount: string }) => void
  /** Efeito colateral quando o amount muda (ex: sync linkedDebt no ExpenseForm) */
  onAmountChanged?: (nextAmount: string) => void
  /** Formatação adicional no blur do report_amount */
  onReportAmountBlur?: (formatted: string) => void
}

/**
 * Par de campos Valor + Valor no relatório com sincronização automática.
 *
 * Enquanto report_amount ≈ amount, os dois se movem juntos.
 * Assim que o usuário edita report_amount separadamente, a sincronização é suspensa.
 */
export default function TransactionAmountFields({
  amount,
  reportAmount,
  onSetAmounts,
  onAmountChanged,
  onReportAmountBlur,
}: TransactionAmountFieldsProps) {
  const { handleAmountChange } = useFormAmountSync({
    amount,
    reportAmount,
    setAmounts: onSetAmounts,
  })

  const handleAmountInputChange = useCallback(
    (next: string) => {
      handleAmountChange(next)
      onAmountChanged?.(next)
    },
    [handleAmountChange, onAmountChanged],
  )

  return (
    <>
      <AmountInput
        label="Valor"
        value={amount}
        onChange={handleAmountInputChange}
        required
      />

      <AmountInput
        label="Valor no relatório (opcional)"
        value={reportAmount}
        onChange={(val) => onSetAmounts({ amount, report_amount: val })}
        onBlur={onReportAmountBlur}
        placeholder="Se vazio, usa o valor total"
      />
    </>
  )
}
