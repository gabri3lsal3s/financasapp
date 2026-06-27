/**
 * Textos centralizados para InfoTooltip.
 * Mantém consistência e facilita manutenção.
 */
export const WEIGHT_TOOLTIPS = {
  /** Valor original vs. valor reportado (transação individual) */
  transactionValue:
    'Valor original do lançamento. O valor considerado nos relatórios pode ser diferente quando há ajuste de impacto (ex: despesa compartilhada).',

  /** Valor original (Dashboard, Categories) */
  baseValue:
    'Valor original do lançamento. O valor reportado pode ser diferente quando há ajuste de impacto (ex: despesa compartilhada).',

  /** Valor base no resumo do modal de detalhe */
  baseValueSummary:
    'Valor original dos lançamentos, sem ajustes. O valor exibido como total já considera os ajustes definidos.',

  /** Valor base no resumo com contexto de compartilhamento */
  baseValueSummaryShared:
    'Valor original dos lançamentos, sem ajustes. O valor exibido como total já considera os ajustes definidos (útil para despesas/rendas compartilhadas).',

  /** Valor original no modal de detalhe (item individual) */
  baseValueDetail:
    'Valor original do lançamento. O valor reportado pode ser diferente quando há ajuste de impacto.',

  /** Valor base em categorias de despesa */
  baseValueExpense:
    'Valor original, sem ajustes. O valor considerado nos relatórios aplica o ajuste definido para cada lançamento — útil para despesas compartilhadas.',

  /** Valor base em categorias de renda */
  baseValueIncome:
    'Valor original, sem ajustes. O valor considerado nos relatórios aplica o ajuste definido para cada recebimento — útil para rendas compartilhadas.',

  /** Valor ponderado em linha de despesa da fatura */
  billRowWeight:
    'Valor que esta despesa representa nos relatórios mensais. Pode ser diferente do valor real quando o lançamento tem impacto parcial (ex: conta dividida com outra pessoa).',

  /** Valor da fatura nos relatórios */
  billReportValue:
    'Valor que esta fatura representa nos relatórios mensais. O valor real da fatura permanece o mesmo — o ajuste é apenas para organização financeira.',

  /** Valor real da fatura (header) */
  billActualValue:
    'Valor real da fatura, sem ajustes. O valor considerado nos relatórios pode ser diferente conforme os ajustes definidos em cada lançamento.',
} as const

export const INVESTMENT_TOOLTIPS = {
  twrMethod:
    'A rentabilidade (cota) é calculada pelo método TWR (Time Weighted Return), medindo o retorno da carteira investida de forma isolada, desconsiderando entradas e saídas de saldo em caixa da corretora. O valor inicial da cota é base 1.00 (0.00%).',
} as const
