import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '@/components/Button'
import { supabase } from '@/lib/supabase'
import type { CreditCard, Expense } from '@/types'
import { resolveBillCompetence, type BillExpenseItem } from '@/utils/creditCardBilling'
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
import ReconciliationKpiGrid from '@/components/creditCards/ReconciliationKpiGrid'
import ConflictDraftCard from '@/components/creditCards/ConflictDraftCard'
import MissingDraftCard from '@/components/creditCards/MissingDraftCard'
import SuspiciousDraftCard from '@/components/creditCards/SuspiciousDraftCard'
import ComparisonRowCard from '@/components/creditCards/ComparisonRowCard'
import { Info, AlertTriangle, Check, X, FileCheck } from 'lucide-react'

type ReconciliationWizardStep = 'summary' | 'conflicts' | 'missing' | 'suspicious' | 'review'
const WIZARD_STEPS: ReconciliationWizardStep[] = ['summary', 'conflicts', 'missing', 'suspicious', 'review']
import { formatCurrency, formatMoneyInput, parseMoneyInput } from '@/utils/format'

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
  const [csvCompetenceMismatch, setCsvCompetenceMismatch] = useState<{
    csvCompetence: string
    relation: 'anterior' | 'posterior'
  } | null>(null)
  const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'success' | 'warning', text: string } | null>(null)
  const modalTopRef = useRef<HTMLDivElement | null>(null)

  const scrollToTop = () => {
    const container = modalTopRef.current?.closest('.overflow-y-auto')
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      modalTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const triggerAlert = (text: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setAlertMessage({ type, text })
    setTimeout(() => {
      scrollToTop()
    }, 50)
  }

  // Rola para o topo do modal ao trocar de etapa
  useEffect(() => {
    scrollToTop()
    setAlertMessage(null)
  }, [currentStep])

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

      // Detect spreadsheet competence
      const competenceCounts: Record<string, number> = {}
      parsed.items.forEach((item) => {
        const comp = resolveBillCompetence(item.date, card.closing_day)
        competenceCounts[comp] = (competenceCounts[comp] || 0) + 1
      })

      let csvCompetence = currentMonth
      let maxCount = 0
      Object.entries(competenceCounts).forEach(([comp, count]) => {
        if (count > maxCount) {
          maxCount = count
          csvCompetence = comp
        }
      })

      if (csvCompetence !== currentMonth) {
        const relation = csvCompetence < currentMonth ? 'anterior' : 'posterior'
        setCsvCompetenceMismatch({ csvCompetence, relation })
      } else {
        setCsvCompetenceMismatch(null)
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
      triggerAlert('Selecione ao menos uma sugestão para aplicar.', 'warning')
      return
    }

    setLoading(true)
    scrollToTop()
    try {
      for (const draft of selectedMissing) {
        const amount = parseMoneyInput(draft.amount)
        if (Number.isNaN(amount) || amount <= 0) {
          triggerAlert(`Valor inválido para o item: ${draft.description}`)
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
            triggerAlert(`Erro ao corrigir lançamento existente: ${updated.error}`)
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
          triggerAlert(`Erro ao incluir item em lote: ${created.error}`)
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
            triggerAlert(`Valor inválido para sugestão de ajuste: ${draft.officialDescription}`)
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
            triggerAlert(`Erro ao aplicar sugestão: ${result.error}`)
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
      {/* Invisible anchor for scrolling to top */}
      <div ref={modalTopRef} />
      {/* Stepper Wizard UX */}
      {reconciliation && (
        <div className="flex flex-col gap-2 border-b border-glass pb-4 mb-2">
          <div className="flex items-center justify-between overflow-x-auto gap-2 pb-1.5 scrollbar-none">
            {[
              { id: 'summary', label: 'Resumo', count: undefined },
              { id: 'conflicts', label: 'Conflitos', count: reconciliation.conflicts.length },
              { id: 'missing', label: 'Faltando', count: reconciliation.missing.length },
              {
                id: 'suspicious',
                label: 'Alertas',
                count: suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length
              },
              { id: 'review', label: 'Revisão Final', count: undefined }
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
                  onClick={() => setCurrentStep(stepItem.id as ReconciliationWizardStep)}
                  className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border ${
                    isActive
                      ? 'bg-secondary text-primary border-primary'
                      : isCompleted
                      ? 'bg-income/10 text-income border-income/20 hover:bg-income/20'
                      : 'bg-primary/10 text-secondary border-transparent hover:bg-primary/20 hover:text-primary'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    isActive ? 'bg-primary text-secondary' : isCompleted ? 'bg-income text-white' : 'bg-secondary text-secondary border border-primary'
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

      {alertMessage && (
        <div className={`p-3.5 rounded-xl border flex gap-3 items-start animate-page-enter shadow-sm ${
          alertMessage.type === 'error'
            ? 'bg-[color-mix(in_srgb,var(--color-expense)_8%,var(--glass-layer-panel))] border-[color-mix(in_srgb,var(--color-expense)_25%,var(--glass-border))] text-expense'
            : alertMessage.type === 'warning'
            ? 'bg-[color-mix(in_srgb,var(--color-warning)_8%,var(--glass-layer-panel))] border-[color-mix(in_srgb,var(--color-warning)_25%,var(--glass-border))] text-warning'
            : 'bg-[color-mix(in_srgb,var(--color-income)_8%,var(--glass-layer-panel))] border-[color-mix(in_srgb,var(--color-income)_25%,var(--glass-border))] text-income'
        }`}>
          {alertMessage.type === 'error' && (
            <Info size={16} className="shrink-0 mt-0.5 text-expense" />
          )}
          {alertMessage.type === 'warning' && (
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-warning" />
          )}
          {alertMessage.type === 'success' && (
            <Check size={16} className="shrink-0 mt-0.5 text-income" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold leading-normal text-primary">
              {alertMessage.text}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-secondary hover:text-primary transition-colors duration-150 shrink-0 p-0.5"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {currentStep === 'upload' && (
        <div className="modal-panel-glass p-4 space-y-3">
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
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary border border-glass max-w-full overflow-hidden">
                <p className="text-xs text-secondary truncate">{fileName}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {parseStatus && <p className="text-xs text-secondary">{parseStatus}</p>}

      {/* Etapa 1: Resumo Inicial */}
      {currentStep === 'summary' && reconciliation && (
        <div className="modal-panel-glass border-glass rounded-2xl p-6 space-y-4 text-center animate-page-enter shadow-lg">
          <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--glass-layer-panel))] flex items-center justify-center mx-auto text-primary border border-[color-mix(in_srgb,var(--color-primary)_24%,var(--glass-border))] shadow-inner">
            <FileCheck size={24} className="text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-primary">Arquivo CSV Importado com Sucesso!</h3>
            <p className="text-xs text-secondary max-w-sm mx-auto leading-relaxed">
              Analisamos a fatura de <strong>{currentMonth}</strong> do cartão <strong>{card.name}</strong> e identificamos o seguinte diagnóstico:
            </p>
          </div>
          
          <ReconciliationKpiGrid
            items={[
              { label: 'Conciliados', value: reconciliation.matched.length, tone: 'income' },
              { label: 'Faltando', value: reconciliation.missing.length, tone: 'expense' },
              { label: 'Conflitos', value: reconciliation.conflicts.length, tone: 'warning' },
            ]}
          />

          {csvCompetenceMismatch && (
            <div className="bg-[color-mix(in_srgb,var(--color-warning)_8%,var(--glass-layer-panel))] border border-[color-mix(in_srgb,var(--color-warning)_25%,var(--glass-border))] p-4 rounded-2xl max-w-md mx-auto text-left flex gap-3 items-start shadow-sm">
              <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-black text-warning uppercase tracking-wider">Aviso de Fatura Incorreta</p>
                <p className="text-[11px] text-secondary leading-relaxed">
                  A planilha adicionada é referente à fatura de <strong className="text-primary font-bold">{csvCompetenceMismatch.csvCompetence}</strong>, mas você selecionou a fatura de <strong className="text-primary font-bold">{currentMonth}</strong> ({csvCompetenceMismatch.relation} à planilha).
                </p>
              </div>
            </div>
          )}

          {suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length > 0 && (
            <div className="bg-[color-mix(in_srgb,var(--color-warning)_6%,var(--glass-layer-panel))] border border-[color-mix(in_srgb,var(--color-warning)_20%,var(--glass-border))] p-3.5 rounded-2xl max-w-md mx-auto shadow-sm">
              <p className="text-xs text-warning leading-normal font-bold">
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
            <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-50">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Oficial (Fatura)</p>
              <p className="text-base font-bold text-primary">{formatCurrency(identifiedTotals?.officialTotal || 0)}</p>
            </div>
            <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-100">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Identificado (Base)</p>
              <p className="text-base font-bold text-primary">{formatCurrency(identifiedTotals?.identifiedTotal || 0)}</p>
            </div>
            <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-150">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mb-1">Sugestões</p>
              <p className="text-base font-bold text-primary text-accent">{formatCurrency(identifiedTotals?.missingTotal || 0)}</p>
            </div>
            <div className="modal-panel-glass p-3 text-center animate-stagger-item delay-200">
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
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 border ${
                filterTab === 'all'
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-[var(--glass-layer-interactive)] text-secondary border-glass hover:text-primary hover:bg-[var(--glass-surface-strong)]'
              }`}
            >
              Todos ({comparisonRows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('missing')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                filterTab === 'missing'
                  ? 'bg-expense/15 text-expense border border-expense/30'
                  : 'bg-expense/5 text-expense/60 hover:text-expense hover:bg-expense/10'
              }`}
            >
              Faltando ({comparisonRows.filter((r) => r.status === 'faltando').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('conflicts')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                filterTab === 'conflicts'
                  ? 'bg-warning/15 text-warning border border-warning/30'
                  : 'bg-warning/5 text-warning/60 hover:text-warning hover:bg-warning/10'
              }`}
            >
              Conflitos ({comparisonRows.filter((r) => r.status === 'conflitante').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('matched')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                filterTab === 'matched'
                  ? 'bg-income/15 text-income border border-income/30'
                  : 'bg-income/5 text-income/60 hover:text-income hover:bg-income/10'
              }`}
            >
              Conciliados ({comparisonRows.filter((r) => r.status === 'conciliado').length})
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {filteredComparisonRows.map((row, index) => {
              const draft = draftByOfficialId[row.official.id]
              return (
                <ComparisonRowCard
                  key={row.key}
                  row={row}
                  draft={Boolean(draft)}
                  index={index}
                />
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
            <div className="bg-income/5 border border-income/20 rounded-xl p-6 text-center space-y-2">
              <span className="text-2xl text-income font-bold">✓</span>
              <h4 className="font-bold text-income text-sm">Nenhum conflito encontrado!</h4>
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
                    <ConflictDraftCard
                      key={draft.key}
                      draft={draft}
                      conflict={conflict}
                      index={index}
                      onToggleSelect={() => {
                        if (draft.applied) return
                        setConflictDrafts((previous) => previous.map((item) =>
                          item.key === draft.key
                            ? { ...item, selected: !item.selected }
                            : item,
                        ))
                      }}
                      onUpdateDate={(date) => {
                        setConflictDrafts((previous) => previous.map((item) =>
                          item.key === draft.key ? { ...item, date } : item,
                        ))
                      }}
                      onUpdateAmount={(amount) => {
                        setConflictDrafts((previous) => previous.map((item) =>
                          item.key === draft.key ? { ...item, amount } : item,
                        ))
                      }}
                    />
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
            <div className="bg-income/5 border border-income/20 rounded-xl p-6 text-center space-y-2">
              <span className="text-2xl text-income font-bold">✓</span>
              <h4 className="font-bold text-income text-sm">Nenhuma despesa faltando!</h4>
              <p className="text-xs text-secondary">
                Todas as despesas da fatura oficial já constam no sistema.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {missingDrafts.map((draft, index) => (
                  <MissingDraftCard
                    key={draft.id}
                    draft={draft}
                    categories={categories}
                    index={index}
                    onToggleSelect={() => {
                      setMissingDrafts((previous) => previous.map((item) =>
                        item.id === draft.id
                          ? { ...item, selected: !item.selected }
                          : item,
                      ))
                    }}
                    onUpdateDate={(date) => setMissingDrafts((previous) => previous.map((item) =>
                      item.id === draft.id ? { ...item, date } : item,
                    ))}
                    onUpdateAmount={(amount) => setMissingDrafts((previous) => previous.map((item) =>
                      item.id === draft.id ? { ...item, amount } : item,
                    ))}
                    onUpdateDescription={(description) => setMissingDrafts((previous) => previous.map((item) =>
                      item.id === draft.id ? { ...item, description } : item,
                    ))}
                    onUpdateCategory={(categoryId) => setMissingDrafts((previous) => previous.map((item) =>
                      item.id === draft.id ? { ...item, category_id: categoryId } : item,
                    ))}
                  />
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
            <div className="bg-income/5 border border-income/20 rounded-xl p-6 text-center space-y-2">
              <span className="text-2xl text-income font-bold">✓</span>
              <h4 className="font-bold text-income text-sm">Nenhum lançamento suspeito!</h4>
              <p className="text-xs text-secondary">
                Não há lançamentos no sistema para este cartão que não constam no arquivo oficial da fatura.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {suspiciousItems
                .filter((item) => !fixedSuspiciousIds.has(String(item.id || '')))
                .map((item) => (
                  <SuspiciousDraftCard
                    key={item.id}
                    item={item}
                    loading={loading}
                    onUnlink={async () => {
                      await updateExpense(item.id, { payment_method: 'other', credit_card_id: null, bill_competence: null })
                      setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
                    }}
                    onIgnore={() => {
                      setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
                    }}
                    onMove={async (newMonth) => {
                      const result = await updateExpense(item.id, { bill_competence: newMonth })
                      if (result.error) {
                        triggerAlert(`Erro ao mover: ${result.error}`)
                      } else {
                        setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
                        await onReloadBillData()
                      }
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation Toolbar */}
      {reconciliation && currentStep !== 'upload' && (
        <div className="flex items-center justify-between border-t border-glass pt-4 mt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const stepOrder = WIZARD_STEPS
              const currentIdx = stepOrder.indexOf(currentStep as ReconciliationWizardStep)
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
                  const stepOrder = WIZARD_STEPS
                  const currentIdx = stepOrder.indexOf(currentStep as ReconciliationWizardStep)
                  if (currentIdx < stepOrder.length - 1) {
                    setCurrentStep(stepOrder[currentIdx + 1])
                  }
                }}
              >
                Pular / Avançar →
              </Button>
            ) : (
              <div className="text-xs font-semibold text-income flex items-center gap-1 bg-income/10 px-3 py-1.5 rounded-lg border border-income/20 font-sans">
                ✓ Pronto para Fechar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
