import { useCallback } from 'react'
import { parseMoneyInput } from '@/utils/format'

interface UseFormAmountSyncOptions {
  /** Valor atual do campo amount no formData */
  amount: string
  /** Valor atual do campo report_amount no formData */
  reportAmount: string
  /** Callback para atualizar ambos os campos de uma vez */
  setAmounts: (next: { amount: string; report_amount: string }) => void
}

interface UseFormAmountSyncReturn {
  /**
   * Handler para mudança do campo `amount`.
   * Sincroniza automaticamente `report_amount` enquanto os dois valores forem iguais.
   * Assim que o usuário editar `report_amount` separadamente, a sincronização é interrompida.
   */
  handleAmountChange: (nextAmount: string) => void
}

/**
 * Hook que encapsula a lógica de sincronização entre os campos `amount` e `report_amount`
 * compartilhada entre ExpenseFormModal e IncomeFormModal.
 *
 * Regra de sincronização:
 * - Enquanto `report_amount === amount` (ou `report_amount` estiver vazio), os dois se movem juntos.
 * - Assim que o usuário altera `report_amount` para um valor diferente de `amount`, a sincronização é suspensa.
 *
 * A formatação no blur e o cálculo de `report_weight` são delegados ao componente `AmountInput`
 * e ao caller, mantendo o hook focado exclusivamente na sincronização.
 */
export function useFormAmountSync({
  amount,
  reportAmount,
  setAmounts,
}: UseFormAmountSyncOptions): UseFormAmountSyncReturn {
  const handleAmountChange = useCallback(
    (nextAmount: string) => {
      const prevAmount = parseMoneyInput(amount)
      const prevReportAmount = parseMoneyInput(reportAmount)

      const shouldSyncReportAmount =
        !reportAmount ||
        (!Number.isNaN(prevAmount) &&
          !Number.isNaN(prevReportAmount) &&
          Math.abs(prevReportAmount - prevAmount) < 0.009)

      setAmounts({
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : reportAmount,
      })
    },
    [amount, reportAmount, setAmounts]
  )

  return { handleAmountChange }
}
