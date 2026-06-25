/**
 * investmentExcelReconciliation.ts — BARREL / RE-EXPORT
 *
 * Este arquivo existia como um monolito de ~770 linhas. Foi dividido em três módulos:
 *
 *   - b3ExcelParser.ts              → parseB3Excel, parseB3PositionExcel, classify*, normalize*, etc.
 *   - investmentReconciliation.ts    → scoreInvestmentMatch, reconcileInvestmentTransactions
 *   - positionValidation.ts          → buildPositionValidation, suggestPositionAdjustments, computePositionsFromB3Items
 *
 * Todas as exportações originais são mantidas via re-export para compatibilidade.
 */

export type {
  B3AssetCategory,
  B3MovementCategory,
  B3ParseDedupeStats,
  B3ParseResult,
  B3TransactionItem,
  B3FieldKey,
  B3PositionParseResult,
} from './b3ExcelParser'

export {
  isB3SubscriptionRightsTicker,
  classifyB3Item,
  classifyB3Movement,
  parseB3Product,
  mapB3OperationType,
  parseB3Date,
  parseNumericValue,
  deduplicateB3Items,
  parseB3Excel,
  parseB3PositionExcel,
  isB3PositionWorkbook,
} from './b3ExcelParser'

export type {
  InvestmentReconciliationConflict,
  InvestmentReconciliationResult,
} from './investmentReconciliation'

export {
  scoreInvestmentMatch,
  reconcileInvestmentTransactions,
} from './investmentReconciliation'

export type {
  PositionValidationStatus,
  PositionValidationRow,
  PositionValidationResult,
  PositionAdjustmentSuggestion,
  PositionAdjustmentOptions,
} from './positionValidation'

export {
  buildPositionValidation,
  suggestPositionAdjustments,
  computePositionsFromB3Items,
} from './positionValidation'
