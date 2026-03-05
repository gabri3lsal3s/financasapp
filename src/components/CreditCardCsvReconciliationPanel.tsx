import { useMemo, useRef, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { supabase } from '@/lib/supabase'
import type { CreditCard, Expense } from '@/types'
import type { BillExpenseItem } from '@/utils/creditCardBilling'
import {
  parseCreditCardInvoiceCsv,
  reconcileCreditCardBill,
  type OfficialInvoiceItem,
  type ReconciliationResult,
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
  installmentAnalysis?: {
    status: 'consistent' | 'missing' | 'inconclusive'
    foundNumbers: number[]
    missingNumbers: number[]
    officialDateInconsistencyMessage?: string | null
  } | null
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
  billItems: BillExpenseItem[]
  paymentItems: Array<{
    id: string
    amount: number
    payment_date: string
    note?: string | null
  }>
  categories: CategoryOption[]
  onClose: () => void
  onReloadBillData: () => Promise<void>
  createExpense: (expense: Omit<Expense, 'id' | 'created_at' | 'category' | 'credit_card'>) => Promise<{ data: Expense | null; error: string | null }>
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<{ data: Expense | null; error: string | null }>
}

const REFUND_NOTE_PREFIX = '[REFUND]'

const parseRefundPaymentNote = (rawNote?: string | null) => {
  const note = String(rawNote || '')
  if (!note.startsWith(REFUND_NOTE_PREFIX)) return null

  const payload = note.slice(REFUND_NOTE_PREFIX.length)

  try {
    const parsed = JSON.parse(payload) as { description?: string }
    return {
      description: String(parsed?.description || 'Estorno registrado'),
    }
  } catch {
    return {
      description: 'Estorno registrado',
    }
  }
}

const monthIndex = (date: string) => {
  const [year, month] = String(date || '').slice(0, 7).split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0
  return (year * 12) + month
}

const monthIndexLabel = (index: number) => {
  if (!Number.isFinite(index) || index <= 0) return ''
  const year = Math.floor((index - 1) / 12)
  const month = index - (year * 12)
  return `${String(month).padStart(2, '0')}/${year}`
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
  billItems,
  paymentItems,
  categories,
  onClose,
  onReloadBillData,
  createExpense,
  updateExpense,
}: CreditCardCsvReconciliationPanelProps) {
  const [fileName, setFileName] = useState('')
  const [parseStatus, setParseStatus] = useState<string>('')
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null)
  const [missingDrafts, setMissingDrafts] = useState<MissingDraft[]>([])
  const [conflictDrafts, setConflictDrafts] = useState<ConflictDraft[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedMissingCount = useMemo(
    () => missingDrafts.filter((draft) => draft.selected).length,
    [missingDrafts],
  )

  const selectedConflictCount = useMemo(
    () => conflictDrafts.filter((draft) => draft.selected && !draft.applied).length,
    [conflictDrafts],
  )

  const totalSelectedCount = selectedMissingCount + selectedConflictCount

  const draftByOfficialId = useMemo(() => {
    return missingDrafts.reduce<Record<string, MissingDraft>>((accumulator, draft) => {
      accumulator[draft.official.id] = draft
      return accumulator
    }, {})
  }, [missingDrafts])

  const conflictDraftByKey = useMemo(() => {
    return conflictDrafts.reduce<Record<string, ConflictDraft>>((accumulator, draft) => {
      accumulator[draft.key] = draft
      return accumulator
    }, {})
  }, [conflictDrafts])

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

  const identifiedTotals = useMemo(() => {
    const officialTotal = comparisonRows.reduce((sum, row) => sum + Number(row.official.amount || 0), 0)
    const registeredTotal = comparisonRows.reduce((sum, row) => {
      if (!row.current) return sum
      return sum + Number(row.current.base_amount ?? row.current.amount ?? 0)
    }, 0)

    return {
      officialTotal: Number(officialTotal.toFixed(2)),
      registeredTotal: Number(registeredTotal.toFixed(2)),
      difference: Number((officialTotal - registeredTotal).toFixed(2)),
    }
  }, [comparisonRows])

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const parsed = parseCreditCardInvoiceCsv(text, 'auto')

    setFileName(file.name)

    if (!parsed.supported) {
      setReconciliation(null)
      setMissingDrafts([])
      setConflictDrafts([])
      setParseStatus(parsed.reason || 'Arquivo não suportado para fatura de cartão de crédito.')
      return
    }

    const billItemsFromCurrentMonth = billItems
    const refundPaymentItems = (paymentItems || [])
      .map((payment) => {
        const refundMeta = parseRefundPaymentNote(payment.note)
        if (!refundMeta) return null

        return {
          id: `refund-payment-${payment.id}`,
          credit_card_id: card.id,
          amount: -Math.abs(Number(payment.amount || 0)),
          base_amount: -Math.abs(Number(payment.amount || 0)),
          date: String(payment.payment_date || ''),
          description: refundMeta.description,
          category_name: 'Estorno',
          category_id: '__refund_registered__',
          installment_number: null,
          installment_total: null,
          bill_competence: currentMonth,
        } as BillExpenseItem
      })
      .filter((item): item is BillExpenseItem => Boolean(item))

    const result = reconcileCreditCardBill(parsed.items, [...billItemsFromCurrentMonth, ...refundPaymentItems])
    const officialIndexById = parsed.items.reduce<Record<string, number>>((acc, item, index) => {
      acc[item.id] = index
      return acc
    }, {})

    let existingMatches: Record<string, MissingDraft['possibleExistingMatch']> = {}
    let conflictInstallmentAnalysis: Record<string, NonNullable<ConflictDraft['installmentAnalysis']>> = {}

    if (result.missing.length > 0) {
      const missingDates = result.missing.map((item) => item.date).sort()
      const minDate = missingDates[0]
      const maxDate = missingDates[missingDates.length - 1]
      const rangeStart = addDays(minDate, -90)
      const rangeEnd = addDays(maxDate, 90)

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

      conflictInstallmentAnalysis = conflictsWithInstallments.reduce<Record<string, NonNullable<ConflictDraft['installmentAnalysis']>>>((acc, conflict) => {
        const key = buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || ''))
        const total = Number(conflict.official.installmentTotal || 0)
        const number = Number(conflict.official.installmentNumber || 0)

        if (!total || !number || total < number) {
          acc[key] = {
            status: 'inconclusive',
            foundNumbers: [],
            missingNumbers: [],
          }
          return acc
        }

        const expectedNumbers = Array.from({ length: total }, (_, index) => index + 1)
        const officialAmount = Math.abs(Number(conflict.official.amount || 0))
        const referenceDescription = String(conflict.official.description || '')
        const existingReferenceDescription = String(conflict.existing.description || '')
        const existingInstallmentNumber = conflict.existing.installment_number ? Number(conflict.existing.installment_number) : null
        const existingMonth = monthIndex(conflict.existing.date)
        const anchorInstallmentNumber =
          existingInstallmentNumber && existingInstallmentNumber >= 1 && existingInstallmentNumber <= total
            ? existingInstallmentNumber
            : number
        const anchorMonth = existingMonth || monthIndex(conflict.official.date)
        const officialMonth = monthIndex(conflict.official.date)

        const related = installmentCandidates.filter((candidate) => {
          if (!candidate.id) return false
          const amountDelta = Math.abs(candidate.amount - officialAmount)
          if (amountDelta > 0.01) return false

          const officialDescriptionScore = similarity(referenceDescription, candidate.description)
          const existingDescriptionScore = similarity(existingReferenceDescription, candidate.description)
          const sameOfficialDescription = normalizeText(candidate.description) === normalizeText(referenceDescription)
          const sameExistingDescription = normalizeText(candidate.description) === normalizeText(existingReferenceDescription)

          if (
            officialDescriptionScore >= 0.28
            || existingDescriptionScore >= 0.28
            || sameOfficialDescription
            || sameExistingDescription
          ) {
            return true
          }

          if (
            candidate.installmentNumber
            && candidate.installmentTotal
            && candidate.installmentTotal === total
            && anchorInstallmentNumber
            && anchorMonth
          ) {
            const candidateMonth = monthIndex(candidate.date)
            if (!candidateMonth) return false

            const inferredFromMonth = anchorInstallmentNumber + (candidateMonth - anchorMonth)
            return inferredFromMonth === candidate.installmentNumber
          }

          return false
        })

        const found = new Set<number>()

        if (anchorInstallmentNumber >= 1 && anchorInstallmentNumber <= total) {
          found.add(anchorInstallmentNumber)
        } else if (number >= 1 && number <= total) {
          found.add(number)
        }

        related.forEach((candidate) => {
          if (candidate.installmentNumber && candidate.installmentNumber >= 1 && candidate.installmentNumber <= total) {
            found.add(candidate.installmentNumber)
            return
          }

          if (!anchorInstallmentNumber) return
          const candidateMonth = monthIndex(candidate.date)
          if (!candidateMonth || !anchorMonth) return

          const inferred = anchorInstallmentNumber + (candidateMonth - anchorMonth)
          if (inferred >= 1 && inferred <= total) {
            found.add(inferred)
          }
        })

        const foundNumbers = Array.from(found).sort((a, b) => a - b)
        const missingNumbers = expectedNumbers.filter((value) => !found.has(value))

        const expectedOfficialMonth =
          anchorInstallmentNumber && anchorMonth
            ? anchorMonth + (number - anchorInstallmentNumber)
            : null

        let officialDateInconsistencyMessage: string | null = null

        if (
          expectedOfficialMonth
          && officialMonth
          && expectedOfficialMonth !== officialMonth
        ) {
          officialDateInconsistencyMessage =
            `Possível inconsistência de data no CSV oficial: parcela ${number}/${total} em ${formatDate(conflict.official.date)}, mas pela sequência do parcelamento o mês esperado é ${monthIndexLabel(expectedOfficialMonth)}.`
        }

        const officialIndex = officialIndexById[conflict.official.id]
        const previousOfficial = Number.isFinite(officialIndex) ? parsed.items[officialIndex - 1] : null
        const nextOfficial = Number.isFinite(officialIndex) ? parsed.items[officialIndex + 1] : null
        const previousMonth = previousOfficial ? monthIndex(previousOfficial.date) : 0
        const nextMonth = nextOfficial ? monthIndex(nextOfficial.date) : 0

        if (!officialDateInconsistencyMessage && previousMonth && nextMonth && officialMonth) {
          const isClearNeighborMonthAnomaly =
            previousMonth === nextMonth
            && officialMonth !== previousMonth

          if (isClearNeighborMonthAnomaly) {
            officialDateInconsistencyMessage =
              `Possível inconsistência de data no CSV oficial: o lançamento está em ${formatDate(conflict.official.date)}, mas os lançamentos vizinhos estão no mês ${monthIndexLabel(previousMonth)}.`
          }
        }

        const status: NonNullable<ConflictDraft['installmentAnalysis']>['status'] =
          foundNumbers.length === 0
            ? 'inconclusive'
            : missingNumbers.length === 0
              ? 'consistent'
              : 'missing'

        acc[key] = {
          status,
          foundNumbers,
          missingNumbers,
          officialDateInconsistencyMessage,
        }

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

  return (
    <div className="rounded-lg border border-primary bg-secondary p-3 space-y-2 overflow-x-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-primary">
          Conciliação da fatura por CSV ({currentMonth})
        </p>
        <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="rounded-lg border border-primary bg-primary p-2.5 space-y-2">
        <p className="text-sm font-semibold text-primary">Importação automática</p>
        <p className="text-xs text-secondary">O assistente identifica o formato da fatura automaticamente.</p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvUpload}
          className="hidden"
        />

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
          >
            Escolher arquivo CSV
          </Button>
          {fileName && <p className="min-w-0 text-xs text-secondary break-all">Selecionado: {fileName}</p>}
        </div>
      </div>

      {parseStatus && <p className="text-xs text-secondary">{parseStatus}</p>}

      {comparisonRows.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-primary">
              Fatura oficial x Item atual (ordenado por data)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-primary bg-primary p-1.5">
              <p className="text-xs text-secondary">Total final fatura oficial</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(identifiedTotals.officialTotal)}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary p-1.5">
              <p className="text-xs text-secondary">Total final fatura cadastrada</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(identifiedTotals.registeredTotal)}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary p-1.5">
              <p className="text-xs text-secondary">Diferença</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(identifiedTotals.difference)}</p>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {comparisonRows.map((row) => {
              const draft = draftByOfficialId[row.official.id]
              const installment =
                row.official.installmentNumber && row.official.installmentTotal
                  ? ` • Parcela ${row.official.installmentNumber}/${row.official.installmentTotal}`
                  : ''

              return (
                <div key={row.key} className="rounded-lg border border-primary bg-primary p-2 space-y-1.5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-medium text-secondary uppercase tracking-wide">{row.status}</p>
                    <p className="text-xs text-secondary">Data oficial: {formatDate(row.official.date)}</p>
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

      {reconciliation && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-primary bg-primary p-1.5">
              <p className="text-xs text-secondary">Conciliados</p>
              <p className="text-sm font-semibold text-primary">{reconciliation.matched.length}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary p-1.5">
              <p className="text-xs text-secondary">Faltando no sistema</p>
              <p className="text-sm font-semibold text-primary">{reconciliation.missing.length}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary p-1.5">
              <p className="text-xs text-secondary">Conflitantes</p>
              <p className="text-sm font-semibold text-primary">{reconciliation.conflicts.length}</p>
            </div>
          </div>

          {(missingDrafts.length > 0 || reconciliation.conflicts.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-primary">
                  Sugestões do assistente
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {missingDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className={`rounded-lg border bg-primary p-2 space-y-1.5 cursor-pointer ${draft.selected ? 'border-[var(--color-focus)] ring-1 ring-[var(--color-focus)]' : 'border-primary'}`}
                    onClick={() => {
                      setMissingDrafts((previous) => previous.map((item) =>
                        item.id === draft.id
                          ? { ...item, selected: !item.selected }
                          : item,
                      ))
                    }}
                  >
                    <p className="text-[11px] font-medium text-secondary uppercase tracking-wide">Item faltante</p>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-secondary">{draft.selected ? 'Selecionado para inclusão' : 'Clique no card para selecionar'}</p>
                      {draft.learnedSuggestion.enabled && (
                        <span className="w-fit text-[11px] rounded-full border border-primary bg-secondary px-2 py-0.5 text-secondary">
                          Sugestão aprendida{draft.learnedSuggestion.confidence ? ` (${Math.round((draft.learnedSuggestion.confidence || 0) * 100)}%)` : ''}
                        </span>
                      )}
                    </div>

                    {draft.official.isRefund && (
                      <p className="text-xs text-secondary">Estorno: será incluído com valor negativo.</p>
                    )}

                    {draft.possibleExistingMatch && (
                      <div className="rounded-lg border border-primary bg-secondary p-1.5 space-y-1">
                        <p className="text-xs text-secondary">
                          Possível lançamento já cadastrado com divergência de data e/ou forma de pagamento.
                        </p>
                        {draft.possibleExistingMatch.wrongDate && (
                          <p className="text-xs text-secondary">• Data diferente da fatura oficial.</p>
                        )}
                        {draft.possibleExistingMatch.wrongPaymentMethod && (
                          <p className="text-xs text-secondary">• Forma de pagamento/cartão diferente do esperado.</p>
                        )}
                        <p className="text-xs text-secondary">
                          Oficial: {formatDate(draft.official.date)} • {formatCurrency(Number(draft.official.amount || 0))} • {draft.official.description}
                        </p>
                        <p className="text-xs text-secondary">
                          Lançamento encontrado: {formatDate(draft.possibleExistingMatch.date)} • {formatCurrency(Number(draft.possibleExistingMatch.amount || 0))} • {draft.possibleExistingMatch.description || 'Sem descrição'}
                        </p>
                        <p className="text-xs text-secondary">Ao aplicar selecionados, esse lançamento será corrigido automaticamente.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <Input
                        label="Data"
                        type="date"
                        value={draft.date}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setMissingDrafts((previous) => previous.map((item) =>
                          item.id === draft.id ? { ...item, date: event.target.value } : item,
                        ))}
                      />

                      <Input
                        label="Valor"
                        type="text"
                        inputMode="decimal"
                        value={draft.amount}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setMissingDrafts((previous) => previous.map((item) =>
                          item.id === draft.id ? { ...item, amount: event.target.value } : item,
                        ))}
                      />

                      <Input
                        label="Descrição"
                        value={draft.description}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setMissingDrafts((previous) => previous.map((item) =>
                          item.id === draft.id ? { ...item, description: event.target.value } : item,
                        ))}
                      />

                      <Select
                        label="Categoria"
                        value={draft.category_id}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setMissingDrafts((previous) => previous.map((item) =>
                          item.id === draft.id ? { ...item, category_id: event.target.value } : item,
                        ))}
                        options={categories.map((category) => ({
                          value: category.id,
                          label: category.name,
                        }))}
                      />
                    </div>
                  </div>
                ))}

                {reconciliation.conflicts.map((conflict) => {
                  const key = buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || ''))
                  const draft = conflictDraftByKey[key]

                  if (!draft) return null

                  return (
                  <div
                    key={`${conflict.existing.id}-${conflict.official.id}`}
                    className={`rounded-lg border bg-primary p-2 space-y-1.5 cursor-pointer ${draft.selected ? 'border-[var(--color-focus)] ring-1 ring-[var(--color-focus)]' : 'border-primary'}`}
                    onClick={() => {
                      if (draft.applied) return
                      setConflictDrafts((previous) => previous.map((item) =>
                        item.key === draft.key
                          ? { ...item, selected: !item.selected }
                          : item,
                      ))
                    }}
                  >
                    <p className="text-[11px] font-medium text-secondary uppercase tracking-wide">Conflito identificado</p>
                    <p className="text-xs text-secondary">{draft.applied ? 'Sugestão já aplicada' : (draft.selected ? 'Selecionado para aplicar' : 'Clique no card para selecionar')}</p>

                    {draft.autoResolvedByInstallment && (
                      <div className="rounded-lg border border-primary bg-secondary p-1.5">
                        <p className="text-xs text-secondary">
                          Sequência de parcelas consistente entre os meses. Diferença de data no CSV oficial foi tratada automaticamente.
                        </p>
                      </div>
                    )}

                    {draft.installmentAnalysis && !draft.autoResolvedByInstallment && (
                      <div className="rounded-lg border border-primary bg-secondary p-1.5 space-y-1">
                        {draft.installmentAnalysis.status === 'consistent' && (
                          <p className="text-xs text-secondary">
                            Parcelamento consistente entre meses ({draft.installmentAnalysis.foundNumbers.join(', ')}/{draft.installmentLabel || 'n'}).
                          </p>
                        )}

                        {draft.installmentAnalysis.status === 'missing' && (
                          <>
                            <p className="text-xs text-secondary">Parcelamento parcialmente consistente.</p>
                            <p className="text-xs text-secondary">
                              Parcelas encontradas: {draft.installmentAnalysis.foundNumbers.join(', ') || 'nenhuma'}
                            </p>
                            <p className="text-xs text-secondary">
                              Parcelas faltando: {draft.installmentAnalysis.missingNumbers.join(', ') || 'nenhuma'}
                            </p>
                          </>
                        )}

                        {draft.installmentAnalysis.status === 'inconclusive' && (
                          <p className="text-xs text-secondary">
                            Não foi possível confirmar a sequência completa das parcelas entre faturas anteriores e posteriores.
                          </p>
                        )}

                        {draft.installmentAnalysis.officialDateInconsistencyMessage && (
                          <p className="text-xs text-secondary">
                            {draft.installmentAnalysis.officialDateInconsistencyMessage}
                          </p>
                        )}
                      </div>
                    )}

                    {draft.autoResolvedByInstallment && draft.installmentAnalysis?.officialDateInconsistencyMessage && (
                      <div className="rounded-lg border border-primary bg-secondary p-1.5">
                        <p className="text-xs text-secondary">
                          {draft.installmentAnalysis.officialDateInconsistencyMessage}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div className="rounded-lg border border-primary bg-secondary p-1.5">
                        <p className="text-[11px] font-medium text-secondary uppercase tracking-wide">Sistema</p>
                        <p className="text-xs text-secondary mt-1">
                          {formatDate(conflict.existing.date)} • {formatCurrency(Number(conflict.existing.base_amount ?? conflict.existing.amount ?? 0))}
                        </p>
                        <p className="text-sm text-primary mt-1 break-words">{conflict.existing.description || 'Sem descrição'}</p>
                      </div>

                      <div className="rounded-lg border border-primary bg-secondary p-1.5">
                        <p className="text-[11px] font-medium text-secondary uppercase tracking-wide">Oficial</p>
                        <p className="text-xs text-secondary mt-1">
                          {formatDate(conflict.suggestedUpdate.date)} • {formatCurrency(Number(conflict.official.amount || conflict.suggestedUpdate.amount || 0))}
                        </p>
                        <p className="text-sm text-primary mt-1 break-words">{conflict.official.description || 'Sem descrição'}</p>
                        {draft.installmentLabel && (
                          <p className="text-xs text-secondary mt-1">Compra parcelada • parcela {draft.installmentLabel}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <Input
                        label="Data sugerida"
                        type="date"
                        value={draft.date}
                        disabled={draft.applied}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
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
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          setConflictDrafts((previous) => previous.map((item) =>
                            item.key === draft.key ? { ...item, amount: event.target.value } : item,
                          ))
                        }}
                      />
                    </div>

                  </div>
                )})}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                  onClick={handleApplySelectedSuggestions}
                  disabled={loading || totalSelectedCount === 0}
                >
                  {loading ? 'Aplicando...' : `Aplicar selecionados (${totalSelectedCount})`}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
