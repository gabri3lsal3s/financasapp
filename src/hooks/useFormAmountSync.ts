import { useCallback } from 'react'

interface UseFormAmountSyncOptions {
  /** Valor atual do campo amount no formData (numérico) */
  amount: number
  /** Valor atual do campo report_amount no formData (numérico ou null) */
  reportAmount: number | null
  /** Callback para atualizar ambos os campos de uma vez */
  setAmounts: (next: { amount: number; report_amount: number | null }) => void
}

interface UseFormAmountSyncReturn {
  /**
   * Handler para mudança do campo `amount`.
   * Sincroniza automaticamente `report_amount` apenas se reportAmount for numérico e igual ao amount anterior.
   * Se reportAmount for null (vazio) ou 0/customizado, não altera report_amount.
   */
  handleAmountChange: (nextAmount: number) => void
}

export function useFormAmountSync({
  amount,
  reportAmount,
  setAmounts,
}: UseFormAmountSyncOptions): UseFormAmountSyncReturn {
  const handleAmountChange = useCallback(
    (nextAmount: number) => {
      // Sincroniza report_amount se for numérico e igual ao amount anterior (±1 centavo)
      const shouldSyncReportAmount =
        typeof reportAmount === 'number' &&
        Math.abs(reportAmount - amount) < 0.009

      setAmounts({
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : reportAmount,
      })
    },
    [amount, reportAmount, setAmounts]
  )

  return { handleAmountChange }
}

