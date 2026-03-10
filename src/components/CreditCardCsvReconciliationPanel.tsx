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
  analyzeInstallments,
  calculateInvoiceTotals,
  type OfficialInvoiceItem,
  type ReconciliationResult,
  type InstallmentAnalysis,
  type InvoiceTotals,
} from '@/utils/creditCardCsvReconciliation'
import { classifyCSVTransactions } from '@/services/ai/reconciliation'
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
  onClose: () => void
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
  onClose,
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

      setParseStatus('Consultando IA para categorização...')

      // IA Econômica: Agrupar descrições únicas e ignorar o que já foi aprendido com alta confiança
      const uniqueItemsToClassify = Array.from(
        result.missing
          .filter(item => {
            const suggestion = suggestFromCreditCardCsvLearning(item.description)
            // Somente enviar para IA se não houver sugestão local FORTE (>80%)
            return !suggestion || (suggestion.confidence || 0) < 0.8
          })
          .reduce((map, item) => {
            const key = `${item.description}|${Math.abs(item.amount).toFixed(2)}`
            if (!map.has(key)) {
              map.set(key, {
                id: item.id,
                description: item.description,
                amount: Math.abs(item.amount)
              })
            }
            return map
          }, new Map<string, any>())
          .values()
      )

      if (uniqueItemsToClassify.length > 0) {
        classifyCSVTransactions({
          transactions: uniqueItemsToClassify,
          categories: categories.map(c => ({ id: c.id, name: c.name } as any))
        }).then(classifications => {
          if (classifications.length > 0) {
            setMissingDrafts(prev => prev.map(draft => {
              // Encontrar classificação que bate com a descrição e valor do rascunho
              const aiMatch = classifications.find(c => {
                const draftKey = `${draft.official.description}|${Math.abs(draft.official.amount).toFixed(2)}`
                // O cache do serviço já lida com o retorno baseado no ID original se enviamos múltiplos, 
                // mas aqui garantimos que aplicamos a todos os rascunhos idênticos.
                const originalIdentified = uniqueItemsToClassify.find(u => u.id === c.id)
                if (!originalIdentified) return false
                const aiKey = `${originalIdentified.description}|${originalIdentified.amount.toFixed(2)}`
                return draftKey === aiKey
              })

              if (aiMatch && aiMatch.suggestedCategoryId) {
                if (draft.learnedSuggestion.enabled && (draft.learnedSuggestion.confidence || 0) >= 0.8) {
                  return draft
                }

                return {
                  ...draft,
                  description: aiMatch.cleanDescription || draft.description,
                  category_id: aiMatch.suggestedCategoryId,
                  learnedSuggestion: {
                    enabled: true,
                    confidence: aiMatch.confidence
                  }
                }
              }
              return draft
            }))
          }
        }).catch(err => console.error('AI Classification error:', err))
      }

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

  // Filtra os itens suspeitos (cadastrados no sistema mas não aparecem no CSV oficial)
  // Excluindo:
  // 1. Estornos registrados (aparecem como pagamento, não como despesa normal no CSV)
  // 2. Itens de competência de meses adjacentes (carregados para análise de parcelas, não são desta fatura)
  // 3. Itens já conciliados (matched ou conflict) — garantia contra duplicação por data/valor idênticos
  const reconciledIds = new Set<string>([
    ...(reconciliation?.matched ?? []).map((item) => String(item.existing.id || '')),
    ...(reconciliation?.conflicts ?? []).map((item) => String(item.existing.id || '')),
  ])

  const suspiciousItems = (reconciliation?.existingOnly ?? []).filter((item) => {
    if (item.category_id === '__refund_registered__') return false
    // Exclui itens de meses adjacentes (bill_competence fora do mês atual)
    const competence = String(item.bill_competence || '')
    if (competence && competence !== currentMonth) return false
    // Exclui itens que já foram conciliados (segurança extra contra duplicação interna)
    if (reconciledIds.has(String(item.id || ''))) return false

    return true
  })

  const handleFixSuspicious = async (item: BillExpenseItem, action: 'remove_card' | 'dismiss') => {
    const id = String(item.id || '')
    if (!id) return

    if (action === 'dismiss') {
      setFixedSuspiciousIds((previous) => new Set([...previous, id]))
      return
    }

    // action === 'remove_card': retira o cartão e transforma em despesa comum
    const updated = await updateExpense(id, {
      payment_method: 'other',
      credit_card_id: null,
    })

    if (updated.error) {
      alert(`Erro ao corrigir lançamento: ${updated.error}`)
      return
    }

    setFixedSuspiciousIds((previous) => new Set([...previous, id]))
    await onReloadBillData()
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5">
            <div className="rounded-lg border border-primary bg-primary p-1.5 text-center">
              <p className="text-[10px] text-secondary uppercase">Oficial (CSV)</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(identifiedTotals?.officialTotal || 0)}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary p-1.5 text-center">
              <p className="text-[10px] text-secondary uppercase">Identificado</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(identifiedTotals?.identifiedTotal || 0)}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary p-1.5 text-center">
              <p className="text-[10px] text-secondary uppercase">Sugestões</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(identifiedTotals?.missingTotal || 0)}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary p-1.5 text-center">
              <p className="text-[10px] text-secondary uppercase">Diferença Final</p>
              <p className={`text-sm font-bold ${Math.abs(identifiedTotals?.difference || 0) < 0.05 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(identifiedTotals?.difference || 0)}
              </p>
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
                  disabled={loading || totalSelectedCount === 0}
                >
                  {loading ? 'Aplicando...' : `Aplicar selecionados (${totalSelectedCount})`}
                </Button>
              </div>
            </div>
          )}

          {/* Seção de lançamentos possivelmente incorretos */}
          {suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length > 0 && (
            <div className="space-y-2 mt-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-primary">
                  Possíveis erros de cadastro ({suspiciousItems.filter((item) => !fixedSuspiciousIds.has(String(item.id || ''))).length})
                </p>
                <p className="text-xs text-secondary">
                  Lançamentos cadastrados nesta fatura que não aparecem no CSV oficial
                </p>
              </div>

              <div className="space-y-2">
                {suspiciousItems
                  .filter((item) => !fixedSuspiciousIds.has(String(item.id || '')))
                  .map((item) => (
                    <div key={item.id} className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-2.5 space-y-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary break-words">
                            {item.description || 'Sem descrição'}
                          </p>
                          <p className="text-xs text-secondary mt-0.5">
                            {formatDate(item.date)} • {formatCurrency(Math.abs(Number(item.base_amount ?? item.amount ?? 0)))}
                            {item.category_name ? ` • ${item.category_name}` : ''}
                            {item.installment_number && item.installment_total
                              ? ` • Parcela ${item.installment_number}/${item.installment_total}`
                              : ''}
                          </p>
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            ⚠ Este lançamento está vinculado ao cartão mas não foi encontrado na fatura oficial.
                            Pode estar cadastrado com cartão incorreto ou com outra forma de pagamento.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleFixSuspicious(item, 'remove_card')}
                          disabled={loading}
                        >
                          Remover do cartão
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleFixSuspicious(item, 'dismiss')}
                        >
                          Ignorar
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
