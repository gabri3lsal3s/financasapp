import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CreditCard, Expense } from '@/types'
import { resolveBillCompetence, type BillExpenseItem } from '@/utils/creditCardBilling'
import {
  parseCreditCardInvoiceCsv,
  reconcileCreditCardBill,
  analyzeInstallments,
  calculateInvoiceTotals,
  type ReconciliationResult,
  type InstallmentAnalysis,
  type InvoiceTotals,
} from '@/utils/creditCardCsvReconciliation'
import {
  learnFromCreditCardCsvInsertion,
  suggestFromCreditCardCsvLearning,
} from '@/utils/creditCardCsvLearning'
import { formatMoneyInput, parseMoneyInput } from '@/utils/format'
import { logger } from '@/utils/logger'
import {
  addDays,
  buildComparisonRows,
  buildConflictKey,
  installmentLabel,
  monthIndex,
  normalizeText,
  similarity,
  type CategoryOption,
  type ComparisonRow,
  type ConflictDraft,
  type MissingDraft,
  type ReconciliationWizardStep,
} from '@/utils/csvReconciliationUi'
import CsvAlertBanner from '@/components/creditCards/CsvAlertBanner'
import CsvConflictsStep from '@/components/creditCards/CsvConflictsStep'
import CsvMissingStep from '@/components/creditCards/CsvMissingStep'
import CsvReviewStep from '@/components/creditCards/CsvReviewStep'
import CsvStepFooter from '@/components/creditCards/CsvStepFooter'
import CsvSummaryStep from '@/components/creditCards/CsvSummaryStep'
import CsvSuspiciousStep from '@/components/creditCards/CsvSuspiciousStep'
import CsvUploadStep from '@/components/creditCards/CsvUploadStep'
import CsvWizardStepper from '@/components/creditCards/CsvWizardStepper'

interface CreditCardCsvReconciliationPanelProps {
  card: CreditCard
  currentMonth: string
  categories: CategoryOption[]
  onReloadBillData: () => Promise<void>
  createExpense: (expense: Omit<Expense, 'id' | 'created_at' | 'category' | 'credit_card'>) => Promise<{ data: Expense | null; error: string | null }>
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<{ data: Expense | null; error: string | null }>
  fetchReconciliationCandidates: (cardId: string, baseMonth: string) => Promise<BillExpenseItem[]>
}

export default function CreditCardCsvReconciliationPanel({
  card,
  currentMonth,
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
  const [filterTab, setFilterTab] = useState<'all' | 'missing' | 'conflicts' | 'matched'>('all')
  const [currentStep, setCurrentStep] = useState<ReconciliationWizardStep>('upload')
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

  const comparisonRows = useMemo<ComparisonRow[]>(
    () => buildComparisonRows(reconciliation),
    [reconciliation],
  )

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

  // Filtra os itens suspeitos (cadastrados no sistema mas não aparecem no CSV oficial)
  // Excluindo:
  // 1. Estornos registrados (aparecem como pagamento, não como despesa normal no CSV)
  // 2. Itens de competência de meses adjacentes (carregados para análise de parcelas, não são desta fatura)
  // 3. Itens já conciliados (matched ou conflict) — garantia contra duplicação por data/valor idênticos
  // 4. Itens com valor zero (não aparecem no CSV)
  const pendingSuspiciousItems = useMemo(() => {
    const reconciledIds = new Set<string>([
      ...(reconciliation?.matched ?? []).map((item) => String(item.existing.id || '')),
      ...(reconciliation?.conflicts ?? []).map((item) => String(item.existing.id || '')),
    ])

    return (reconciliation?.existingOnly ?? []).filter((item) => {
      if (item.category_id === '__refund_registered__') return false
      const amount = Math.abs(Number(item.base_amount ?? item.amount ?? 0))
      if (amount < 0.01) return false

      // Exclui itens de meses adjacentes (bill_competence fora do mês atual)
      const competence = String(item.bill_competence || '')
      if (competence && competence !== currentMonth) return false
      // Exclui itens que já foram conciliados (segurança extra contra duplicação interna)
      if (reconciledIds.has(String(item.id || ''))) return false

      return true
    }).filter((item) => !fixedSuspiciousIds.has(String(item.id || '')))
  }, [reconciliation, currentMonth, fixedSuspiciousIds])

  const handleCsvUpload = async (file: File) => {
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

      setConflictDrafts(result.conflicts.map((conflict) => {
        const key = buildConflictKey(String(conflict.existing.id || ''), String(conflict.official.id || ''))
        const analysis = conflictInstallmentAnalysis[key]
        const amountDelta = Math.abs(
          Math.abs(Number(conflict.existing.base_amount ?? conflict.existing.amount ?? 0))
          - Math.abs(Number(conflict.suggestedUpdate.amount || 0)),
        )
        const isDateOnlyConflict = amountDelta <= 0.009 && conflict.existing.date !== conflict.suggestedUpdate.date

        return {
          key,
          existingId: String(conflict.existing.id || ''),
          officialId: String(conflict.official.id || ''),
          selected: false,
          applied: (analysis?.status === 'consistent' && isDateOnlyConflict) || !conflict.suggestedUpdate.needsUpdate,
          autoResolvedByInstallment: Boolean(analysis?.status === 'consistent' && isDateOnlyConflict),
          date: conflict.suggestedUpdate.date,
          amount: formatMoneyInput(Math.abs(Number(conflict.suggestedUpdate.amount || 0))),
          existingDescription: String(conflict.existing.description || conflict.existing.category_name || 'Sem descrição'),
          officialDescription: String(conflict.official.description || ''),
          installmentLabel: conflict.suggestedUpdate.installmentLabel,
          isRefund: conflict.official.isRefund,
          installmentAnalysis: analysis || null,
        }
      }))

      setParseStatus('')
      setCurrentStep('summary')
    } catch (error) {
      logger.error('Error in handleCsvUpload:', error)
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

  const handleStartGuidedReconciliation = () => {
    if (reconciliation && reconciliation.conflicts.length > 0) {
      setCurrentStep('conflicts')
    } else if (reconciliation && reconciliation.missing.length > 0) {
      setCurrentStep('missing')
    } else if (pendingSuspiciousItems.length > 0) {
      setCurrentStep('suspicious')
    } else {
      setCurrentStep('review')
    }
  }

  return (
    <div className="space-y-4 overflow-x-hidden animate-page-enter">
      {/* Invisible anchor for scrolling to top */}
      <div ref={modalTopRef} />

      {reconciliation && currentStep !== 'upload' && (
        <CsvWizardStepper
          currentStep={currentStep}
          conflictCount={reconciliation.conflicts.length}
          missingCount={reconciliation.missing.length}
          suspiciousCount={pendingSuspiciousItems.length}
          onStepChange={setCurrentStep}
        />
      )}

      <CsvAlertBanner message={alertMessage} onClose={() => setAlertMessage(null)} />

      {currentStep === 'upload' && (
        <CsvUploadStep fileName={fileName} onFileSelected={handleCsvUpload} />
      )}

      {parseStatus && <p className="text-xs text-secondary">{parseStatus}</p>}

      {currentStep === 'summary' && reconciliation && (
        <CsvSummaryStep
          card={card}
          currentMonth={currentMonth}
          reconciliation={reconciliation}
          suspiciousCount={pendingSuspiciousItems.length}
          competenceMismatch={csvCompetenceMismatch}
          onStart={handleStartGuidedReconciliation}
        />
      )}

      {currentStep === 'review' && comparisonRows.length > 0 && (
        <CsvReviewStep
          comparisonRows={comparisonRows}
          filteredRows={filteredComparisonRows}
          filterTab={filterTab}
          onFilterTabChange={setFilterTab}
          totals={identifiedTotals}
          draftByOfficialId={draftByOfficialId}
        />
      )}

      {currentStep === 'conflicts' && reconciliation && (
        <CsvConflictsStep
          conflicts={reconciliation.conflicts}
          drafts={conflictDrafts}
          loading={loading}
          selectedCount={selectedConflictCount}
          onToggleSelect={(key) => {
            setConflictDrafts((previous) => previous.map((item) =>
              item.key === key
                ? { ...item, selected: !item.selected }
                : item,
            ))
          }}
          onUpdateDate={(key, date) => {
            setConflictDrafts((previous) => previous.map((item) =>
              item.key === key ? { ...item, date } : item,
            ))
          }}
          onUpdateAmount={(key, amount) => {
            setConflictDrafts((previous) => previous.map((item) =>
              item.key === key ? { ...item, amount } : item,
            ))
          }}
          onApply={handleApplySelectedSuggestions}
        />
      )}

      {currentStep === 'missing' && reconciliation && (
        <CsvMissingStep
          drafts={missingDrafts}
          categories={categories}
          loading={loading}
          selectedCount={selectedMissingCount}
          onToggleSelect={(id) => {
            setMissingDrafts((previous) => previous.map((item) =>
              item.id === id ? { ...item, selected: !item.selected } : item,
            ))
          }}
          onUpdateDate={(id, date) => setMissingDrafts((previous) => previous.map((item) =>
            item.id === id ? { ...item, date } : item,
          ))}
          onUpdateAmount={(id, amount) => setMissingDrafts((previous) => previous.map((item) =>
            item.id === id ? { ...item, amount } : item,
          ))}
          onUpdateDescription={(id, description) => setMissingDrafts((previous) => previous.map((item) =>
            item.id === id ? { ...item, description } : item,
          ))}
          onUpdateCategory={(id, categoryId) => setMissingDrafts((previous) => previous.map((item) =>
            item.id === id ? { ...item, category_id: categoryId } : item,
          ))}
          onApply={handleApplySelectedSuggestions}
        />
      )}

      {currentStep === 'suspicious' && reconciliation && (
        <CsvSuspiciousStep
          items={pendingSuspiciousItems}
          loading={loading}
          onUnlink={async (item) => {
            await updateExpense(item.id, { payment_method: 'other', credit_card_id: null, bill_competence: null })
            setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
          }}
          onIgnore={(item) => {
            setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
          }}
          onMove={async (item, newMonth) => {
            const result = await updateExpense(item.id, { bill_competence: newMonth })
            if (result.error) {
              triggerAlert(`Erro ao mover: ${result.error}`)
            } else {
              setFixedSuspiciousIds(prev => new Set([...prev, item.id]))
              await onReloadBillData()
            }
          }}
        />
      )}

      {reconciliation && currentStep !== 'upload' && (
        <CsvStepFooter currentStep={currentStep} onNavigate={setCurrentStep} />
      )}
    </div>
  )
}
