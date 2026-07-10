/**
 * Valor ponderado para relatórios (snapshot via report_weight no registro).
 */
export const getWeightedReportAmount = (
  amount: number,
  reportWeight?: number | null,
): number => {
  const base = Number(amount)
  if (!Number.isFinite(base)) return 0

  const weight = reportWeight ?? 1
  const safeWeight = Number.isFinite(weight) ? weight : 1

  return base * safeWeight
}

export const computeReportWeightFromAmounts = (
  reportAmount: number,
  baseAmount: number,
): number => {
  if (!Number.isFinite(baseAmount) || baseAmount === 0) return 1
  const ratio = reportAmount / baseAmount
  return Number.isFinite(ratio) ? Number(ratio.toFixed(4)) : 1
}

export type BillRowWithWeight = {
  amount: number
  report_weight?: number | null
  base_amount?: number
}

/** Aplica peso de relatório na linha da fatura (mantém base_amount para auditoria). */
export const applyReportWeightToBillRow = <T extends BillRowWithWeight>(
  row: T,
  weightsEnabled: boolean,
): T & { base_amount: number } => {
  const baseAmount = Number(row.amount || 0)

  if (!weightsEnabled) {
    return { ...row, amount: baseAmount, base_amount: baseAmount }
  }

  const weighted = getWeightedReportAmount(baseAmount, row.report_weight)
  return {
    ...row,
    amount: Number(weighted.toFixed(2)),
    base_amount: baseAmount,
  }
}

/**
 * Alias para getWeightedReportAmount — usado no Dashboard e hooks afins.
 * Aplica o report_weight a um valor monetário.
 * Se reportWeight não for informado, retorna o valor original.
 */
export const applyReportWeight = getWeightedReportAmount
