import { useMemo, useRef, useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { supabase } from '@/lib/supabase'
import type { PortfolioOperationType, PortfolioTransaction, PortfolioPricingMode } from '@/types'
import {
  parseB3Excel,
  reconcileInvestmentTransactions,
  classifyB3Item,
  type B3TransactionItem,
  type InvestmentReconciliationResult,
} from '@/utils/investmentExcelReconciliation'
import { isB3TickerPattern } from '@/services/priceService'
import { formatCurrency } from '@/utils/format'
import {
  fetchPortfolioCashContext,
  reconcileCashOffsetOnTransactionSave,
  deleteCashOffsetTransactions,
} from '@/services/cashOffsetService'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import { PORTFOLIO_PRICING_MODE_OPTIONS } from '@/constants/portfolioPricingMode'
import { Upload, FileCheck, ArrowRight, Layers, Check, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface InvestmentReconciliationModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  existingTransactions: PortfolioTransaction[]
  onSaved: () => void
  onOpenAssetConfig: (ticker: string) => void
}

interface MissingDraft {
  id: string
  selected: boolean
  ticker: string
  date: string
  operation_type: PortfolioOperationType
  quantity: string
  price: string
  pricing_mode: PortfolioPricingMode
  isB3Linked: boolean
  isTreasury: boolean
  product_name: string
  official: B3TransactionItem
}

interface ConflictDraft {
  key: string
  existingId: string
  officialId: string
  selected: boolean
  applied: boolean
  date: string
  quantity: string
  price: string
  operation_type: PortfolioOperationType
  official: B3TransactionItem
  existing: PortfolioTransaction
}

const OPERATION_OPTIONS: { value: PortfolioOperationType; label: string }[] = [
  { value: 'buy', label: 'Compra' },
  { value: 'sell', label: 'Venda' },
  { value: 'dividend', label: 'Provento/Div' },
  { value: 'split', label: 'Desdobrar' },
  { value: 'subscription', label: 'Subscrição' },
]

export default function InvestmentReconciliationModal({
  isOpen,
  onClose,
  portfolioId,
  existingTransactions,
  onSaved,
  onOpenAssetConfig,
}: InvestmentReconciliationModalProps) {
  const [fileName, setFileName] = useState('')
  const [parseStatus, setParseStatus] = useState('')
  const [reconciliation, setReconciliation] = useState<InvestmentReconciliationResult | null>(null)
  
  const [missingDrafts, setMissingDrafts] = useState<MissingDraft[]>([])
  const [conflictDrafts, setConflictDrafts] = useState<ConflictDraft[]>([])
  const [importedDrafts, setImportedDrafts] = useState<MissingDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null)
  const [excludedCount, setExcludedCount] = useState<{ fixedIncome: number; treasury: number }>({ fixedIncome: 0, treasury: 0 })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [currentStep, setCurrentStep] = useState<'upload' | 'summary' | 'conflicts' | 'missing' | 'suspicious' | 'review'>('upload')
  const [dragActive, setDragActive] = useState(false)
  const modalTopRef = useRef<HTMLDivElement | null>(null)

  const scrollToTop = () => {
    const container = modalTopRef.current?.closest('.overflow-y-auto')
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      modalTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Rola para o topo do modal ao trocar de etapa ou quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      scrollToTop()
    }
  }, [currentStep, isOpen])

  const manualYieldRequiredAssets = useMemo(() => {
    return importedDrafts.filter(draft => 
      draft.pricing_mode === 'fixed_income' || draft.pricing_mode === 'manual_value'
    )
  }, [importedDrafts])

  // Reset local states on open
  useEffect(() => {
    if (isOpen) {
      setFileName('')
      setParseStatus('')
      setReconciliation(null)
      setMissingDrafts([])
      setConflictDrafts([])
      setImportedDrafts([])
      setCurrentStep('upload')
      setProgress(null)
      setExcludedCount({ fixedIncome: 0, treasury: 0 })
    }
  }, [isOpen])

  const selectedMissingCount = useMemo(
    () => missingDrafts.filter((draft) => draft.selected).length,
    [missingDrafts]
  )

  const selectedConflictCount = useMemo(
    () => conflictDrafts.filter((draft) => draft.selected && !draft.applied).length,
    [conflictDrafts]
  )

  // Process a loaded array buffer (from drop or input file)
  const processFileBuffer = async (buffer: ArrayBuffer, name: string) => {
    setFileName(name)
    setParseStatus('Lendo e interpretando planilha...')
    try {
      const allParsedItems = parseB3Excel(buffer)
      
      if (allParsedItems.length === 0) {
        setParseStatus('O arquivo enviado não contém lançamentos reconhecíveis ou está vazio.')
        return
      }

      // ── Filtrar apenas renda variável B3 ──
      // Renda fixa e Tesouro Direto são excluídos da conciliação automática
      let fixedIncomeCount = 0
      let treasuryCount = 0
      const parsedItems = allParsedItems.filter(item => {
        const category = classifyB3Item(item.ticker, item.product_name)
        if (category === 'treasury') { treasuryCount++; return false }
        if (category === 'fixedIncome') { fixedIncomeCount++; return false }
        return true // equityB3 e other passam
      })
      setExcludedCount({ fixedIncome: fixedIncomeCount, treasury: treasuryCount })

      if (parsedItems.length === 0) {
        setParseStatus('O arquivo contém apenas ativos de renda fixa/Tesouro Direto, que não são conciliados automaticamente. Importe-os manualmente pelo livro-razão.')
        return
      }

      setParseStatus('Analisando correspondências no livro-razão...')
      const result = reconcileInvestmentTransactions(parsedItems, existingTransactions)

      setReconciliation(result)
      
      // Initialize editable missing drafts — somente renda variável B3
      setMissingDrafts(
        result.missing.map((item) => {
          const isB3 = isB3TickerPattern(item.ticker)
          // CORREÇÃO: Tesouro nunca deve ser 'market' (sem cotação Yahoo Finance)
          // Mas como já filtramos acima, esse fallback é segurança extra
          const pricingMode: PortfolioPricingMode = isB3 ? 'market' : 'fixed_income'
          return {
            id: item.id,
            selected: true,
            ticker: item.ticker,
            date: item.date,
            operation_type: item.operation_type,
            quantity: String(item.quantity),
            price: String(item.price),
            pricing_mode: pricingMode,
            isB3Linked: isB3,
            isTreasury: false, // Tesouro filtrado antes de chegar aqui
            product_name: item.product_name,
            official: item,
          }
        })
      )

      // Initialize conflict drafts
      setConflictDrafts(
        result.conflicts.map((conflict) => ({
          key: `${conflict.existing.id}::${conflict.official.id}`,
          existingId: conflict.existing.id,
          officialId: conflict.official.id,
          selected: true,
          applied: !conflict.suggestedUpdate.needsUpdate,
          date: conflict.suggestedUpdate.date,
          quantity: String(conflict.suggestedUpdate.quantity),
          price: String(conflict.suggestedUpdate.price),
          operation_type: conflict.suggestedUpdate.operation_type,
          official: conflict.official,
          existing: conflict.existing,
        }))
      )

      setParseStatus('')
      setCurrentStep('summary')
    } catch (err: any) {
      console.error(err)
      setParseStatus(err.message || 'Erro ao carregar o arquivo Excel. Verifique se o formato está correto.')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    await processFileBuffer(buffer, file.name)
  }

  // Drag & drop logic
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        await processFileBuffer(buffer, file.name)
      } else {
        toast.error('Por favor, envie apenas arquivos em formato Excel (.xlsx)')
      }
    }
  }

  // Missing draft handlers for inline customization
  const updateMissingDraft = <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => {
    setMissingDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== id) return draft
        const next = { ...draft, [key]: value }
        
        // Auto toggles if ticker changes
        if (key === 'ticker') {
          const tick = String(value).toUpperCase()
          next.isB3Linked = isB3TickerPattern(tick)
          next.isTreasury = tick.includes('TESOURO')
        }
        
        return next
      })
    )
  }

  // Apply conflicts to DB
  const handleApplySelectedConflicts = async () => {
    const activeConflicts = conflictDrafts.filter((c) => c.selected && !c.applied)
    if (activeConflicts.length === 0) return

    setLoading(true)
    setProgress({ current: 0, total: activeConflicts.length, label: 'Corrigindo divergências...' })
    scrollToTop()
    try {
      let appliedCount = 0
      for (const [index, draft] of activeConflicts.entries()) {
        setProgress({ current: index + 1, total: activeConflicts.length, label: `Corrigindo: ${draft.official.ticker}` })
        const qty = parseFloat(draft.quantity)
        const prc = parseFloat(draft.price)
        
        if (isNaN(qty) || qty <= 0 || isNaN(prc) || prc < 0) {
          toast.error(`Valores inválidos para a correção do ativo ${draft.official.ticker}`)
          continue
        }

        const { error } = await supabase
          .from('portfolio_transactions')
          .update({
            date: draft.date,
            quantity: qty,
            price: prc,
            operation_type: draft.operation_type,
          })
          .eq('id', draft.existingId)
          .eq('portfolio_id', portfolioId)

        if (error) throw error

        // Automatically sync cash offsets for this transaction
        const pricingMode = draft.official.ticker.toUpperCase().includes('TESOURO')
          ? 'market'
          : isB3TickerPattern(draft.official.ticker) ? 'market' : 'fixed_income'

        const context = await fetchPortfolioCashContext(portfolioId)
        await reconcileCashOffsetOnTransactionSave({
          portfolioId,
          transactionId: draft.existingId,
          amount: qty * prc,
          date: draft.date,
          assetPricingMode: pricingMode,
          operationType: draft.operation_type,
          transactions: context.transactions,
          definitions: context.definitions,
        })

        // Mark as applied in local state
        setConflictDrafts((prev) =>
          prev.map((c) => (c.key === draft.key ? { ...c, applied: true, selected: false } : c))
        )
        appliedCount++
      }

      setProgress({ current: activeConflicts.length, total: activeConflicts.length, label: 'Sincronizando saldo de caixa...' })
      // Sync total cash balance
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)
      await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      toast.success(`${appliedCount} divergências foram corrigidas no livro-razão!`)
      
      // Update our parent portfolio view
      onSaved()
      
      // Auto advance
      if (missingDrafts.length > 0) {
        setCurrentStep('missing')
      } else if (reconciliation && reconciliation.existingOnly.length > 0) {
        setCurrentStep('suspicious')
      } else {
        setCurrentStep('review')
      }
    } catch (err) {
      console.error(err)
      toast.error('Ocorreu um erro ao aplicar as correções no banco de dados.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  // Bulk import missing items into DB (fully customized)
  const handleImportSelectedMissing = async () => {
    const activeMissing = missingDrafts.filter((m) => m.selected)
    if (activeMissing.length === 0) return

    setLoading(true)
    setProgress({ current: 0, total: activeMissing.length, label: 'Iniciando importação...' })
    scrollToTop()
    try {
      let importedCount = 0
      for (const [index, draft] of activeMissing.entries()) {
        setProgress({ current: index + 1, total: activeMissing.length, label: `Importando: ${draft.ticker}` })
        const qty = parseFloat(draft.quantity)
        const prc = parseFloat(draft.price)
        const tickerUpper = draft.ticker.toUpperCase().trim()

        if (!tickerUpper) {
          toast.error(`Ticker em branco para o item de data ${draft.date}`)
          continue
        }
        if (isNaN(qty) || qty <= 0) {
          toast.error(`Quantidade inválida para o ativo ${tickerUpper}`)
          continue
        }
        if (isNaN(prc) || prc < 0) {
          toast.error(`Preço inválido para o ativo ${tickerUpper}`)
          continue
        }

        // 1. Insert portfolio_transactions
        const { data: inserted, error: insertError } = await supabase
          .from('portfolio_transactions')
          .insert({
            portfolio_id: portfolioId,
            ticker: tickerUpper,
            date: draft.date,
            quantity: qty,
            price: prc,
            operation_type: draft.operation_type,
          })
          .select('id')
          .single()

        if (insertError) throw insertError

        // 2. Upsert portfolio_asset_definitions
        const { error: defError } = await supabase
          .from('portfolio_asset_definitions')
          .upsert(
            {
              portfolio_id: portfolioId,
              ticker: tickerUpper,
              pricing_mode: draft.pricing_mode,
              is_b3_linked: draft.pricing_mode === 'market' ? draft.isB3Linked : false,
              applied_amount: draft.pricing_mode !== 'market' ? prc * qty : null,
              application_date: draft.date,
              is_treasury: draft.pricing_mode === 'market' ? draft.isTreasury : false,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'portfolio_id,ticker',
            }
          )

        if (defError) throw defError

        // 3. Automatically sync cash offsets for this transaction
        const context = await fetchPortfolioCashContext(portfolioId)
        await reconcileCashOffsetOnTransactionSave({
          portfolioId,
          transactionId: inserted.id,
          amount: qty * prc,
          date: draft.date,
          assetPricingMode: draft.pricing_mode,
          operationType: draft.operation_type,
          transactions: context.transactions,
          definitions: context.definitions,
        })

        importedCount++
      }

      setProgress({ current: activeMissing.length, total: activeMissing.length, label: 'Sincronizando saldo de caixa...' })
      // Sync total cash balance
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)
      await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      toast.success(`${importedCount} novos lançamentos inseridos com sucesso no livro-razão!`)
      
      // Remove successfully imported rows from drafts list
      setImportedDrafts((prev) => [...prev, ...activeMissing])
      setMissingDrafts((prev) => prev.filter((d) => !d.selected))
      
      // Update parent list
      onSaved()

      // Auto advance
      if (reconciliation && reconciliation.existingOnly.length > 0) {
        setCurrentStep('suspicious')
      } else {
        setCurrentStep('review')
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao efetuar a importação em lote.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  // Handle deletion of suspicious ledger-only transaction
  const handleDeleteLedgerOnlyTransaction = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta transação do Livro-Razão? Ela sairá permanentemente do histórico do cliente.')) return
    
    try {
      await deleteCashOffsetTransactions(portfolioId, id)
      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', id)
        .eq('portfolio_id', portfolioId)

      if (error) throw error

      // Sync total cash balance
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)
      await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      toast.success('Lançamento excluído com sucesso!')
      onSaved()
      
      if (reconciliation) {
        setReconciliation({
          ...reconciliation,
          existingOnly: reconciliation.existingOnly.filter((tx) => tx.id !== id),
        })
      }
    } catch (err) {
      toast.error('Erro ao excluir transação.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conciliação de Ativos com Extrato B3"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Invisible anchor for scrolling to top */}
        <div ref={modalTopRef} />
        
        {/* ── Progress Overlay ── */}
        {loading && progress && (
          <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/25 p-4 space-y-2.5 animate-pulse-slow">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
                {progress.label}
              </span>
              <span className="text-secondary tabular-nums">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-secondary text-right tabular-nums">
              {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}% concluído
            </p>
          </div>
        )}

        {/* Stepper Wizard UX */}
        {reconciliation && (
          <div className="flex flex-col gap-2 border-b border-primary/20 pb-4 mb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
              {[
                { id: 'summary', label: '1. Diagnóstico', count: undefined },
                { id: 'conflicts', label: '2. Divergências', count: conflictDrafts.filter(c => !c.applied).length },
                { id: 'missing', label: '3. Faltando no Sistema', count: missingDrafts.length },
                { id: 'suspicious', label: '4. Alertas Livro-Razão', count: reconciliation.existingOnly.length },
                { id: 'review', label: '5. Resumo Final', count: undefined }
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
                    className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
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

        {/* STEP 1: Upload */}
        {currentStep === 'upload' && (
          <div className="space-y-4 text-center">
            <div className="max-w-md mx-auto">
              <p className="text-sm font-semibold text-primary">Importação de Relatórios de Movimentação B3</p>
              <p className="text-xs text-secondary mt-1">
                Faça o upload do extrato de movimentação consolidado em Excel da B3 (.xlsx) para auditar lançamentos e manter os saldos precisos.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 max-w-lg mx-auto flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/5 scale-[1.01]'
                  : 'border-primary/30 bg-primary/20 hover:border-indigo-500/50 hover:bg-indigo-500/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <Upload size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Arraste e solte o arquivo da B3 aqui</p>
                <p className="text-[10px] text-secondary mt-1">ou clique para procurar no computador</p>
              </div>
              <span className="text-[9px] font-mono text-secondary/60 bg-secondary/50 px-2 py-0.5 rounded border border-border/30">
                Suporta formato B3 oficial (.xlsx)
              </span>
            </div>

            {parseStatus && (
              <div className="text-xs text-secondary animate-pulse max-w-sm mx-auto bg-secondary border border-primary/20 px-4 py-2 rounded-xl mt-2 font-mono">
                {parseStatus}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Summary / Diagnostic */}
        {currentStep === 'summary' && reconciliation && (
          <div className="space-y-6 text-center animate-page-enter">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto shadow-sm">
              <FileCheck size={28} />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-base font-black text-primary uppercase tracking-tight">Extrato da B3 Processado com Sucesso!</h4>
              <p className="text-xs text-secondary max-w-md mx-auto">
                Diagnosticamos a planilha <strong>{fileName}</strong> cruzando-a com todo o histórico do Livro-Razão deste cliente:
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-2xl">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-secondary block">Conciliados</span>
                <span className="text-xl font-mono font-black text-emerald-500 mt-1 block">{reconciliation.matched.length}</span>
                <span className="text-[9px] text-secondary/70 mt-0.5 block">100% idênticos</span>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-2xl">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-secondary block">Divergentes</span>
                <span className="text-xl font-mono font-black text-amber-500 mt-1 block">
                  {conflictDrafts.filter(c => !c.applied).length}
                </span>
                <span className="text-[9px] text-secondary/70 mt-0.5 block">Diferenças de dados</span>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 p-3.5 rounded-2xl">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-secondary block">Faltando</span>
                <span className="text-xl font-mono font-black text-red-500 mt-1 block">{missingDrafts.length}</span>
                <span className="text-[9px] text-secondary/70 mt-0.5 block">Ausentes no sistema</span>
              </div>
              <div className="bg-purple-500/5 border border-purple-500/20 p-3.5 rounded-2xl">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-secondary block">Alertas Razão</span>
                <span className="text-xl font-mono font-black text-purple-500 mt-1 block">{reconciliation.existingOnly.length}</span>
                <span className="text-[9px] text-secondary/70 mt-0.5 block">Não constam na B3</span>
              </div>
            </div>

            {/* Banner: itens excluídos da conciliação */}
            {(excludedCount.fixedIncome > 0 || excludedCount.treasury > 0) && (
              <div className="max-w-2xl mx-auto w-full bg-amber-500/8 border border-amber-500/25 rounded-2xl p-3.5 text-left flex gap-3 items-start">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-amber-400">Ativos de Renda Fixa / Tesouro não conciliados</p>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    A conciliação automática com a B3 é exclusiva para <strong>renda variável</strong> (Ações, FIIs e ETFs).
                    {excludedCount.treasury > 0 && (
                      <span> <strong>{excludedCount.treasury}</strong> lançamento{excludedCount.treasury > 1 ? 's' : ''} de Tesouro Direto</span>
                    )}
                    {excludedCount.treasury > 0 && excludedCount.fixedIncome > 0 && ' e'}
                    {excludedCount.fixedIncome > 0 && (
                      <span> <strong>{excludedCount.fixedIncome}</strong> lançamento{excludedCount.fixedIncome > 1 ? 's' : ''} de renda fixa (CDB/LCI/LCA)</span>
                    )}
                    {' '}foram ignorados. Adicione-os manualmente pelo Livro-Razão com as taxas contratuais para valoração correta.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (conflictDrafts.filter(c => !c.applied).length > 0) {
                    setCurrentStep('conflicts')
                  } else if (missingDrafts.length > 0) {
                    setCurrentStep('missing')
                  } else if (reconciliation.existingOnly.length > 0) {
                    setCurrentStep('suspicious')
                  } else {
                    setCurrentStep('review')
                  }
                }}
                className="px-6 font-bold"
              >
                Iniciar Conciliação Guiada
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Conflicts Resolution */}
        {currentStep === 'conflicts' && reconciliation && (
          <div className="space-y-4 animate-page-enter">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm font-black text-primary uppercase tracking-tight">Lançamentos Divergentes</h5>
                <p className="text-[10px] text-secondary">
                  Lançamentos encontrados com valores ou datas que não batem com o extrato oficial B3.
                </p>
              </div>
              <span className="text-xs text-secondary font-bold">
                {selectedConflictCount} selecionados de {conflictDrafts.filter(c => !c.applied).length}
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {conflictDrafts.filter(c => !c.applied).map((draft) => {
                const isPriceDiff = Math.abs(draft.existing.price - draft.official.price) > 0.0001
                const isQtyDiff = Math.abs(draft.existing.quantity - draft.official.quantity) > 0.0001
                const isDateDiff = draft.existing.date !== draft.official.date

                return (
                  <div
                    key={draft.key}
                    className="p-3.5 bg-secondary/30 border border-primary rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-left"
                  >
                    <div className="md:col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-primary bg-primary text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:outline-none cursor-pointer"
                        checked={draft.selected}
                        onChange={(e) =>
                          setConflictDrafts((prev) =>
                            prev.map((c) => (c.key === draft.key ? { ...c, selected: e.target.checked } : c))
                          )
                        }
                      />
                    </div>

                    {/* Livro-Razão (Atual) */}
                    <div className="md:col-span-5 bg-card border border-border/40 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-primary font-bold">{draft.existing.ticker}</strong>
                        <span className="px-1.5 py-0.2 bg-red-500/10 text-red-500 rounded text-[9px] uppercase font-bold">
                          Livro-Razão
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-secondary font-mono text-[10px]">
                        <div>
                          <span>Data</span>
                          <span className={`block font-bold text-primary ${isDateDiff ? 'text-amber-500' : ''}`}>{draft.existing.date}</span>
                        </div>
                        <div>
                          <span>Qtd</span>
                          <span className={`block font-bold text-primary ${isQtyDiff ? 'text-amber-500' : ''}`}>
                            {draft.existing.quantity} un
                          </span>
                        </div>
                        <div>
                          <span>Preço</span>
                          <span className={`block font-bold text-primary ${isPriceDiff ? 'text-amber-500' : ''}`}>
                            {formatCurrency(draft.existing.price)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex items-center justify-center text-secondary">
                      <ArrowRight size={18} />
                    </div>

                    {/* B3 (Sugerido) */}
                    <div className="md:col-span-5 bg-indigo-500/5 border border-indigo-500/20 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-primary font-bold">{draft.official.ticker}</strong>
                        <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[9px] uppercase font-bold">
                          B3 Oficial
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-secondary font-mono text-[10px]">
                        <div>
                          <span>Data</span>
                          <span className={`block font-bold text-primary ${isDateDiff ? 'text-indigo-500 font-extrabold' : ''}`}>{draft.official.date}</span>
                        </div>
                        <div>
                          <span>Qtd</span>
                          <span className={`block font-bold text-primary ${isQtyDiff ? 'text-indigo-500 font-extrabold' : ''}`}>
                            {draft.official.quantity} un
                          </span>
                        </div>
                        <div>
                          <span>Preço</span>
                          <span className={`block font-bold text-primary ${isPriceDiff ? 'text-indigo-500 font-extrabold' : ''}`}>
                            {formatCurrency(draft.official.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('summary')}>
                Voltar
              </Button>
              <Button
                variant="primary"
                disabled={loading || selectedConflictCount === 0}
                onClick={handleApplySelectedConflicts}
                className="font-bold flex items-center gap-1.5"
              >
                {loading ? 'Aplicando correções...' : `Aplicar ${selectedConflictCount} Correções`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Missing (Editable & Customizable) */}
        {currentStep === 'missing' && (
          <div className="space-y-4 animate-page-enter">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
              <div>
                <h5 className="text-sm font-black text-primary uppercase tracking-tight">Lançamentos Faltantes no Livro-Razão</h5>
                <p className="text-[10px] text-secondary">
                  Movimentações presentes na B3 que ainda não foram inseridas no sistema. <span className="text-amber-500 font-bold">Você pode editar os campos antes de importar caso falte algum dado ou queira personalizar!</span>
                </p>
              </div>
              <span className="text-xs text-secondary font-bold shrink-0">
                {selectedMissingCount} de {missingDrafts.length} selecionados
              </span>
            </div>

            {/* Customization grid / table */}
            <div className="overflow-x-auto border border-primary rounded-2xl bg-secondary/5">
              <table className="w-full border-collapse text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="bg-secondary border-b border-primary text-[10px] font-bold text-secondary uppercase tracking-wider">
                    <th className="p-3 text-center w-12">Importar</th>
                    <th className="p-3 w-28">Ticker</th>
                    <th className="p-3 w-32">Operação</th>
                    <th className="p-3 w-32">Data</th>
                    <th className="p-3 w-24 text-right">Qtd</th>
                    <th className="p-3 w-32 text-right">Preço Un.</th>
                    <th className="p-3 w-40 text-left">Tipo de Ativo (Definição)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary font-mono">
                  {missingDrafts.map((draft) => (
                    <tr
                      key={draft.id}
                      className={`hover:bg-secondary/40 transition-colors ${
                        draft.selected ? 'bg-indigo-500/5' : 'opacity-70'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-primary bg-primary text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:outline-none cursor-pointer"
                          checked={draft.selected}
                          onChange={(e) => updateMissingDraft(draft.id, 'selected', e.target.checked)}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={draft.ticker}
                          onChange={(e) => updateMissingDraft(draft.id, 'ticker', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 uppercase text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={draft.operation_type}
                          onChange={(e) =>
                            updateMissingDraft(draft.id, 'operation_type', e.target.value as PortfolioOperationType)
                          }
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-1.5 py-1 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans"
                        >
                          {OPERATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) => updateMissingDraft(draft.id, 'date', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={draft.quantity}
                          onChange={(e) => updateMissingDraft(draft.id, 'quantity', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 text-right text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={draft.price}
                          onChange={(e) => updateMissingDraft(draft.id, 'price', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 text-right text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-left">
                        <select
                          value={draft.pricing_mode}
                          onChange={(e) =>
                            updateMissingDraft(draft.id, 'pricing_mode', e.target.value as PortfolioPricingMode)
                          }
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-1.5 py-1 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans"
                        >
                          {PORTFOLIO_PRICING_MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('conflicts')}>
                Voltar
              </Button>
              <Button
                variant="primary"
                disabled={loading || selectedMissingCount === 0}
                onClick={handleImportSelectedMissing}
                className="font-bold flex items-center gap-1.5"
              >
                {loading ? 'Importando...' : `Importar ${selectedMissingCount} Lançamentos`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Suspicious (Ledger-Only Alertas) */}
        {currentStep === 'suspicious' && reconciliation && (
          <div className="space-y-4 animate-page-enter">
            <div className="text-left">
              <h5 className="text-sm font-black text-primary uppercase tracking-tight">Lançamentos Exclusivos do Livro-Razão</h5>
              <p className="text-[10px] text-secondary">
                Estes lançamentos existem apenas no sistema no período analisado, mas não constam no extrato B3 enviado. Podem ser duplicatas ou inserções manuais incorretas.
              </p>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 text-left">
              {reconciliation.existingOnly.length === 0 ? (
                <p className="text-xs text-secondary italic py-6 text-center">Nenhum alerta pendente.</p>
              ) : (
                reconciliation.existingOnly.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center justify-between text-xs transition-all hover:bg-red-500/10"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-primary font-bold font-mono">{tx.ticker}</strong>
                        <span className="px-1.5 py-0.2 bg-red-500/10 text-red-500 rounded text-[9px] uppercase font-bold">
                          Exclusivo do Sistema
                        </span>
                      </div>
                      <div className="text-[10px] text-secondary mt-1 font-mono">
                        <span>Data: <strong>{tx.date}</strong></span>
                        <span className="mx-2">•</span>
                        <span>Qtd: <strong>{tx.quantity}</strong></span>
                        <span className="mx-2">•</span>
                        <span>Preço: <strong>{formatCurrency(tx.price)}</strong></span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteLedgerOnlyTransaction(tx.id)}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-white px-3 font-semibold text-xs py-1"
                    >
                      Excluir Lançamento
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('missing')}>
                Voltar
              </Button>
              <Button
                variant="primary"
                onClick={() => setCurrentStep('review')}
                className="font-bold flex items-center gap-1.5"
              >
                Prosseguir para Resumo
              </Button>
            </div>
          </div>
        )}

        {/* STEP 6: Review */}
        {currentStep === 'review' && reconciliation && (
          <div className="space-y-5 text-center animate-page-enter">
            <div className="w-14 h-14 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <Layers size={26} />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-primary uppercase tracking-tight">Revisão Final da Conciliação</h4>
              <p className="text-xs text-secondary max-w-sm mx-auto leading-relaxed">
                Você concluiu o processo de auditoria e correção do Livro-Razão de Investimentos com a B3!
              </p>
            </div>

            <div className="bg-secondary/40 border border-primary p-4 rounded-3xl max-w-md mx-auto space-y-3 font-sans text-left">
              <h5 className="font-extrabold text-xs text-primary uppercase tracking-wider mb-2">Resumo Geral do Portfólio</h5>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-secondary">Total de Itens Analisados:</span>
                  <span className="font-bold text-primary">
                    {reconciliation.matched.length + reconciliation.conflicts.length + reconciliation.missing.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Itens Conciliados / OK:</span>
                  <span className="font-bold text-emerald-500">
                    {reconciliation.matched.length + conflictDrafts.filter(c => c.applied).length}
                  </span>
                </div>
                <div className="flex justify-between border-t border-primary/10 pt-2 font-sans font-black text-sm text-primary mt-3">
                   <span>Status Geral:</span>
                   <span className="text-emerald-500 flex items-center gap-1">
                     <Check size={16} /> 100% Sincronizado
                   </span>
                 </div>
               </div>
             </div>

             {manualYieldRequiredAssets.length > 0 && (
               <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-3xl max-w-md mx-auto text-left space-y-3">
                 <div className="flex items-start gap-2.5">
                   <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                   <div>
                     <h6 className="font-extrabold text-xs text-primary uppercase tracking-wider">Configuração de Rentabilidade Requerida</h6>
                     <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
                       Identificamos ativos de Renda Fixa ou de valor manual recém-importados. Configure a taxa acordada (ex: % do CDI) ou o valor manual atualizado:
                     </p>
                   </div>
                 </div>
                 <div className="space-y-2 pt-1">
                   {manualYieldRequiredAssets.map((asset) => (
                     <div key={asset.ticker} className="flex items-center justify-between bg-primary p-2.5 rounded-xl border border-primary/40 text-xs">
                       <div className="overflow-hidden mr-2">
                         <strong className="text-primary font-mono block truncate max-w-[200px]" title={asset.ticker}>
                           {asset.ticker}
                         </strong>
                         <span className="text-[10px] text-secondary block font-sans">
                           {asset.pricing_mode === 'fixed_income' ? 'Renda Fixa' : 'Valor Manual'}
                         </span>
                       </div>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => onOpenAssetConfig(asset.ticker)}
                         className="flex items-center gap-1 border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 py-1 px-2.5 font-bold text-[10px] shrink-0"
                       >
                         Configurar
                       </Button>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('upload')}>
                Conciliar Outro Extrato
              </Button>
              <Button variant="primary" onClick={onClose} className="font-bold">
                Concluir Auditoria
              </Button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
