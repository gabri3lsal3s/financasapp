import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import Checkbox from '@/components/Checkbox'
import { supabase } from '@/lib/supabase'
import Select from '@/components/Select'
import { searchB3Assets, getAssetRichData, isB3TickerPattern } from '@/services/priceService'
import type {
  PortfolioOperationType,
  PortfolioTransaction,
  PortfolioPricingMode,
  PortfolioAssetDefinition,
} from '@/types'
import { deleteLegacyInvestmentsForTransaction } from '@/utils/legacyInvestmentMigration'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { ASSET_DEFINITION_SELECT, PORTFOLIO_PRICING_MODE_OPTIONS } from '@/constants/portfolioPricingMode'
import { computeCashOffsetPreview, excludeCashOffsetSells, calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import {
  fetchPortfolioCashContext,
  reconcileCashOffsetOnTransactionSave,
  deleteCashOffsetTransactions,
} from '@/services/cashOffsetService'
import toast from 'react-hot-toast'

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
}

const OPERATION_OPTIONS: { value: PortfolioOperationType; label: string }[] = [
  { value: 'buy', label: 'Compra' },
  { value: 'sell', label: 'Venda' },
  { value: 'dividend', label: 'Provento/Div' },
  { value: 'split', label: 'Desdobrar' },
  { value: 'subscription', label: 'Subscrição' },
]

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
}: PortfolioTransactionFormModalProps) {
  const [ticker, setTicker] = useState('')
  const [operationType, setOperationType] = useState<PortfolioOperationType>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [loadingDefinition, setLoadingDefinition] = useState(false)
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

  const pricingSetters = {
    setPricingMode,
    setIsB3Linked,
    setContractRate,
    setIndexer,
    setManualCurrentValue,
    setTaxExempt,
    setIsTreasury,
  }

  useEffect(() => {
    if (!isOpen) return

    if (editingTransaction) {
      setTicker(editingTransaction.ticker)
      setOperationType(editingTransaction.operation_type)
      setQuantity(String(editingTransaction.quantity))
      setPrice(String(editingTransaction.price))
      setDate(editingTransaction.date)
    } else {
      setTicker('')
      setOperationType('buy')
      setQuantity('')
      setPrice('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      resetPricingFields(pricingSetters)
    }
    setSuggestions([])
    setShowSuggestions(false)
    setRichData(null)
  }, [isOpen, editingTransaction])

  useEffect(() => {
    if (!isOpen || !portfolioId) return

    const loadCashContext = async () => {
      const { transactions, definitions } = await fetchPortfolioCashContext(portfolioId)
      setPortfolioTransactions(transactions)
      setPortfolioDefinitions(definitions)
    }

    void loadCashContext()
  }, [isOpen, portfolioId])

  useEffect(() => {
    if (!isOpen || !portfolioId || !editingTransaction) return

    const loadDefinition = async () => {
      setLoadingDefinition(true)
      try {
        const tickerUpper = editingTransaction.ticker.toUpperCase()
        const { data } = await supabase
          .from('portfolio_asset_definitions')
          .select(ASSET_DEFINITION_SELECT)
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
          .maybeSingle()

        if (tickerUpper === 'SALDO_INV' || tickerUpper === 'CAIXA' || tickerUpper === 'SALDO EM CAIXA' || tickerUpper === 'SALDO_EM_CAIXA') {
          setPricingMode('cash')
        } else if (data) {
          applyDefinitionToForm(data as PortfolioAssetDefinition, pricingSetters)
        } else {
          resetPricingFields(pricingSetters)
          setIsB3Linked(isB3TickerPattern(tickerUpper))
        }
      } finally {
        setLoadingDefinition(false)
      }
    }

    void loadDefinition()
  }, [isOpen, portfolioId, editingTransaction?.id, editingTransaction?.ticker])

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
            setPrice(data.price.toFixed(2))
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
    setTicker(val)
    if (pricingMode === 'market' && val.length >= 2) {
      const results = await searchB3Assets(val)
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
  ) => ({
    portfolio_id: portfolioId,
    ticker: tickerUpper,
    pricing_mode: pricingMode,
    is_b3_linked: pricingMode === 'market' ? isB3Linked : false,
    applied_amount:
      pricingMode === 'fixed_income' || pricingMode === 'manual_value' ? unitPrice * qty : null,
    contract_rate: pricingMode === 'fixed_income' && contractRate ? Number(contractRate) : null,
    indexer: pricingMode === 'fixed_income' || isTreasury ? indexer : 'none',
    indexer_percent: 100,
    application_date: date,
    manual_current_value:
      pricingMode === 'manual_value' && manualCurrentValue ? Number(manualCurrentValue) : null,
    manual_value_updated_at: manualCurrentValue ? new Date().toISOString() : null,
    tax_exempt: taxExempt,
    is_treasury: pricingMode === 'market' ? isTreasury || tickerUpper.includes('TESOURO') : false,
    updated_at: new Date().toISOString(),
  })

  const isAmountBased = pricingMode !== 'market'

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
      if (isNaN(unitPrice) || unitPrice <= 0) throw new Error('Preço inválido')

      if (pricingMode === 'manual_value' && !manualCurrentValue) {
        throw new Error('Informe o valor atual para ativos manuais')
      }

      const payload = {
        ticker: tickerUpper,
        operation_type: operationType,
        quantity: qty,
        price: unitPrice,
        date,
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

  const handleDelete = async () => {
    if (!editingTransaction) return
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      await deleteLegacyInvestmentsForTransaction(supabase, user.id, editingTransaction)

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

      // Limpeza de definições e metas órfãs
      const tickerUpper = editingTransaction.ticker.toUpperCase()
      const { data: remaining } = await supabase
        .from('portfolio_transactions')
        .select('id')
        .eq('portfolio_id', portfolioId)
        .eq('ticker', tickerUpper)

      if (!remaining || remaining.length === 0) {
        await supabase
          .from('portfolio_asset_definitions')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)

        await supabase
          .from('target_allocations')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
      }

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
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <Select
          label="Tipo de ativo"
          value={pricingMode}
          onChange={(e) => handlePricingModeChange(e.target.value as PortfolioPricingMode)}
          options={PORTFOLIO_PRICING_MODE_OPTIONS}
          disabled={loadingDefinition}
        />

        {loadingDefinition && (
          <p className="text-[10px] text-secondary animate-pulse">Carregando configuração do ativo...</p>
        )}

        {pricingMode === 'cash' && (
          <p className="text-xs text-secondary bg-secondary border border-primary rounded-xl p-3">
            Saldo em caixa não gera rentabilidade. O valor permanece igual ao montante registrado nos lançamentos.
          </p>
        )}

        <div className="relative">
          <Input
            label={pricingMode === 'cash' ? 'Identificador' : 'Ticker'}
            type="text"
            required
            placeholder={pricingMode === 'cash' ? 'Ex: CAIXA' : 'Ex: PETR4'}
            value={ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => ticker.length >= 2 && setShowSuggestions(true)}
            className="uppercase font-semibold"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-[1001] w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.ticker}
                  type="button"
                  onClick={() => {
                    setTicker(s.ticker)
                    setIsB3Linked(isB3TickerPattern(s.ticker))
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-tertiary text-primary flex items-center justify-between border-b border-primary/10 last:border-0"
                >
                  <span className="font-bold">{s.ticker}</span>
                  <span className="text-[10px] text-secondary truncate max-w-[150px]">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">
            Operação
          </label>
          <select
            value={operationType}
            onChange={(e) => setOperationType(e.target.value as PortfolioOperationType)}
            className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
          >
            {OPERATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Data"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="font-semibold"
        />

        {loadingRichData && (
          <p className="text-[10px] text-secondary animate-pulse">Carregando cotação...</p>
        )}

        {richData && pricingMode === 'market' && (
          <div className="p-3 bg-secondary border border-primary rounded-xl text-xs space-y-1 text-secondary">
            <div className="flex justify-between items-center">
              <strong className="text-primary font-bold">{richData.name}</strong>
              <span className="text-income font-extrabold">{formatCurrency(richData.price)}</span>
            </div>
            {richData.dividendYield !== undefined && (
              <div className="flex justify-between items-center text-[10px] opacity-80 pt-0.5 border-t border-primary/10">
                <span>Dividend Yield Anual (DY):</span>
                <span className="text-indigo-500 font-bold">{formatNumberBR(richData.dividendYield, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
              </div>
            )}
          </div>
        )}

        {pricingMode === 'market' && (
          <div className="flex flex-col gap-2.5 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl">
            <Checkbox
              label="Vinculado à B3"
              description="Cotação atualizada automaticamente pelo mercado"
              checked={isB3Linked}
              onChange={(e) => setIsB3Linked(e.target.checked)}
            />
            <Checkbox
              label="Tesouro Direto (híbrido)"
              description="Aplica indexador ao preço de mercado do Tesouro"
              checked={isTreasury}
              onChange={(e) => setIsTreasury(e.target.checked)}
            />
          </div>
        )}

        {pricingMode === 'fixed_income' && (
          <>
            <Input
              label="Taxa contratada (% a.a.) — pré-fixado"
              type="number"
              step="0.01"
              value={contractRate}
              onChange={(e) => setContractRate(e.target.value)}
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
            />
            <Checkbox
              label="Isento de IR (LCI/LCA)"
              description="Não aplica tabela regressiva de imposto de renda"
              checked={taxExempt}
              onChange={(e) => setTaxExempt(e.target.checked)}
            />
          </>
        )}

        {pricingMode === 'manual_value' && (
          <Input
            label="Valor atual (R$)"
            type="number"
            step="0.01"
            value={manualCurrentValue}
            onChange={(e) => setManualCurrentValue(e.target.value)}
          />
        )}

        <Input
          label={
            pricingMode === 'market'
              ? 'Quantidade'
              : pricingMode === 'cash'
                ? 'Valor (R$)'
                : 'Valor aplicado (R$)'
          }
          type="number"
          required
          step="any"
          placeholder={pricingMode === 'market' ? 'Ex: 10' : 'Ex: 10000'}
          value={isAmountBased ? price || quantity : quantity}
          onChange={(e) => {
            if (isAmountBased) {
              setPrice(e.target.value)
              setQuantity('1')
            } else {
              setQuantity(e.target.value)
            }
          }}
          className="font-semibold"
        />

        {pricingMode === 'market' && (
          <Input
            label="Preço de execução"
            type="number"
            required
            step="any"
            placeholder="Ex: 35.50"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="font-semibold"
          />
        )}

        {pricingMode !== 'cash' && (operationType === 'buy' || operationType === 'subscription') && (
          <div className="p-3.5 bg-secondary border border-primary rounded-2xl text-xs space-y-2 text-secondary text-left animate-page-enter">
            <h5 className="font-black text-primary text-[10px] uppercase tracking-wider mb-1">Cálculo de Aporte com Caixa</h5>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span>Valor do Aporte:</span>
                <span className="font-bold text-primary">{formatCurrency(purchaseAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>(-) Saldo em Caixa:</span>
                <span className="font-bold text-indigo-500">{formatCurrency(totalAvailableCash)}</span>
              </div>
              <div className="h-[1px] bg-primary/10 my-1" />
              <div className="flex justify-between text-sm font-black">
                <span>Aporte Líquido:</span>
                <span className={netContribution > 0 ? 'text-income' : 'text-emerald-500'}>
                  {formatCurrency(netContribution)}
                </span>
              </div>
            </div>
            {totalAvailableCash > 0 && (
              <p className="text-[10px] text-secondary italic opacity-85 leading-normal mt-2 border-t border-primary/5 pt-1.5 font-sans">
                {netContribution === 0 
                  ? 'O saldo em caixa cobre integralmente este aporte.' 
                  : `Serão utilizados ${formatCurrency(totalCashUsed)} do caixa. Os ${formatCurrency(netContribution)} restantes devem ser aportados de fora.`}
              </p>
            )}
          </div>
        )}

        <ModalActionFooter
          onCancel={onClose}
          submitLabel={editingTransaction ? 'Salvar alterações' : 'Salvar'}
          submitDisabled={saving || !ticker.trim() || loadingDefinition}
          deleteLabel={editingTransaction ? 'Excluir transação' : undefined}
          onDelete={editingTransaction ? handleDelete : undefined}
        />
      </form>
    </Modal>
  )
}
