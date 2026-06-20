import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ModalFieldRow from '@/components/ModalFieldRow'
import ModalInfoPanel from '@/components/ModalInfoPanel'
import ModalSummaryPanel from '@/components/ModalSummaryPanel'
import Input from '@/components/Input'
import Checkbox from '@/components/Checkbox'
import { supabase } from '@/lib/supabase'
import Select from '@/components/Select'
import { searchB3Assets, getAssetRichData } from '@/services/priceService'
import {
  isCashTicker,
  isFixedIncomeTicker,
  isB3VariableTicker,
  toPricingMode,
  isTreasury as checkIsTreasury,
  detectCurrency,
} from '@/utils/assetClassifier'
import ConfirmModal from '@/components/ConfirmModal'
import type {
  PortfolioOperationType,
  PortfolioTransaction,
  PortfolioPricingMode,
  PortfolioAssetDefinition,
} from '@/types'
import { formatCurrency, formatMoneyInput, formatNumberBR, formatQuantityBR } from '@/utils/format'
import { PORTFOLIO_PRICING_MODE_OPTIONS } from '@/constants/portfolioPricingMode'
import { computeCashOffsetPreview, excludeCashOffsetSells, calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import {
  fetchPortfolioCashContext,
  reconcileCashOffsetOnTransactionSave,
  deleteCashOffsetTransactions,
} from '@/services/cashOffsetService'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'
import toast from 'react-hot-toast'
import { PORTFOLIO_OPERATION_OPTIONS } from '@/utils/portfolioOperations'

interface AssetRichData {
  name: string
  price: number
  dividendYield?: number
}

interface PortfolioTransactionFormModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  editingTransaction: PortfolioTransaction | null
  onSaved: () => void
  defaultTicker?: string
  zIndexClass?: string
}

const OPERATION_OPTIONS = PORTFOLIO_OPERATION_OPTIONS

function resetPricingFields(setters: {
  setPricingMode: (v: PortfolioPricingMode) => void
  setIsB3Linked: (v: boolean) => void
  setContractRate: (v: string) => void
  setIndexer: (v: 'none' | 'cdi' | 'selic' | 'ipca') => void
  setManualCurrentValue: (v: string) => void
  setTaxExempt: (v: boolean) => void
  setIsTreasury: (v: boolean) => void
}) {
  setters.setPricingMode('market')
  setters.setIsB3Linked(true)
  setters.setContractRate('')
  setters.setIndexer('none')
  setters.setManualCurrentValue('')
  setters.setTaxExempt(false)
  setters.setIsTreasury(false)
}

function applyDefinitionToForm(
  definition: PortfolioAssetDefinition,
  setters: {
    setPricingMode: (v: PortfolioPricingMode) => void
    setIsB3Linked: (v: boolean) => void
    setContractRate: (v: string) => void
    setIndexer: (v: 'none' | 'cdi' | 'selic' | 'ipca') => void
    setManualCurrentValue: (v: string) => void
    setTaxExempt: (v: boolean) => void
    setIsTreasury: (v: boolean) => void
  }
) {
  setters.setPricingMode(definition.pricing_mode)
  setters.setIsB3Linked(definition.is_b3_linked)
  setters.setContractRate(definition.contract_rate != null ? String(definition.contract_rate) : '')
  setters.setIndexer(definition.indexer)
  setters.setManualCurrentValue(
    definition.manual_current_value != null ? String(definition.manual_current_value) : ''
  )
  setters.setTaxExempt(definition.tax_exempt)
  setters.setIsTreasury(definition.is_treasury)
}

export default function PortfolioTransactionFormModal({
  isOpen,
  onClose,
  portfolioId,
  editingTransaction,
  onSaved,
  defaultTicker,
  zIndexClass,
}: PortfolioTransactionFormModalProps) {
  const [ticker, setTicker] = useState('')
  const [operationType, setOperationType] = useState<PortfolioOperationType>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [richData, setRichData] = useState<AssetRichData | null>(null)
  const [loadingRichData, setLoadingRichData] = useState(false)
  const [pricingMode, setPricingMode] = useState<PortfolioPricingMode>('market')
  const [isB3Linked, setIsB3Linked] = useState(true)
  const [contractRate, setContractRate] = useState('')
  const [indexer, setIndexer] = useState<'none' | 'cdi' | 'selic' | 'ipca'>('none')
  const [manualCurrentValue, setManualCurrentValue] = useState('')
  const [taxExempt, setTaxExempt] = useState(false)
  const [isTreasury, setIsTreasury] = useState(false)
  const [portfolioTransactions, setPortfolioTransactions] = useState<PortfolioTransaction[]>([])
  const [portfolioDefinitions, setPortfolioDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [portfolioTargets, setPortfolioTargets] = useState<{ ticker: string; target_percentage: number }[]>([])
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [indexerPercent, setIndexerPercent] = useState('100')
  const [maturityDate, setMaturityDate] = useState('')
  const [targetPct, setTargetPct] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  const tUpper = ticker.trim().toUpperCase()
  const isB3Var = isB3VariableTicker(tUpper)
  const isFixedInc = isFixedIncomeTicker(tUpper)
  const isCash = isCashTicker(tUpper)

  const isPricingModeLocked = isB3Var || isFixedInc || isCash

  // Re-classify dynamically as the user types/selects the ticker
  useEffect(() => {
    const t = ticker.trim().toUpperCase()
    if (!t) return

    const mode = toPricingMode(t)
    if (mode === 'market') {
      setPricingMode('market')
      setIsB3Linked(true)
      setIsTreasury(false)
    } else if (mode === 'fixed_income') {
      setPricingMode('fixed_income')
      setIsB3Linked(false)
      setIsTreasury(checkIsTreasury(t))
    } else if (mode === 'cash') {
      setPricingMode('cash')
      setIsB3Linked(false)
      setIsTreasury(false)
    }
  }, [ticker])

  const pricingSetters = useMemo(() => ({
    setPricingMode,
    setIsB3Linked,
    setContractRate,
    setIndexer,
    setManualCurrentValue,
    setTaxExempt,
    setIsTreasury,
  }), [setPricingMode, setIsB3Linked, setContractRate, setIndexer, setManualCurrentValue, setTaxExempt, setIsTreasury])

  useEffect(() => {
    if (!isOpen) return

    if (editingTransaction) {
      setTicker(editingTransaction.ticker)
      setOperationType(editingTransaction.operation_type)
      setQuantity(String(editingTransaction.quantity))
      setPrice(String(editingTransaction.price))
      setDate(editingTransaction.date)
      setContractRate(editingTransaction.contract_rate != null ? String(editingTransaction.contract_rate) : '')
    } else {
      setTicker(defaultTicker || '')
      setOperationType('buy')
      setQuantity('')
      setPrice('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      resetPricingFields(pricingSetters)
    }
    setSuggestions([])
    setShowSuggestions(false)
    setRichData(null)
  }, [isOpen, editingTransaction, defaultTicker, pricingSetters])

  useEffect(() => {
    if (!isOpen || !portfolioId) return

    const loadCashContext = async () => {
      const { transactions, definitions } = await fetchPortfolioCashContext(portfolioId)
      setPortfolioTransactions(transactions)
      setPortfolioDefinitions(definitions)

      const { data: targets } = await supabase
        .from('target_allocations')
        .select('ticker, target_percentage')
        .eq('portfolio_id', portfolioId)
      if (targets) {
        setPortfolioTargets(targets)
      }
    }

    void loadCashContext()
  }, [isOpen, portfolioId])

  useEffect(() => {
    if (!isOpen || !portfolioId) return

    const tickerUpper = ticker.toUpperCase().trim()
    if (!tickerUpper) {
      resetPricingFields(pricingSetters)
      setCurrency('BRL')
      setIndexerPercent('100')
      setMaturityDate('')
      setTargetPct('')
      return
    }

    const existingDef = portfolioDefinitions.find(
      (d) => d.ticker.toUpperCase() === tickerUpper
    )
    if (existingDef) {
      applyDefinitionToForm(existingDef, pricingSetters)
      setCurrency(existingDef.currency || detectCurrency(tickerUpper))
      setIndexerPercent(String(existingDef.indexer_percent ?? 100))
      setMaturityDate(existingDef.maturity_date ?? '')
    } else {
      resetPricingFields(pricingSetters)
      setIsB3Linked(isB3VariableTicker(tickerUpper))
      setCurrency(detectCurrency(tickerUpper))
      setIndexerPercent('100')
      setMaturityDate('')
    }

    const existingTarget = portfolioTargets.find(
      (t) => t.ticker.toUpperCase() === tickerUpper
    )
    if (existingTarget) {
      setTargetPct(String(existingTarget.target_percentage))
    } else {
      setTargetPct('')
    }
  }, [isOpen, ticker, portfolioDefinitions, portfolioTargets, portfolioId, pricingSetters])

  useEffect(() => {
    if (!isOpen || ticker.length < 3 || pricingMode !== 'market') {
      setRichData(null)
      return
    }

    const timer = setTimeout(async () => {
      setLoadingRichData(true)
      try {
        const data = await getAssetRichData(ticker)
        if (data) {
          setRichData(data as AssetRichData)
          if (!editingTransaction && (!price || price === '0')) {
            setPrice(formatMoneyInput(data.price))
          }
        } else {
          setRichData(null)
        }
      } catch {
        setRichData(null)
      } finally {
        setLoadingRichData(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [ticker, isOpen, editingTransaction, price, pricingMode])

  const handleTickerChange = async (val: string) => {
    const valUpper = val.toUpperCase()
    setTicker(valUpper)
    if (pricingMode === 'market' && valUpper.length >= 2) {
      const results = await searchB3Assets(valUpper)
      setSuggestions(results)
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
      setRichData(null)
    }
  }

  const handlePricingModeChange = (mode: PortfolioPricingMode) => {
    setPricingMode(mode)
    if (mode === 'cash') {
      setIsB3Linked(false)
      setIsTreasury(false)
      setContractRate('')
      setIndexer('none')
      setManualCurrentValue('')
    }
  }

  const dispatchPortfolioChanged = () => {
    window.dispatchEvent(
      new CustomEvent('local-data-changed', { detail: { entity: 'portfolio_transactions' } })
    )
  }

  const buildDefinitionPayload = (
    tickerUpper: string,
    unitPrice: number,
    qty: number
  ) => {
    const isFixedOrTreasury = pricingMode === 'fixed_income' || isTreasury || checkIsTreasury(tickerUpper)
    const isTr = isTreasury || checkIsTreasury(tickerUpper)
    return {
      portfolio_id: portfolioId,
      ticker: tickerUpper,
      pricing_mode: pricingMode,
      is_b3_linked: pricingMode === 'market' ? isB3Linked : false,
      applied_amount:
        pricingMode === 'fixed_income' || pricingMode === 'manual_value' ? unitPrice * qty : null,
      contract_rate: isFixedOrTreasury && contractRate ? Number(contractRate) : null,
      indexer: isFixedOrTreasury ? indexer : 'none',
      indexer_percent: isFixedOrTreasury ? (Number(indexerPercent) || 100) : 100,
      maturity_date: isFixedOrTreasury ? (maturityDate || null) : null,
      application_date: date,
      manual_current_value:
        pricingMode === 'manual_value' && manualCurrentValue ? Number(manualCurrentValue) : null,
      manual_value_updated_at: manualCurrentValue ? new Date().toISOString() : null,
      tax_exempt: taxExempt,
      is_treasury: isTr,
      currency: currency,
      updated_at: new Date().toISOString(),
    }
  }

  const isAmountBased = pricingMode !== 'market'
  const isCorporateAction =
    operationType === 'split' || operationType === 'reverse_split'

  const quantityFieldLabel = useMemo(() => {
    if (operationType === 'split') return 'Cotas creditadas'
    if (operationType === 'reverse_split') return 'Cotas canceladas'
    if (pricingMode === 'market') return 'Quantidade'
    if (pricingMode === 'cash') return 'Valor (R$)'
    return 'Valor aplicado (R$)'
  }, [operationType, pricingMode])

  const purchaseAmount = useMemo(() => {
    const qty = isAmountBased ? 1 : parseFloat(quantity)
    const unitPrice = isAmountBased ? parseFloat(price || quantity) : parseFloat(price)
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty <= 0 || unitPrice <= 0) return 0
    return Math.round(qty * unitPrice * 100) / 100
  }, [isAmountBased, quantity, price])

  const transactionsForCashPreview = useMemo(() => {
    if (!editingTransaction) return portfolioTransactions
    return excludeCashOffsetSells(portfolioTransactions, editingTransaction.id)
  }, [portfolioTransactions, editingTransaction])

  const cashOffsetPreview = useMemo(() => {
    return computeCashOffsetPreview(
      purchaseAmount,
      operationType,
      pricingMode,
      transactionsForCashPreview,
      portfolioDefinitions
    )
  }, [
    purchaseAmount,
    operationType,
    pricingMode,
    transactionsForCashPreview,
    portfolioDefinitions,
  ])

  const totalAvailableCash = useMemo(() => {
    const isCashApply = (operationType === 'buy' || operationType === 'subscription') && pricingMode !== 'cash'
    if (!isCashApply) return 0
    return cashOffsetPreview.availableCash || 0
  }, [cashOffsetPreview.availableCash, operationType, pricingMode])

  const totalCashUsed = useMemo(() => {
    return Math.min(totalAvailableCash, purchaseAmount)
  }, [totalAvailableCash, purchaseAmount])

  const netContribution = useMemo(() => {
    return Math.max(0, purchaseAmount - totalCashUsed)
  }, [purchaseAmount, totalCashUsed])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) {
      toast.error('Carteira não disponível. Recarregue a página.')
      return
    }

    setSaving(true)
    try {
      const isAmountBased = pricingMode !== 'market'
      const qty = isAmountBased ? 1 : parseFloat(quantity)
      const unitPrice = isAmountBased ? parseFloat(price || quantity) : parseFloat(price)

      const tickerUpper = ticker.toUpperCase().trim()

      if (!tickerUpper) throw new Error('Insira o ticker')
      if (isNaN(qty) || qty <= 0) throw new Error('Quantidade inválida')
      const isCorporateAction = operationType === 'split' || operationType === 'reverse_split'
      if (!isCorporateAction && (isNaN(unitPrice) || unitPrice <= 0)) {
        throw new Error('Preço inválido')
      }
      if (isCorporateAction && isNaN(unitPrice)) {
        throw new Error('Preço inválido')
      }

      if (pricingMode === 'manual_value' && !manualCurrentValue) {
        throw new Error('Informe o valor atual para ativos manuais')
      }

      const payload = {
        ticker: tickerUpper,
        operation_type: operationType,
        quantity: qty,
        price: isCorporateAction ? 0 : unitPrice,
        date,
        contract_rate: pricingMode === 'fixed_income' && contractRate ? Number(contractRate) : null,
      }

      let buyTransactionId: string

      if (editingTransaction) {
        const { error } = await supabase
          .from('portfolio_transactions')
          .update(payload)
          .eq('id', editingTransaction.id)
          .eq('portfolio_id', portfolioId)

        if (error) throw error
        buyTransactionId = editingTransaction.id
      } else {
        const { data: inserted, error } = await supabase
          .from('portfolio_transactions')
          .insert({
            portfolio_id: portfolioId,
            ...payload,
          })
          .select('id')
          .single()

        if (error) throw error
        buyTransactionId = inserted.id
      }

      const { error: defError } = await supabase
        .from('portfolio_asset_definitions')
        .upsert(buildDefinitionPayload(tickerUpper, unitPrice, qty), {
          onConflict: 'portfolio_id,ticker',
        })

      if (defError) throw defError

      // Salvar a meta de alocação (target_allocations)
      const pct = parseFloat(targetPct)
      if (!isNaN(pct) && pct > 0) {
        const { error: targetError } = await supabase
          .from('target_allocations')
          .upsert({
            portfolio_id: portfolioId,
            ticker: tickerUpper,
            target_percentage: pct
          }, { onConflict: 'portfolio_id,ticker' })
        if (targetError) throw targetError
      } else {
        await supabase
          .from('target_allocations')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
      }

      const currentTxAmount = qty * unitPrice

      // Reconciliar os offsets de caixa vinculados no livro-razão de forma automática
      const context = await fetchPortfolioCashContext(portfolioId)
      const offset = await reconcileCashOffsetOnTransactionSave({
        portfolioId,
        transactionId: buyTransactionId,
        amount: currentTxAmount,
        date,
        assetPricingMode: pricingMode,
        operationType,
        transactions: context.transactions,
        definitions: context.definitions,
      })

      // Sincronizar portfolios.cash_balance com a soma do saldo em caixa do livro-razão
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)

      const { error: updatePortError } = await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      if (updatePortError) throw updatePortError

      dispatchPortfolioChanged()
      if (offset.cashUsed > 0) {
        toast.success(
          `${formatCurrency(offset.cashUsed)} do saldo em caixa aplicado. Aporte líquido: ${formatCurrency(offset.netContribution)}`
        )
      } else {
        toast.success(editingTransaction ? 'Transação atualizada!' : 'Transação registrada!')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar transação')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!editingTransaction) return
    setIsConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!editingTransaction) return
    setIsConfirmDeleteOpen(false)
    setSaving(true)
    try {
      // Excluir todas as transações de offset de caixa vinculadas no livro-razão
      await deleteCashOffsetTransactions(portfolioId, editingTransaction.id)

      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', editingTransaction.id)
        .eq('portfolio_id', portfolioId)

      if (error) throw error

      // Sincronizar portfolios.cash_balance com a soma do saldo em caixa do livro-razão
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)

      const { error: updatePortError } = await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      if (updatePortError) throw updatePortError

      await cleanupOrphanPortfolioTickers(portfolioId, [editingTransaction.ticker])

      window.dispatchEvent(
        new CustomEvent('local-data-changed', { detail: { entity: 'investments' } })
      )
      dispatchPortfolioChanged()
      toast.success('Transação excluída!')
      onSaved()
      onClose()
    } catch {
      toast.error('Erro ao excluir transação')
    } finally {
      setSaving(false)
    }
  }

  const modalTitle = editingTransaction ? 'Editar transação' : 'Lançar transação'

  return (
    <>
      <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      onSubmit={handleSubmit}
      size="lg"
      zIndexClass={zIndexClass}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={editingTransaction ? 'Salvar alterações' : 'Salvar'}
          submitDisabled={saving || !ticker.trim()}
          loading={saving}
          deleteLabel={editingTransaction ? 'Excluir transação' : undefined}
          onDelete={editingTransaction ? handleDelete : undefined}
        />
      )}
    >
        {/* Row 1: Ticker / Identificador */}
        <div className="relative">
          <Input
            label={pricingMode === 'cash' ? 'Identificador do Caixa' : 'Ticker / Código'}
            type="text"
            required
            placeholder={pricingMode === 'cash' ? 'Ex: CAIXA' : 'Ex: PETR4'}
            value={ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => ticker.length >= 2 && setShowSuggestions(true)}
            className="uppercase font-semibold tracking-wider text-base focus:ring-2 focus:ring-primary rounded-xl"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="modal-dropdown animate-page-enter">
              {suggestions.map((s) => (
                <button
                  key={s.ticker}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Impede o blur do input
                    setTicker(s.ticker)
                    setIsB3Linked(isB3VariableTicker(s.ticker))
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-balance/10 text-primary flex items-center justify-between transition-colors"
                >
                  <span className="font-bold text-sm text-primary tracking-wide">{s.ticker}</span>
                  <span className="text-[10px] text-secondary font-medium truncate max-w-[180px]">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Tipo de Ativo */}
        <div>
          <Select
            label="Tipo de ativo"
            value={pricingMode}
            onChange={(e) => handlePricingModeChange(e.target.value as PortfolioPricingMode)}
            options={PORTFOLIO_PRICING_MODE_OPTIONS}
            disabled={isPricingModeLocked}
            className="rounded-xl font-semibold disabled:opacity-60"
          />
        </div>

        {/* Badges de classificação inteligente em Lançamentos */}
        {isPricingModeLocked && (
          <div className="animate-page-enter">
            {isB3Var && (
              <div className="p-2.5 bg-balance/10 border border-balance/20 text-balance text-xs rounded-xl flex items-center justify-between font-medium">
                <span>📈 Ativo B3: Renda Variável (Precificação a Mercado)</span>
                <span className="text-[10px] bg-balance/20 px-2 py-0.5 rounded-full font-bold uppercase">B3</span>
              </div>
            )}
            {isFixedInc && (
              <div className="p-2.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-xl flex items-center justify-between font-medium">
                <span>💰 Renda Fixa: Taxa e Vencimento Contratados</span>
                <span className="text-[10px] bg-warning/20 px-2 py-0.5 rounded-full font-bold uppercase">{tUpper.includes('TESOURO') ? 'Tesouro Direto' : 'Renda Fixa'}</span>
              </div>
            )}
            {isCash && (
              <div className="p-2.5 bg-income/10 border border-income/20 text-income text-xs rounded-xl flex items-center justify-between font-medium">
                <span>🏦 Caixa: Saldo e Transações de Aporte/Retirada</span>
                <span className="text-[10px] bg-income/20 px-2 py-0.5 rounded-full font-bold uppercase">Caixa</span>
              </div>
            )}
          </div>
        )}

        {pricingMode === 'cash' && (
          <p className="text-xs text-secondary bg-balance/5 border border-balance/10 rounded-2xl p-3.5 font-sans leading-relaxed font-medium">
            Saldo em caixa não gera rentabilidade — o valor permanece idêntico aos montantes de depósitos/retiradas registradas.
          </p>
        )}

        {/* Row 3: Operação e Data */}
        <ModalFieldRow>
          <Select
            label="Operação"
            value={operationType}
            onChange={(e) => setOperationType(e.target.value as PortfolioOperationType)}
            options={OPERATION_OPTIONS}
            className="font-semibold"
          />
          <Input
            label="Data da Operação"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="font-semibold rounded-xl"
          />
        </ModalFieldRow>

        {/* Row 4: Cotação atual (Rich Data Card) */}
        {loadingRichData && (
          <p className="text-[10px] text-secondary animate-pulse font-semibold">Buscando cotação em tempo real...</p>
        )}

        {richData && pricingMode === 'market' && (
          <div className="modal-panel-glass p-3.5 text-xs space-y-2 text-secondary relative overflow-hidden animate-fade-in text-left">
            <div className="flex justify-between items-center">
              <div className="overflow-hidden pr-2">
                <strong className="text-primary font-bold text-sm block truncate max-w-[240px]">{richData.name}</strong>
                <span className="text-[10px] text-secondary tracking-wide uppercase font-semibold">Yahoo Finance B3</span>
              </div>
              <div className="text-right">
                <span className="text-income font-mono font-black text-base block">{formatCurrency(richData.price)}</span>
                <span className="text-[9px] uppercase font-extrabold text-income tracking-wider">Cotação Atual</span>
              </div>
            </div>
            {richData.dividendYield !== undefined && (
              <div className="flex justify-between items-center text-[10px] opacity-80 pt-2 border-t border-glass font-mono">
                <span>Dividend Yield Anual (DY):</span>
                <span className="text-balance font-bold text-xs">{formatNumberBR(richData.dividendYield, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
              </div>
            )}
          </div>
        )}

        {/* Row 5: Configurações específicas de precificação */}
        {pricingMode === 'market' && (
          <ModalInfoPanel>
            <Checkbox
              label="Vinculado à B3"
              description="Sincroniza a cotação do ativo automaticamente a mercado"
              checked={isB3Linked}
              onChange={(e) => setIsB3Linked(e.target.checked)}
            />
          </ModalInfoPanel>
        )}

        {pricingMode === 'fixed_income' && (
          <ModalInfoPanel className="space-y-4">
            <Input
              label="Taxa contratada (% a.a.) — pré-fixado"
              type="number"
              step="0.01"
              value={contractRate}
              onChange={(e) => setContractRate(e.target.value)}
              className="rounded-xl font-semibold"
            />
            <Select
              label="Indexador (pós-fixado)"
              value={indexer}
              onChange={(e) => setIndexer(e.target.value as typeof indexer)}
              options={[
                { value: 'none', label: 'Nenhum (pré-fixado)' },
                { value: 'cdi', label: 'CDI' },
                { value: 'selic', label: 'SELIC' },
                { value: 'ipca', label: 'IPCA' },
              ]}
              className="rounded-xl font-semibold"
            />
            <Checkbox
              label="Isento de IR (LCI/LCA)"
              description="Não aplica tabela regressiva de imposto de renda sobre os ganhos"
              checked={taxExempt}
              onChange={(e) => setTaxExempt(e.target.checked)}
            />
          </ModalInfoPanel>
        )}

        {pricingMode === 'manual_value' && (
          <ModalInfoPanel>
            <Input
              label="Valor atual estimado / Saldo atual (R$)"
              type="number"
              step="0.01"
              value={manualCurrentValue}
              onChange={(e) => setManualCurrentValue(e.target.value)}
              className="rounded-xl font-semibold"
            />
          </ModalInfoPanel>
        )}

        {/* Row 6: Quantidade e Preço de Execução */}
        <ModalFieldRow>
          <Input
            label={quantityFieldLabel}
            type="number"
            required
            step="any"
            placeholder={
              isCorporateAction
                ? 'Ex: 12'
                : pricingMode === 'market'
                  ? 'Ex: 10'
                  : 'Ex: 10000'
            }
            value={isAmountBased ? price || quantity : quantity}
            onChange={(e) => {
              if (isAmountBased) {
                setPrice(e.target.value)
                setQuantity('1')
              } else {
                setQuantity(e.target.value)
              }
            }}
            className="font-semibold rounded-xl text-sm"
          />

          {pricingMode === 'market' && !isCorporateAction && (
            <Input
              label="Preço de execução unitário"
              type="number"
              required
              step="any"
              placeholder="Ex: 35.50"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="font-semibold rounded-xl text-sm"
            />
          )}
        </ModalFieldRow>

        {/* Row 7: Valor do Caixa (edição) ou Cálculo de Aporte (novo lançamento) */}
        {pricingMode !== 'cash' && (operationType === 'buy' || operationType === 'subscription') && (
          editingTransaction ? (
            <ModalSummaryPanel
              title="Valor do Caixa — Lançamento Cadastrado"
              intent="neutral"
              rows={[
                {
                  label: 'Quantidade:',
                  value: isAmountBased ? '—' : formatQuantityBR(parseFloat(quantity || '0')),
                },
                {
                  label: 'Preço unitário:',
                  value: formatCurrency(parseFloat(price || '0')),
                },
              ]}
              total={{ label: 'Total gasto do caixa:', value: formatCurrency(purchaseAmount), valueClassName: 'text-balance' }}
              note="Valor registrado no lançamento original. Altere quantidade ou preço acima para recalcular."
            />
          ) : (
            <ModalSummaryPanel
              title="Cálculo de Aporte com Caixa"
              intent="balance"
              rows={[
                { label: 'Valor do Aporte:', value: formatCurrency(purchaseAmount) },
                {
                  label: '(-) Saldo em Caixa:',
                  value: formatCurrency(totalAvailableCash),
                  valueClassName: 'text-balance',
                },
              ]}
              total={{ label: 'Aporte Líquido:', value: formatCurrency(netContribution) }}
              note={
                totalAvailableCash > 0
                  ? netContribution === 0
                    ? 'O saldo em caixa cobre integralmente este aporte.'
                    : `Serão utilizados ${formatCurrency(totalCashUsed)} do caixa. Os ${formatCurrency(netContribution)} restantes devem ser aportados de fora.`
                  : undefined
              }
            />
          )
        )}{/* Aviso de saldo em caixa insuficiente para compras */}
        {pricingMode !== 'cash' &&
          (operationType === 'buy' || operationType === 'subscription') &&
          !editingTransaction &&
          purchaseAmount > 0 &&
          totalAvailableCash < purchaseAmount && (
            <div className="flex items-start gap-3 p-3.5 bg-expense/10 border border-expense/30 rounded-xl animate-fade-in">
              <span className="text-expense text-lg leading-none mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-expense font-bold text-xs leading-snug">
                  Saldo em caixa insuficiente para este aporte
                </p>
                <p className="text-expense/80 text-[11px] font-medium mt-0.5 leading-snug">
                  Caixa disponível:{' '}
                  <span className="font-mono font-bold">{formatCurrency(totalAvailableCash)}</span>
                  {' · '}
                  Necessário:{' '}
                  <span className="font-mono font-bold">{formatCurrency(purchaseAmount)}</span>
                  {' · '}
                  Falta:{' '}
                  <span className="font-mono font-bold">{formatCurrency(purchaseAmount - totalAvailableCash)}</span>
                </p>
              </div>
            </div>
          )}

        {/* Accordion de Configurações Avançadas */}
        {pricingMode !== 'cash' && (
          <div className="border border-glass rounded-xl overflow-hidden mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 bg-glass hover:bg-glass-strong transition-all text-xs font-semibold text-primary"
            >
              <div className="flex items-center gap-2">
                <span>⚙️</span>
                <span>Configurações Avançadas do Ativo ({ticker || 'Novo'})</span>
              </div>
              <span className={`transform transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {showAdvanced && (
              <div className="p-4 space-y-4 bg-glass-clear border-t border-glass animate-page-enter">
                <Select
                  label="Moeda de Precificação"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'BRL' | 'USD')}
                  options={[
                    { value: 'BRL', label: 'BRL - Real Brasileiro (R$)' },
                    { value: 'USD', label: 'USD - Dólar Americano ($)' },
                  ]}
                  className="rounded-xl font-semibold text-sm"
                />

                <Input
                  label="Meta de Alocação Ideal no Portfólio (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="Ex: 15"
                  value={targetPct}
                  onChange={(e) => setTargetPct(e.target.value)}
                  className="text-sm font-semibold font-mono rounded-xl text-sm"
                />

                {pricingMode === 'fixed_income' && (
                  <>
                    <Input
                      label="% do indexador (ex: 100% CDI)"
                      type="number"
                      step="0.01"
                      value={indexerPercent}
                      onChange={(e) => setIndexerPercent(e.target.value)}
                      className="font-semibold rounded-xl text-sm"
                    />
                    <Input
                      label="Data de Vencimento"
                      type="date"
                      value={maturityDate}
                      onChange={(e) => setMaturityDate(e.target.value)}
                      className="font-semibold rounded-xl text-sm"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}

    </ModalForm>

      {editingTransaction && (
        <ConfirmModal
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="Excluir Transação"
          confirmLabel="Sim, excluir"
          confirmVariant="danger"
          loading={saving}
          onConfirm={confirmDelete}
        >
          <div className="space-y-2">
            <p className="text-sm text-secondary font-medium">
              Tem certeza de que deseja excluir permanentemente esta transação de{' '}
              <strong className="text-primary font-bold">{editingTransaction.ticker}</strong>?
            </p>
            <p className="text-xs text-secondary/80">
              Esta ação removerá a transação da carteira e atualizará os saldos em caixa vinculados de forma automática.
            </p>
          </div>
        </ConfirmModal>
      )}
    </>
  )
}
