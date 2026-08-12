import type { BillExpenseItem } from '@/utils/creditCardBilling'
import type {
  InstallmentAnalysis,
  OfficialInvoiceItem,
  ReconciliationResult,
} from '@/utils/creditCardCsvReconciliation'

// ─── Tipos de draft (estado do wizard) ────────────────────────────────────────

export interface CategoryOption {
  id: string
  name: string
}

export interface MissingDraft {
  id: string
  selected: boolean
  date: string
  amount: string
  description: string
  category_id: string
  learnedSuggestion: {
    enabled: boolean
    confidence?: number
  }
  possibleExistingMatch?: {
    id: string
    date: string
    amount: number
    description: string
    paymentMethod: string
    creditCardId: string
    wrongDate: boolean
    wrongPaymentMethod: boolean
  } | null
  official: OfficialInvoiceItem
}

export interface ConflictDraft {
  key: string
  existingId: string
  officialId: string
  selected: boolean
  applied: boolean
  autoResolvedByInstallment: boolean
  date: string
  amount: string
  existingDescription: string
  officialDescription: string
  installmentLabel?: string
  isRefund: boolean
  installmentAnalysis?: InstallmentAnalysis | null
}

export type ComparisonRow = {
  key: string
  official: OfficialInvoiceItem
  current: BillExpenseItem | null
  status: 'conciliado' | 'conflitante' | 'faltando'
}

export type ReconciliationWizardStep =
  | 'upload'
  | 'summary'
  | 'conflicts'
  | 'missing'
  | 'suspicious'
  | 'review'

export const WIZARD_STEPS: ReconciliationWizardStep[] = [
  'upload',
  'summary',
  'conflicts',
  'missing',
  'suspicious',
  'review',
]

export const REVIEW_STEPS: ReconciliationWizardStep[] = [
  'summary',
  'conflicts',
  'missing',
  'suspicious',
  'review',
]

// ─── Helpers de data e texto ──────────────────────────────────────────────────

export const monthIndex = (date: string) => {
  const [year, month] = String(date || '').slice(0, 7).split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0
  return year * 12 + month
}

export const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T12:00:00`)
  if (!Number.isFinite(parsed.getTime())) return date
  parsed.setDate(parsed.getDate() + days)
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const similarity = (left: string, right: string) => {
  const leftTokens = new Set(normalizeText(left).split(' ').filter((token) => token.length >= 3))
  const rightTokens = new Set(normalizeText(right).split(' ').filter((token) => token.length >= 3))
  if (!leftTokens.size || !rightTokens.size) return 0

  let intersection = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1
  })

  const union = new Set([...leftTokens, ...rightTokens]).size
  if (!union) return 0
  return intersection / union
}

export const installmentLabel = (item: { installmentNumber: number | null; installmentTotal: number | null }) => {
  if (!item.installmentNumber || !item.installmentTotal) return ''
  return `Parcela ${item.installmentNumber}/${item.installmentTotal}`
}

export const buildConflictKey = (existingId: string, officialId: string) => `${existingId}::${officialId}`

// ─── Memos derivados compartilhados ───────────────────────────────────────────

export const buildComparisonRows = (
  reconciliation: ReconciliationResult | null,
): ComparisonRow[] => {
  if (!reconciliation) return []

  const rows: ComparisonRow[] = [
    ...reconciliation.matched.map((item) => ({
      key: `matched-${item.official.id}-${item.existing.id}`,
      official: item.official,
      current: item.existing,
      status: 'conciliado' as const,
    })),
    ...reconciliation.conflicts.map((item) => ({
      key: `conflict-${item.official.id}-${item.existing.id}`,
      official: item.official,
      current: item.existing,
      status: 'conflitante' as const,
    })),
    ...reconciliation.missing.map((item) => ({
      key: `missing-${item.id}`,
      official: item,
      current: null,
      status: 'faltando' as const,
    })),
  ]

  return rows.sort((a, b) => {
    const dateDiff = b.official.date.localeCompare(a.official.date)
    if (dateDiff !== 0) return dateDiff
    return Math.abs(Number(b.official.amount || 0)) - Math.abs(Number(a.official.amount || 0))
  })
}
