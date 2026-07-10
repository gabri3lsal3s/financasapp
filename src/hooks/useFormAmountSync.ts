import { useCallback } from 'react'

interface UseFormAmountSyncOptions {
  /** Valor atual do campo amount no formData (numérico) */
  amount: number
  /** Valor atual do campo report_amount no formData (numérico) */
  reportAmount: number
  /** Callback para atualizar ambos os campos de uma vez */
  setAmounts: (next: { amount: number; report_amount: number }) => void
}

interface UseFormAmountSyncReturn {
  /**
   * Handler para mudança do campo `amount`.
   * Sincroniza automaticamente `report_amount` enquanto os dois valores forem iguais.
   * Assim que o usuário editar `report_amount` separadamente, a sincronização é interrompida.
   */
  handleAmountChange: (nextAmount: number) => void
}

/**
 * Hook que encapsula a lógica de sincronização entre os campos `amount` e `report_amount`
 * compartilhada entre ExpenseFormModal e IncomeFormModal.
 *
 * Agora trabalha com valores numéricos (não strings formatadas), pois o CurrencyInput
 * já entrega o valor limpo.
 *
 * Regra de sincronização:
 * - Enquanto `report_amount === amount` (ou `report_amount` for 0), os dois se movem juntos.
 * - Assim que o usuário altera `report_amount` para um valor diferente de `amount`, a sincronização é suspensa.
 * - Uma vez suspensa, permanece suspensa até o usuário redefinir `report_amount`.
 */
export function useFormAmountSync({
  amount,
  reportAmount,
  setAmounts,
}: UseFormAmountSyncOptions): UseFormAmountSyncReturn {
  const handleAmountChange = useCallback(
    (nextAmount: number) => {
      // Se report_amount for 0 (vazio/não definido), sincroniza
      // Se report_amount for igual ao amount anterior (±1 centavo), sincroniza
      const shouldSyncReportAmount =
        reportAmount === 0 ||
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

