import { useMemo, useRef, useState } from 'react'
import { addMonths, format } from 'date-fns'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { supabase } from '@/lib/supabase'
import type { CreditCard, Expense } from '@/types'
import type { BillExpenseItem } from '@/utils/creditCardBilling'
import {
  parseCreditCardInvoiceCsv,
  reconcileCreditCardBill,
  analyzeInstallments,
  calculateInvoiceTotals,
  type OfficialInvoiceItem,
  type ReconciliationResult,
  type InstallmentAnalysis,
  type InvoiceTotals,
} from '@/utils/creditCardCsvReconciliation'
import {
  learnFromCreditCardCsvInsertion,
  suggestFromCreditCardCsvLearning,
} from '@/utils/creditCardCsvLearning'
import { formatCurrency, formatDate, formatMoneyInput, parseMoneyInput } from '@/utils/format'

interface CategoryOption {
  id: string
  name: string
}

interface MissingDraft {
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

interface ConflictDraft {
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

type ComparisonRow = {
  key: string
  official: OfficialInvoiceItem
  current: BillExpenseItem | null
  status: 'conciliado' | 'conflitante' | 'faltando'
}

interface CreditCardCsvReconciliationPanelProps {
  card: CreditCard
  currentMonth: string
  paymentItems: Array<{
    id: string
    amount: number
    payment_date: string
    note?: string | null
  }>
  categories: CategoryOption[]
  onReloadBillData: () => Promise<void>
  createExpense: (expense: Omit<Expense, 'id' | 'created_at' | 'category' | 'credit_card'>) => Promise<{ data: Expense | null; error: string | null }>
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<{ data: Expense | null; error: string | null }>
  fetchReconciliationCandidates: (cardId: string, baseMonth: string) => Promise<BillExpenseItem[]>
}

const monthIndex = (date: string) => {
  const [year, month] = String(date || '').slice(0, 7).split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0
  return (year * 12) + month
}

const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T12:00:00`)
  if (!Number.isFinite(parsed.getTime())) return date
  parsed.setDate(parsed.getDate() + days)
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const similarity = (left: string, right: string) => {
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

const installmentLabel = (item: { installmentNumber: number | null; installmentTotal: number | null }) => {
  if (!item.installmentNumber || !item.installmentTotal) return ''
  return `Parcela ${item.installmentNumber}/${item.installmentTotal}`
}

const buildConflictKey = (existingId: string, officialId: string) => `${existingId}::${officialId}`

export default function CreditCardCsvReconciliationPanel({
  card,
  currentMonth,
  // paymentItems: _paymentItems,
  categories,
  onReloadBillData,
  createExpense,
  updateExpense,
  fetchReconciliationCandidates,
}: CreditCardCsvReconciliationPanelProps) {
  const [fileName, setFileName] = useState('')
  const [parseStatus, setParseStatus] = useState<string>('')
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null)
  const [missingDrafts, setMissingDrafts] = useState<MissingDraft[]>([])
  const [conflictDrafts, setConflictDrafts] = useState<ConflictDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [fixedSuspiciousIds, setFixedSuspiciousIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [filterTab, setFilterTab] = useState<'all' | 'missing' | 'conflicts' | 'matched'>('all')
  const [currentStep, setCurrentStep] = useState<'upload' | 'summary' | 'conflicts' | 'missing' | 'suspicious' | 'review'>('upload')

  const selectedMissingCount = useMemo(
    () => missingDrafts.filter((draft) => draft.selected).length,
    [missingDrafts],
  )

  const selectedConflictCount = useMemo(
    () => conflictDrafts.filter((draft) => draft.selected && !draft.applied).length,
    [conflictDrafts],
  )

  const draftByOfficialId = useMemo(() => {
    return missingDrafts.reduce<Record<string, MissingDraft>>((accumulator, draft) => {
      accumulator[draft.official.id] = draft
      return accumulator
    }, {})
  }, [missingDrafts])

  const comparisonRows = useMemo<ComparisonRow[]>(() => {
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
  }, [reconciliation])

  const filteredComparisonRows = useMemo(() => {
    if (filterTab === 'all') return comparisonRows
    if (filterTab === 'missing') return comparisonRows.filter((r) => r.status === 'faltando')
    if (filterTab === 'conflicts') return comparisonRows.filter((r) => r.status === 'conflitante')
    if (filterTab === 'matched') return comparisonRows.filter((r) => r.status === 'conciliado')
    return comparisonRows
  }, [comparisonRows, filterTab])

  const identifiedTotals = useMemo<InvoiceTotals | null>(() => {
    if (!reconciliation || !reconciliation.matched) return null
    return calculateInvoiceTotals(reconciliation, comparisonRows.map(r => r.official))
  }, [reconciliation, comparisonRows])

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    try {
      const parsed = parseCreditCardInvoiceCsv(text, 'auto')

      setFileName(file.name)
      setParseStatus('Lendo arquivo...')

      if (!parsed.supported) {
        setReconciliation(null)
        setMissingDrafts([])
        setConflictDrafts([])
        setParseStatus(parsed.reason || 'Arquivo não suportado para fatura de cartão de crédito.')
        return
      }

      // Buscamos itens na janela de 3 meses para garantir pareamento de estornos e erros de data
      const candidateItems = await fetchReconciliationCandidates(card.id, currentMonth)

      const result = reconcileCreditCardBill(parsed.items, candidateItems, currentMonth)
      setParseStatus('Buscando possíveis lançamentos duplicados...')

      let existingMatches: Record<string, MissingDraft['possibleExistingMatch']> = {}
      let conflictInstallmentAnalysis: Record<string, NonNullable<ConflictDraft['installmentAnalysis']>> = {}

      if (result.missing.length > 0) {
        const missingDates = result.missing.map((item) => item.date).sort()
        const minDate = missingDates[0]
        const maxDate = missingDates[missingDates.length - 1]
        const rangeStart = addDays(minDate, -180)
        const rangeEnd = addDays(maxDate, 180)

        const excludedCurrentIds = new Set<string>([
          ...result.matched.map((item) => String(item.existing.id || '')),
          ...result.conflicts.map((item) => String(item.existing.id || '')),
        ])

        const { data: nearbyRows } = await supabase
          .from('expenses')
          .select('id, amount, date, description, bill_competence, payment_method, credit_card_id')
          .gte('date', rangeStart)
          .lte('date', rangeEnd)

        const nearbyCandidates = (nearbyRows || [])
          .map((row) => ({
            id: String(row.id || ''),
            amount: Number(row.amount || 0),
            date: String(row.date || ''),
            description: String(row.description || ''),
            paymentMethod: String(row.payment_method || ''),
            creditCardId: String(row.credit_card_id || ''),
            billCompetence: String(row.bill_competence || ''),
          }))
          .filter((row) => row.id && !excludedCurrentIds.has(row.id))

        existingMatches = result.missing.reduce<Record<string, MissingDraft['possibleExistingMatch']>>((acc, missingItem) => {
          const officialAmount = Number(missingItem.amount || 0)

          const best = nearbyCandidates
            .filter((candidate) => {
              const amountDelta = Math.abs(Math.abs(candidate.amount) - Math.abs(officialAmount))
              if (amountDelta > 0.01) return false

              const descriptionScore = similarity(missingItem.description, candidate.description)
              return descriptionScore >= 0.2 || normalizeText(missingItem.description) === normalizeText(candidate.description)
            })
            .map((candidate) => {
              const monthOffset = monthIndex(candidate.date) - monthIndex(missingItem.date)
              const descriptionScore = similarity(missingItem.description, candidate.description)
              const wrongDate = candidate.date !== missingItem.date
              const wrongPaymentMethod = candidate.paymentMethod !== 'credit_card' || candidate.creditCardId !== card.id
              const score =
                (descriptionScore * 0.6) +
                (1 / (1 + Math.abs(monthOffset)) * 0.2) +
                (wrongPaymentMethod ? 0.15 : 0) +
                (wrongDate ? 0.05 : 0)

              return {
                ...candidate,
                wrongDate,
                wrongPaymentMethod,
                score,
              }
            })
            .filter((candidate) => candidate.wrongDate || candidate.wrongPaymentMethod)
            .sort((a, b) => b.score - a.score)[0]

          if (!best) {
            acc[missingItem.id] = null
            return acc
          }

          acc[missingItem.id] = {
            id: best.id,
            date: best.date,
            amount: best.amount,
            description: best.description,
            paymentMethod: best.paymentMethod,
            creditCardId: best.creditCardId,
            wrongDate: best.wrongDate,
            wrongPaymentMethod: best.wrongPaymentMethod,
          }

          return acc
        }, {})
      }

      const conflictsWithInstallments = result.conflicts.filter((conflict) =>
        Boolean(conflict.official.installmentNumber && conflict.official.installmentTotal),
      )

      if (conflictsWithInstallments.length > 0) {
        setParseStatus('Analisando parcelamentos anteriores...')
        const conflictDates = conflictsWithInstallments
          .flatMap((item) => [item.official.date, item.existing.date])
          .filter((value) => Boolean(value))
          .sort()
        const dateStart = addDays(conflictDates[0], -180)
        const dateEnd = addDays(conflictDates[conflictDates.length - 1], 180)

        const { data: installmentRows } = await supabase
          .from('expenses')
          .select('id, amount, date, description, installment_number, installment_total, payment_method, credit_card_id')
          .eq('payment_method', 'credit_card')
          .eq('credit_card_id', card.id)
          .gte('date', dateStart)
          .lte('date', dateEnd)

        const installmentCandidates = (installmentRows || []).map((row) => ({
          id: String(row.id || ''),
          amount: Math.abs(Number(row.amount || 0)),
          date: String(row.date || ''),
          description: String(row.description || ''),
          installmentNumber:
            row.installment_number === null || row.installment_number === undefined
              ? null
              : Number(row.installment_number),
          installmentTotal:
            row.installment_total === null || row.installment_total === undefined
              ? null
              : Number(row.installment_total),
        }))

        conflictInstallmentAnalysis = conflictsWithInstallments.reduce<Record<string, InstallmentAnalysis>>((acc, conflict) => {
          const key = buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || ''))

          const analysis = analyzeInstallments({
            officialItem: conflict.official,
            existingItem: conflict.existing,
            nearbyExpenses: installmentCandidates
          })

          acc[key] = analysis
          return acc
        }, {})
      }

      setReconciliation(result)
      setMissingDrafts(result.missing.map((item) => {
        const suggestion = suggestFromCreditCardCsvLearning(item.description)

        return {
          id: item.id,
          selected: true,
          date: item.date,
          amount: formatMoneyInput(Math.abs(Number(item.amount || 0))),
          description: suggestion?.description || item.description,
          category_id: suggestion?.categoryId || categories[0]?.id || '',
          learnedSuggestion: {
            enabled: Boolean(suggestion),
            confidence: suggestion?.confidence,
          },
          possibleExistingMatch: existingMatches[item.id] || null,
          official: item,
        }
      }))

      setConflictDrafts(result.conflicts.map((conflict) => ({
        key: buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || '')),
        existingId: String(conflict.existing.id || ''),
        officialId: String(conflict.official.id || ''),
        selected: false,
        applied: (() => {
          const key = buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || ''))
          const analysis = conflictInstallmentAnalysis[key]
          const amountDelta = Math.abs(
            Math.abs(Number(conflict.existing.base_amount ?? conflict.existing.amount ?? 0))
            - Math.abs(Number(conflict.suggestedUpdate.amount || 0)),
          )
          const isDateOnlyConflict = amountDelta <= 0.009 && conflict.existing.date !== conflict.suggestedUpdate.date
          const autoResolved = analysis?.status === 'consistent' && isDateOnlyConflict
          return autoResolved || !conflict.suggestedUpdate.needsUpdate
        })(),
        autoResolvedByInstallment: (() => {
          const key = buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || ''))
          const analysis = conflictInstallmentAnalysis[key]
          const amountDelta = Math.abs(
            Math.abs(Number(conflict.existing.base_amount ?? conflict.existing.amount ?? 0))
            - Math.abs(Number(conflict.suggestedUpdate.amount || 0)),
          )
          const isDateOnlyConflict = amountDelta <= 0.009 && conflict.existing.date !== conflict.suggestedUpdate.date
          return Boolean(analysis?.status === 'consistent' && isDateOnlyConflict)
        })(),
        date: conflict.suggestedUpdate.date,
        amount: formatMoneyInput(Math.abs(Number(conflict.suggestedUpdate.amount || 0))),
        existingDescription: String(conflict.existing.description || conflict.existing.category_name || 'Sem descrição'),
        officialDescription: String(conflict.official.description || ''),
        installmentLabel: conflict.suggestedUpdate.installmentLabel,
        isRefund: conflict.official.isRefund,
        installmentAnalysis: conflictInstallmentAnalysis[
          buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || ''))
        ] || null,
      })))

      setParseStatus('')
      setCurrentStep('summary')
    } catch (error) {
      console.error('Error in handleCsvUpload:', error)
      setParseStatus('Ocorreu um erro ao processar o arquivo. Tente novamente.')
    }
  }

  const handleApplySelectedSuggestions = async () => {
    const selectedMissing = missingDrafts.filter((draft) => draft.selected)
    const selectedConflicts = conflictDrafts.filter((draft) => draft.selected && !draft.applied)

    if (!selectedMissing.length && !selectedConflicts.length) {
      alert('Selecione ao menos uma sugestão para aplicar.')
      return
    }

    setLoading(true)
    try {
      for (const draft of selectedMissing) {
        const amount = parseMoneyInput(draft.amount)
        if (Number.isNaN(amount) || amount <= 0) {
          alert(`Valor inválido para o item: ${draft.description}`)
          continue
        }

        const signedAmount = draft.official.isRefund ? -Math.abs(amount) : amount
        const installment = installmentLabel(draft.official)
        const finalDescription = installment
          ? `${draft.description} (${installment})`
          : draft.description

        if (draft.possibleExistingMatch) {
          const updated = await updateExpense(draft.possibleExistingMatch.id, {
            amount: signedAmount,
            date: draft.date,
            payment_method: 'credit_card',
            credit_card_id: card.id,
          })

          if (updated.error) {
            alert(`Erro ao corrigir lançamento existente: ${updated.error}`)
            break
          }

          learnFromCreditCardCsvInsertion({
            officialDescription: draft.official.description,
            chosenDescription: finalDescription,
            chosenCategoryId: draft.category_id || categories[0]?.id || '',
          })

          continue
        }

        const created = await createExpense({
          amount: signedAmount,
          date: draft.date,
          category_id: draft.category_id || categories[0]?.id || '',
          payment_method: 'credit_card',
          credit_card_id: card.id,
          description: finalDescription,
          report_weight: 1,
          bill_competence: currentMonth,
        })

        if (created.error) {
          alert(`Erro ao incluir item em lote: ${created.error}`)
          break
        }

        learnFromCreditCardCsvInsertion({
          officialDescription: draft.official.description,
          chosenDescription: finalDescription,
          chosenCategoryId: draft.category_id || categories[0]?.id || '',
        })
      }

      if (reconciliation) {
        for (const draft of selectedConflicts) {
          const conflict = reconciliation.conflicts.find((item) =>
            buildConflictKey(String(item.existing.id || ''), String(item.official.id || '')) === draft.key,
          )

          if (!conflict || !conflict.suggestedUpdate.needsUpdate) continue

          const parsedAmount = parseMoneyInput(draft.amount)
          if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            alert(`Valor inválido para sugestão de ajuste: ${draft.officialDescription}`)
            continue
          }

          const signedAmount = draft.isRefund ? -Math.abs(parsedAmount) : Math.abs(parsedAmount)
          const result = await updateExpense(conflict.existing.id, {
            amount: signedAmount,
            date: draft.date,
            payment_method: 'credit_card',
            credit_card_id: card.id,
            installment_number: conflict.official.installmentNumber,
            installment_total: conflict.official.installmentTotal,
            bill_competence: currentMonth,
          })

          if (result.error) {
            alert(`Erro ao aplicar sugestão: ${result.error}`)
            break
          }

          setReconciliation((previous) => {
            if (!previous) return previous
            return {
              ...previous,
              conflicts: previous.conflicts.map((item) => {
                const key = buildConflictKey(String(item.existing.id || ''), String(item.official.id || ''))
                if (key !== draft.key) return item

                return {
                  ...item,
                  suggestedUpdate: {
                    ...item.suggestedUpdate,
                    needsUpdate: false,
                    date: draft.date,
                    amount: Math.abs(signedAmount),
                  },
                }
              }),
            }
          })
        }
      }

      await onReloadBillData()
      setMissingDrafts((previous) => previous.filter((draft) => !draft.selected))
      setConflictDrafts((previous) => previous.map((draft) =>
        draft.selected ? { ...draft, selected: false, applied: true } : draft,
      ))
    } finally {
      setLoading(false)
    }
  }

  // Filtra os itens suspeitos (cadastrados no sistema mas não aparecem no CSV oficial)
  // Excluindo:
  // 1. Estornos registrados (aparecem como pagamento, não como despesa normal no CSV)
  // 2. Itens de competência de meses adjacentes (carregados para análise de parcelas, não são desta fatura)
  // 3. Itens já conciliados (matched ou conflict) — garantia contra duplicação por data/valor idênticos
  // 4. Itens com valor zero (não aparecem no CSV)
  const reconciledIds = new Set<string>([
    ...(reconciliation?.matched ?? []).map((item) => String(item.existing.id || '')),
    ...(reconciliation?.conflicts ?? []).map((item) => String(item.existing.id || '')),
  ])

  const suspiciousItems = (reconciliation?.existingOnly ?? []).filter((item) => {
    if (item.category_id === '__refund_registered__') return false
    const amount = Math.abs(Number(item.base_amount ?? item.amount ?? 0))
    if (amount < 0.01) return false
    
    // Exclui itens de meses adjacentes (bill_competence fora do mês atual)
    const competence = String(item.bill_competence || '')
    if (competence && competence !== currentMonth) return false
    // Exclui itens que já foram conciliados (segurança extra contra duplicação interna)
    if (reconciledIds.has(String(item.id || ''))) return false

    return true
  })



  return (
    <div className="space-y-4 overflow-x-hidden animate-page-enter">
      {/* Stepper Wizard UX */}
      {reconciliation && (
        <div className="flex flex-col gap-2 border-b border-primary/20 pb-4 mb-2">
          <div className="flex items-center justify-between overflow-x-auto gap-2 pb-1.5 scrollbar-none">
            {[
              { id: 'summary', label: '1. Resumo', count: undefined },
              { id: 'conflicts', label: '2. Conflitos', count: reconciliation.conflicts.length },
              { id: 'missing', label: '3. Faltando', count: reconciliation.missing.length },
              {
                id: 'suspicious',
                label: '4. Alertas',
                count: suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length
              },
              { id: 'review', label: '5. Revisão Final', count: undefined }
            ].map((stepItem, index) => {
              const isActive = currentStep === stepItem.id
              const isCompleted = (() => {
                const stepOrder = ['summary', 'conflicts', 'missing', 'suspicious', 'review']
                const currentIdx = stepOrder.indexOf(currentStep)
                const itemIdx = stepOrder.indexOf(stepItem.id)
                return itemIdx < currentIdx
              })()

              return (
                <button
                  key={stepItem.id}
                  type="button"
                  onClick={() => setCurrentStep(stepItem.id as any)}
                  className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
                    isActive
                      ? 'bg-secondary text-primary border-primary'
                      : isCompleted
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-primary/10 text-secondary border-transparent hover:bg-primary/20 hover:text-primary'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    isActive ? 'bg-primary text-secondary' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-secondary text-secondary border border-primary'
                  }`}>
                    {isCompleted ? '✓' : index + 1}
                  </span>
                  <span>{stepItem.label}</span>
                  {stepItem.count !== undefined && stepItem.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                      isActive ? 'bg-primary text-secondary' : 'bg-secondary text-secondary'
                    }`}>
                      {stepItem.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {currentStep === 'upload' && (
        <div className="rounded-xl border border-primary bg-primary/40 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">Importação Automática</p>
              <p className="text-xs text-secondary mt-1">Importa o CSV da fatura e sugere categorias com base no seu histórico de conciliações.</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvUpload}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              Escolher arquivo CSV
            </Button>
            {fileName && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary border border-primary/20 max-w-full overflow-hidden">
                <p className="text-xs text-secondary truncate">{fileName}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {parseStatus && <p className="text-xs text-secondary">{parseStatus}</p>}

      {/* Etapa 1: Resumo Inicial */}
      {currentStep === 'summary' && reconciliation && (
        <div className="rounded-xl border border-primary bg-primary/20 p-5 space-y-4 text-center animate-page-enter">
          <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center mx-auto text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-file-check"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-primary">Arquivo CSV Importado com Sucesso!</h3>
            <p className="text-xs text-secondary max-w-sm mx-auto leading-relaxed">
              Analisamos a fatura de <strong>{currentMonth}</strong> do cartão <strong>{card.name}</strong> e identificamos o seguinte diagnóstico:
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Conciliados</p>
              <p className="text-lg font-bold text-emerald-500">{reconciliation.matched.length}</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Faltando</p>
              <p className="text-lg font-bold text-red-500">{reconciliation.missing.length}</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Conflitos</p>
              <p className="text-lg font-bold text-amber-500">{reconciliation.conflicts.length}</p>
            </div>
          </div>

          {suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl max-w-md mx-auto">
              <p className="text-xs text-amber-600 dark:text-amber-400 leading-normal">
                ⚠ Identificamos {suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length} lançamentos no sistema que não constam no arquivo oficial.
              </p>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="button"
              variant="primary"
              className="px-6"
              onClick={() => {
                if (reconciliation.conflicts.length > 0) {
                  setCurrentStep('conflicts')
                } else if (reconciliation.missing.length > 0) {
                  setCurrentStep('missing')
                } else if (suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length > 0) {
                  setCurrentStep('suspicious')
                } else {
                  setCurrentStep('review')
                }
              }}
            >
              Iniciar Conciliação Guiada
            </Button>
          </div>
        </div>
      )}

      {/* Etapa 5: Revisão Final (Visível apenas na revisão) */}
      {currentStep === 'review' && comparisonRows.length > 0 && (
        <div className="space-y-1.5 animate-page-enter">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-primary">
              Fatura oficial x Item atual (ordenado por data)
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-primary bg-primary p-3 text-center animate-stagger-item delay-50">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Oficial (Fatura)</p>
              <p className="text-base font-bold text-primary">{formatCurrency(identifiedTotals?.officialTotal || 0)}</p>
            </div>
            <div className="rounded-xl border border-primary bg-primary p-3 text-center animate-stagger-item delay-100">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Identificado (Base)</p>
              <p className="text-base font-bold text-primary">{formatCurrency(identifiedTotals?.identifiedTotal || 0)}</p>
            </div>
            <div className="rounded-xl border border-primary bg-primary p-3 text-center animate-stagger-item delay-150">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Sugestões</p>
              <p className="text-base font-bold text-primary text-accent">{formatCurrency(identifiedTotals?.missingTotal || 0)}</p>
            </div>
            <div className="rounded-xl border border-primary bg-primary p-3 text-center animate-stagger-item delay-200">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Diferença</p>
              <p className={`text-sm font-black ${Math.abs(identifiedTotals?.difference || 0) < 0.05 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(identifiedTotals?.difference || 0)}
              </p>
            </div>
          </div>

          {/* Abas de Filtragem Premium */}
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
                filterTab === 'all'
                  ? 'bg-secondary text-primary border border-primary'
                  : 'bg-primary/20 text-secondary hover:text-primary hover:bg-primary/40'
              }`}
            >
              Todos ({comparisonRows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('missing')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                filterTab === 'missing'
                  ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                  : 'bg-red-500/5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10'
              }`}
            >
              Faltando ({comparisonRows.filter((r) => r.status === 'faltando').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('conflicts')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                filterTab === 'conflicts'
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'bg-amber-500/5 text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10'
              }`}
            >
              Conflitos ({comparisonRows.filter((r) => r.status === 'conflitante').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('matched')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                filterTab === 'matched'
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                  : 'bg-emerald-500/5 text-emerald-500/60 hover:text-emerald-500 hover:bg-emerald-500/10'
              }`}
            >
              Conciliados ({comparisonRows.filter((r) => r.status === 'conciliado').length})
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {filteredComparisonRows.map((row, index) => {
              const staggerClass = index < 10 ? `animate-stagger-item delay-${(index + 1) * 50}` : 'animate-stagger-item'
              const draft = draftByOfficialId[row.official.id]
              const installment =
                row.official.installmentNumber && row.official.installmentTotal
                  ? ` • Parcela ${row.official.installmentNumber}/${row.official.installmentTotal}`
                  : ''

              const statusColorMap = {
                conciliado: 'text-income',
                conflitante: 'text-accent',
                faltando: 'text-expense'
              }

              return (
                <div key={row.key} className={`rounded-xl border border-primary bg-primary p-3 space-y-2 ${staggerClass}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${statusColorMap[row.status]}`}>
                      {row.status}
                    </span>
                    <span className="text-[10px] font-medium text-secondary bg-tertiary px-2 py-0.5 rounded-full border border-primary/20">
                      {formatDate(row.official.date)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    <div className="rounded-lg border border-primary bg-secondary p-1.5">
                      <p className="text-[11px] font-medium text-secondary uppercase tracking-wide">Fatura oficial</p>
                      <p className="text-sm text-primary mt-1 break-words">{row.official.description}</p>
                      <p className="text-xs text-secondary mt-1">
                        {formatDate(row.official.date)} • {formatCurrency(Number(row.official.amount || 0))}
                        {installment}
                      </p>
                      {row.official.isRefund && (
                        <p className="text-xs text-secondary mt-1">Estorno identificado no arquivo oficial.</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-primary bg-secondary p-1.5">
                      <p className="text-[11px] font-medium text-secondary uppercase tracking-wide">Item atual</p>
                      {row.current ? (
                        <>
                          {String(row.current.category_id || '') === '__refund_registered__' && (
                            <p className="text-[11px] inline-flex rounded-full border border-primary bg-primary px-2 py-0.5 text-secondary mt-1">
                              Estorno cadastrado
                            </p>
                          )}
                          <p className="text-sm text-primary mt-1 break-words">{row.current.description || row.current.category_name || 'Sem descrição'}</p>
                          <p className="text-xs text-secondary mt-1">
                            {formatDate(row.current.date)} • {formatCurrency(Number(row.current.base_amount ?? row.current.amount ?? 0))}
                          </p>
                        </>
                      ) : draft ? (
                        <p className="text-xs text-secondary mt-1">Não existe item atual correspondente. Use as sugestões de inclusão abaixo.</p>
                      ) : (
                        <p className="text-xs text-secondary mt-1">Não existe item atual correspondente.</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {currentStep === 'conflicts' && reconciliation && (
        <div className="space-y-3 animate-page-enter">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-primary">
              Conflitos Identificados ({reconciliation.conflicts.length})
            </h4>
            <p className="text-xs text-secondary">
              Ajuste lançamentos no sistema que possuem divergências de data ou valor com a fatura oficial.
            </p>
          </div>

          {conflictDrafts.length === 0 ? (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center space-y-2">
              <span className="text-2xl text-emerald-500">✓</span>
              <h4 className="font-bold text-emerald-500 text-sm">Nenhum conflito encontrado!</h4>
              <p className="text-xs text-secondary">
                Todos os lançamentos nesta fatura possuem datas e valores consistentes com o sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {conflictDrafts.map((draft, index) => {
                  const conflict = reconciliation.conflicts.find((item) =>
                    buildConflictKey(String(item.existing.id || ''), String(item.official.id || '')) === draft.key,
                  )

                  if (!conflict) return null

                  return (
                    <div
                      key={draft.key}
                      className={`rounded-xl border p-4 space-y-2 cursor-pointer transition-all duration-200 animate-stagger-item delay-${(index % 5 + 1) * 50} ${
                        draft.selected
                          ? 'border-[var(--color-focus)] ring-2 ring-[var(--color-focus)]/20 bg-primary/80'
                          : 'border-primary bg-primary/30 hover:border-primary/60 hover:bg-primary/50'
                      }`}
                      onClick={() => {
                        if (draft.applied) return
                        setConflictDrafts((previous) => previous.map((item) =>
                          item.key === draft.key
                            ? { ...item, selected: !item.selected }
                            : item,
                        ))
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-wider">
                              Conflito
                            </span>
                            {draft.applied ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-wider">
                                ✓ Ajuste aplicado
                              </span>
                            ) : draft.autoResolvedByInstallment ? (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[9px] font-bold uppercase tracking-wider">
                                Resolvido automático
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm font-semibold text-primary mt-1.5 break-words">
                            {conflict.official.description || conflict.existing.description}
                          </p>
                          <p className="text-xs text-secondary mt-0.5 font-mono">
                            Sistema: {formatDate(conflict.existing.date)} ({formatCurrency(Number(conflict.existing.base_amount ?? conflict.existing.amount ?? 0))}) <br />
                            Oficial: {formatDate(conflict.suggestedUpdate.date)} ({formatCurrency(Number(conflict.official.amount || 0))})
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-accent">
                            {formatCurrency(Number(draft.amount || conflict.official.amount || 0))}
                          </p>
                          {!draft.applied && (
                            <p className="text-[10px] text-secondary mt-1.5 font-medium">
                              {draft.selected ? '✓ Selecionado' : 'Clique para selecionar'}
                            </p>
                          )}
                        </div>
                      </div>

                      {draft.autoResolvedByInstallment && (
                        <div className="rounded-lg border border-primary bg-secondary p-2 mt-1">
                          <p className="text-xs text-secondary leading-normal">
                            ✓ Sequência de parcelas consistente entre os meses. Diferença de data no CSV oficial foi tratada automaticamente.
                          </p>
                        </div>
                      )}

                      {draft.installmentAnalysis && !draft.autoResolvedByInstallment && (
                        <div className="rounded-lg border border-primary bg-secondary p-2 space-y-1 mt-1">
                          {draft.installmentAnalysis.status === 'consistent' && (
                            <p className="text-xs text-secondary">
                              ✓ Parcelamento consistente entre meses ({draft.installmentAnalysis.foundNumbers.join(', ')}/{draft.installmentLabel || 'n'}).
                            </p>
                          )}

                          {draft.installmentAnalysis.status === 'missing' && (
                            <>
                              <p className="text-xs font-semibold text-accent">⚠ Parcelamento parcialmente consistente</p>
                              <p className="text-xs text-secondary">
                                Parcelas encontradas: {draft.installmentAnalysis.foundNumbers.join(', ') || 'nenhuma'} <br />
                                Parcelas faltando: {draft.installmentAnalysis.missingNumbers.join(', ') || 'nenhuma'}
                              </p>
                            </>
                          )}

                          {draft.installmentAnalysis.status === 'inconclusive' && (
                            <p className="text-xs text-secondary">
                              ⚠ Não foi possível confirmar a sequência completa das parcelas entre faturas anteriores e posteriores.
                            </p>
                          )}

                          {draft.installmentAnalysis.officialDateInconsistencyMessage && (
                            <p className="text-xs text-secondary mt-1 italic">
                              {draft.installmentAnalysis.officialDateInconsistencyMessage}
                            </p>
                          )}
                        </div>
                      )}

                      {draft.selected && !draft.applied && (
                        <div className="pt-3 border-t border-primary/20 mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <p className="text-[11px] font-bold text-secondary uppercase tracking-wider font-mono">Ajustar sugestão de atualização:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              label="Data sugerida"
                              type="date"
                              value={draft.date}
                              disabled={draft.applied}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                setConflictDrafts((previous) => previous.map((item) =>
                                  item.key === draft.key ? { ...item, date: event.target.value } : item,
                                ))
                              }}
                            />

                            <Input
                              label="Valor sugerido"
                              type="text"
                              inputMode="decimal"
                              value={draft.amount}
                              disabled={draft.applied}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                setConflictDrafts((previous) => previous.map((item) =>
                                  item.key === draft.key ? { ...item, amount: event.target.value } : item,
                                ))
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                  onClick={handleApplySelectedSuggestions}
                  disabled={loading || selectedConflictCount === 0}
                >
                  {loading ? 'Aplicando...' : `Ajustar Conflitos Selecionados (${selectedConflictCount})`}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 'missing' && reconciliation && (
        <div className="space-y-3 animate-page-enter">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-primary">
              Despesas Faltantes no Sistema ({reconciliation.missing.length})
            </h4>
            <p className="text-xs text-secondary">
              Insira no sistema os lançamentos da fatura oficial que ainda não constam nos seus registros.
            </p>
          </div>

          {missingDrafts.length === 0 ? (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center space-y-2">
              <span className="text-2xl text-emerald-500">✓</span>
              <h4 className="font-bold text-emerald-500 text-sm">Nenhuma despesa faltando!</h4>
              <p className="text-xs text-secondary">
                Todas as despesas da fatura oficial já constam no sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {missingDrafts.map((draft, index) => (
                  <div
                    key={draft.id}
                    className={`rounded-xl border p-4 space-y-2 cursor-pointer transition-all duration-200 animate-stagger-item delay-${(index % 5 + 1) * 50} ${
                      draft.selected
                        ? 'border-[var(--color-focus)] ring-2 ring-[var(--color-focus)]/20 bg-primary/80'
                        : 'border-primary bg-primary/30 hover:border-primary/60 hover:bg-primary/50'
                    }`}
                    onClick={() => {
                      setMissingDrafts((previous) => previous.map((item) =>
                        item.id === draft.id
                          ? { ...item, selected: !item.selected }
                          : item,
                      ))
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px] font-bold uppercase tracking-wider">
                            Faltando
                          </span>
                          {draft.learnedSuggestion.enabled && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-wider" title={`Confiança: ${Math.round((draft.learnedSuggestion.confidence || 0) * 100)}%`}>
                              Sugestão inteligente
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-primary mt-1.5 break-words">
                          {draft.description}
                        </p>
                        <p className="text-xs text-secondary mt-0.5">
                          {formatDate(draft.date)} • Categoria: {categories.find(c => c.id === draft.category_id)?.name || 'Sem categoria'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${draft.official.isRefund ? 'text-income' : 'text-primary'}`}>
                          {draft.official.isRefund ? '-' : ''}{formatCurrency(parseMoneyInput(draft.amount) || 0)}
                        </p>
                        <p className="text-[10px] text-secondary mt-1.5 font-medium">
                          {draft.selected ? '✓ Selecionado' : 'Clique para selecionar'}
                        </p>
                      </div>
                    </div>

                    {draft.official.isRefund && (
                      <p className="text-[11px] text-secondary bg-primary/30 px-2 py-0.5 rounded w-fit mt-1 font-mono">Estorno: será incluído com valor negativo.</p>
                    )}

                    {draft.possibleExistingMatch && (
                      <div className="rounded-lg border border-primary bg-secondary p-2 space-y-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-semibold text-accent flex items-center gap-1">
                          ⚠ Possível lançamento duplicado
                        </p>
                        <p className="text-xs text-secondary">
                          Encontrado no sistema com outra data/forma de pagamento. Se selecionado, será corrigido automaticamente para corresponder ao CSV oficial.
                        </p>
                        <div className="text-[11px] text-secondary space-y-0.5 bg-primary/20 p-1.5 rounded mt-1 font-mono">
                          <p>Oficial: {formatDate(draft.official.date)} • {formatCurrency(Number(draft.official.amount || 0))} • {draft.official.description}</p>
                          <p>Sistema: {formatDate(draft.possibleExistingMatch.date)} • {formatCurrency(Number(draft.possibleExistingMatch.amount || 0))} • {draft.possibleExistingMatch.description || 'Sem descrição'}</p>
                        </div>
                      </div>
                    )}

                    {draft.selected && (
                      <div className="pt-3 border-t border-primary/20 mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[11px] font-bold text-secondary uppercase tracking-wider font-mono">Ajustar detalhes do lançamento:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            label="Data"
                            type="date"
                            value={draft.date}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMissingDrafts((previous) => previous.map((item) =>
                              item.id === draft.id ? { ...item, date: event.target.value } : item,
                            ))}
                          />

                          <Input
                            label="Valor"
                            type="text"
                            inputMode="decimal"
                            value={draft.amount}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMissingDrafts((previous) => previous.map((item) =>
                              item.id === draft.id ? { ...item, amount: event.target.value } : item,
                            ))}
                          />

                          <Input
                            label="Descrição"
                            value={draft.description}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMissingDrafts((previous) => previous.map((item) =>
                              item.id === draft.id ? { ...item, description: event.target.value } : item,
                            ))}
                          />

                          <Select
                            label="Categoria"
                            value={draft.category_id}
                            onChange={(event: { target: { value: string; name?: string } }) => setMissingDrafts((previous) => previous.map((item) =>
                              item.id === draft.id ? { ...item, category_id: event.target.value } : item,
                            ))}
                            options={categories.map((category) => ({
                              value: category.id,
                              label: category.name,
                            }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                  onClick={handleApplySelectedSuggestions}
                  disabled={loading || selectedMissingCount === 0}
                >
                  {loading ? 'Aplicando...' : `Adicionar Itens Selecionados (${selectedMissingCount})`}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 'suspicious' && reconciliation && (
        <div className="space-y-3 animate-page-enter">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-primary">
              Alertas: Possíveis Erros de Cadastro ({suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length})
            </h4>
            <p className="text-xs text-secondary">
              Lançamentos vinculados a este cartão no sistema que não constam no arquivo oficial da fatura.
            </p>
          </div>

          {suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length === 0 ? (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center space-y-2">
              <span className="text-2xl text-emerald-500">✓</span>
              <h4 className="font-bold text-emerald-500 text-sm">Nenhum lançamento suspeito!</h4>
              <p className="text-xs text-secondary">
                Não há lançamentos no sistema para este cartão que não constam no arquivo oficial da fatura.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {suspiciousItems
                .filter((item) => !fixedSuspiciousIds.has(String(item.id || '')))
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3 animate-stagger-item">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary break-words font-sans">
                        {item.description || 'Sem descrição'}
                      </p>
                      <p className="text-xs text-secondary mt-0.5 font-medium font-mono">
                        {formatDate(item.date)} • {formatCurrency(Math.abs(Number(item.base_amount ?? item.amount ?? 0)))}
                        {item.category_name ? ` • ${item.category_name}` : ''}
                        {item.installment_number && item.installment_total
                          ? ` • Parcela ${item.installment_number}/${item.installment_total}`
                          : ''}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 bg-yellow-500/10 p-2.5 rounded-lg border border-yellow-500/20 leading-normal">
                        ⚠ Este lançamento está vinculado ao cartão mas não foi encontrado no arquivo de fatura oficial enviado.
                        Ele pode ter sido cadastrado no cartão incorreto ou pertencer a outro mês.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={async () => {
                          if (!confirm('Remover este item do cartão? Ele será mantido como despesa avulsa comum.')) return
                          await updateExpense(item.id, { payment_method: 'other', credit_card_id: null, bill_competence: null })
                          setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
                        }}
                        disabled={loading}
                      >
                        Desvincular do cartão
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-secondary"
                        onClick={() => {
                          setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
                        }}
                      >
                        Ignorar alerta
                      </Button>
                      {(() => {
                        const purchaseDay = new Date(item.date + 'T12:00:00').getDate()
                        if (purchaseDay >= 25 || purchaseDay <= 10) {
                          const targetMonthLabel = purchaseDay >= 25 ? 'próxima fatura' : 'fatura anterior'
                          return (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1 border-blue-500/30 hover:bg-blue-500/10 text-blue-500"
                              onClick={async () => {
                                const baseDate = new Date(item.date + 'T12:00:00')
                                const newMonth = format(addMonths(baseDate, purchaseDay >= 25 ? 1 : -1), 'yyyy-MM')
                                
                                const confirmed = confirm(`Mover este lançamento para a fatura de ${newMonth}?`)
                                if (confirmed) {
                                  const result = await updateExpense(item.id, { bill_competence: newMonth })
                                  if (result.error) {
                                    alert(`Erro ao mover: ${result.error}`)
                                  } else {
                                    setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
                                    await onReloadBillData()
                                  }
                                }
                              }}
                            >
                              Mover para {targetMonthLabel}
                            </Button>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation Toolbar */}
      {reconciliation && currentStep !== 'upload' && (
        <div className="flex items-center justify-between border-t border-primary/20 pt-4 mt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const stepOrder = ['summary', 'conflicts', 'missing', 'suspicious', 'review'] as const
              const currentIdx = stepOrder.indexOf(currentStep as any)
              if (currentIdx > 0) {
                setCurrentStep(stepOrder[currentIdx - 1])
              }
            }}
            disabled={currentStep === 'summary'}
            className="text-secondary hover:text-primary"
          >
            ← Voltar
          </Button>

          <div className="flex gap-2">
            {currentStep !== 'review' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const stepOrder = ['summary', 'conflicts', 'missing', 'suspicious', 'review'] as const
                  const currentIdx = stepOrder.indexOf(currentStep as any)
                  if (currentIdx < stepOrder.length - 1) {
                    setCurrentStep(stepOrder[currentIdx + 1])
                  }
                }}
              >
                Pular / Avançar →
              </Button>
            ) : (
              <div className="text-xs font-semibold text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-sans">
                ✓ Pronto para Fechar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
