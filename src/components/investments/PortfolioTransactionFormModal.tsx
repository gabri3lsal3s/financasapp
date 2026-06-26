import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ModalFieldRow from '@/components/ModalFieldRow'
import NumberInput from '@/components/NumberInput'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction, PortfolioOperationType, PortfolioPricingMode, PortfolioAssetIndexer, PortfolioAssetDefinition } from '@/types'
import { detectDefaultCurrency, isCashTicker } from '@/utils/assetClassifier'
import { formatCurrencyByCode } from '@/utils/format'
import { fetchPortfolioCashContext, reconcileCashOffsetOnTransactionSave, deleteCashOffsetTransactions } from '@/services/cashOffsetService'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'
import ConfirmModal from '@/components/ConfirmModal'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

interface PortfolioTransactionFormModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  editingTransaction: PortfolioTransaction | null
  onSaved: () => void
  zIndexClass?: string
}

export default function PortfolioTransactionFormModal({
  isOpen,
  onClose,
  portfolioId,
  editingTransaction,
  onSaved,
  zIndexClass,
}: PortfolioTransactionFormModalProps) {
  const [ticker, setTicker] = useState('CAIXA')
  const [operationType, setOperationType] = useState<PortfolioOperationType>('buy')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  const [saving, setSaving] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  // Estados de definição/parametrização do ativo
  const [pricingMode, setPricingMode] = useState<PortfolioPricingMode>('market')
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [targetPercentage, setTargetPercentage] = useState('0')
  const [indexer, setIndexer] = useState<PortfolioAssetIndexer>('none')
  const [indexerPercent, setIndexerPercent] = useState('100')
  const [contractRate, setContractRate] = useState('0')
  const [maturityDate, setMaturityDate] = useState('')
  const [applicationDate, setApplicationDate] = useState('')
  const [manualCurrentValue, setManualCurrentValue] = useState('0')

  const [showAssetConfig, setShowAssetConfig] = useState(false)
  const [isNewAsset, setIsNewAsset] = useState(false)
  const [cashBalance, setCashBalance] = useState<number>(0)

  const isEditing = !!editingTransaction
  const isCashType = isCashTicker(ticker)
  const isIncomeType = ['dividend', 'jcp', 'fii_yield'].includes(operationType)

  // Type-safe handlers para Selects de tipo literal
  const PRICING_MODES: PortfolioPricingMode[] = ['market', 'fixed_income', 'manual_value', 'cash']
  const CURRENCIES = ['BRL', 'USD'] as const
  const INDEXERS: PortfolioAssetIndexer[] = ['none', 'cdi', 'selic', 'ipca']

  const handlePricingModeChange = (e: { target: { value: string } }) => {
    const val = e.target.value
    if ((PRICING_MODES as string[]).includes(val)) {
      setPricingMode(val as PortfolioPricingMode)
    }
  }

  const handleCurrencyChange = (e: { target: { value: string } }) => {
    const val = e.target.value
    if ((CURRENCIES as readonly string[]).includes(val)) {
      setCurrency(val as 'BRL' | 'USD')
    }
  }

  const handleIndexerChange = (e: { target: { value: string } }) => {
    const val = e.target.value
    if ((INDEXERS as string[]).includes(val)) {
      setIndexer(val as PortfolioAssetIndexer)
    }
  }

  // Carregar dados da transação ao abrir
  useEffect(() => {
    if (!isOpen) return

    if (editingTransaction) {
      setTicker(editingTransaction.ticker.toUpperCase().trim())
      setOperationType(editingTransaction.operation_type)
      setDate(editingTransaction.date)
      
      const isCash = isCashTicker(editingTransaction.ticker)
      const isIncome = ['dividend', 'jcp', 'fii_yield'].includes(editingTransaction.operation_type)
      
      if (isCash) {
        setAmount(String(editingTransaction.price))
        setQuantity('1')
        setPrice(String(editingTransaction.price))
      } else if (isIncome) {
        const totalVal = Number(editingTransaction.quantity) * Number(editingTransaction.price)
        setAmount(String(totalVal))
        setQuantity('1')
        setPrice(String(totalVal))
      } else {
        setAmount('')
        setQuantity(String(editingTransaction.quantity))
        setPrice(String(editingTransaction.price))
      }
    } else {
      setTicker('CAIXA')
      setOperationType('buy')
      setAmount('')
      setQuantity('1')
      setPrice('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
    }
  }, [isOpen, editingTransaction])

  // Carregar saldo em caixa do portfólio para simulação
  useEffect(() => {
    if (!isOpen || !portfolioId) return

    const fetchCash = async () => {
      try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('cash_balance')
          .eq('id', portfolioId)
          .maybeSingle()

        if (!error && data) {
          setCashBalance(Number(data.cash_balance) || 0)
        }
      } catch (err) {
        logger.warn('Erro ao buscar saldo em caixa no modal:', err)
      }
    }

    fetchCash()
  }, [isOpen, portfolioId])

  // Ajustar tipo de operação adequado se o ticker mudar para CAIXA
  useEffect(() => {
    if (isCashType && !['buy', 'sell'].includes(operationType)) {
      setOperationType('buy')
    }
  }, [ticker])

  // Buscar definições do ativo ao mudar o ticker (para ativos que não são CAIXA)
  useEffect(() => {
    if (!isOpen || !portfolioId) return
    const tickerUpper = ticker.toUpperCase().trim()
    if (!tickerUpper || isCashType) {
      setIsNewAsset(false)
      setShowAssetConfig(false)
      return
    }

    let isSubscribed = true

    const fetchDef = async () => {
      try {
        const [defRes, targetRes] = await Promise.all([
          supabase
            .from('portfolio_asset_definitions')
            .select('*')
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)
            .maybeSingle(),
          supabase
            .from('target_allocations')
            .select('target_percentage')
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)
            .maybeSingle()
        ])

        if (!isSubscribed) return

        if (defRes.data) {
          const def = defRes.data as PortfolioAssetDefinition
          setPricingMode(def.pricing_mode)
          setCurrency(def.currency || 'BRL')
          setIndexer(def.indexer || 'none')
          setIndexerPercent(String(def.indexer_percent ?? 100))
          setContractRate(String(def.contract_rate ?? 0))
          setMaturityDate(def.maturity_date ?? '')
          setApplicationDate(def.application_date ?? '')
          setManualCurrentValue(String(def.manual_current_value ?? 0))
          setIsNewAsset(false)
        } else {
          // Ativo novo: Sugerir parâmetros padrão
          const isFixed = ['CDI', 'SELIC', 'IPCA', 'TESOURO', 'CDB', 'LCI', 'LCA', 'DEBENTURE'].some(rf => tickerUpper.includes(rf))
          const suggestedPricingMode = isFixed ? 'fixed_income' : 'market'
          const suggestedCurrency = detectDefaultCurrency(tickerUpper)
          const suggestedIndexer = tickerUpper.includes('CDI') ? 'cdi' : (tickerUpper.includes('SELIC') ? 'selic' : (tickerUpper.includes('IPCA') ? 'ipca' : 'none'))

          setPricingMode(suggestedPricingMode)
          setCurrency(suggestedCurrency)
          setIndexer(suggestedIndexer)
          setIndexerPercent('100')
          setContractRate('0')
          setMaturityDate('')
          setApplicationDate(date) // pré-definir com a data do lançamento atual (mas permitindo edição)
          setManualCurrentValue('0')
          setIsNewAsset(true)
          
          // Expandir painel de parâmetros automaticamente para novos ativos
          setShowAssetConfig(true)
        }

        if (targetRes.data) {
          setTargetPercentage(String(targetRes.data.target_percentage))
        } else {
          setTargetPercentage('0')
        }
      } catch (err) {
        logger.error('Erro ao carregar definições do ativo no modal:', err)
      }
    }

    const timer = setTimeout(fetchDef, 300)
    return () => {
      isSubscribed = false
      clearTimeout(timer)
    }
  }, [ticker, isOpen, portfolioId, date])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) {
      toast.error('Carteira não disponível.')
      return
    }

    setSaving(true)
    try {
      const tickerUpper = ticker.toUpperCase().trim()
      if (!tickerUpper) throw new Error('O ticker é obrigatório.')

      const oldTicker = editingTransaction?.ticker.toUpperCase().trim()

      let qty = 1
      let unitPrice = 0

      if (isCashType || isIncomeType) {
        unitPrice = parseFloat(amount)
        qty = 1
        if (isNaN(unitPrice) || unitPrice <= 0) {
          throw new Error(isCashType ? 'Insira um valor de caixa válido maior que zero.' : 'Insira um valor de provento válido maior que zero.')
        }
      } else {
        qty = parseFloat(quantity)
        unitPrice = parseFloat(price)
        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantidade inválida.')
        }
        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error('Preço unitário inválido.')
        }
      }

      const payload = {
        ticker: tickerUpper,
        operation_type: operationType,
        quantity: qty,
        price: unitPrice,
        date,
      }

      let txId: string

      if (isEditing) {
        const { error } = await supabase
          .from('portfolio_transactions')
          .update(payload)
          .eq('id', editingTransaction.id)
          .eq('portfolio_id', portfolioId)

        if (error) throw error
        txId = editingTransaction.id

        if (oldTicker && oldTicker !== tickerUpper) {
          await cleanupOrphanPortfolioTickers(portfolioId, [oldTicker])
        }
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
        txId = inserted.id
      }

      // 2. Salvar/Atualizar a definição do ativo (se não for caixa)
      const finalPricingMode = isCashType ? 'cash' : pricingMode
      const finalCurrency = isCashType ? 'BRL' : currency

      if (!isCashType) {
        const defPayload = {
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: finalPricingMode,
          is_b3_linked: finalPricingMode === 'market',
          applied_amount: finalPricingMode === 'fixed_income' ? qty * unitPrice : null,
          contract_rate: finalPricingMode === 'fixed_income' ? parseFloat(contractRate) : 0,
          indexer: finalPricingMode === 'fixed_income' ? indexer : 'none',
          indexer_percent: finalPricingMode === 'fixed_income' ? parseFloat(indexerPercent) : 100,
          maturity_date: finalPricingMode === 'fixed_income' && maturityDate ? maturityDate : null,
          application_date: finalPricingMode === 'fixed_income' ? (applicationDate || date) : null,
          manual_current_value: finalPricingMode === 'manual_value' ? parseFloat(manualCurrentValue) : null,
          manual_value_updated_at: finalPricingMode === 'manual_value' ? new Date().toISOString() : null,
          tax_exempt: false,
          is_treasury: tickerUpper.includes('TESOURO'),
          currency: finalCurrency,
          updated_at: new Date().toISOString(),
        }

        const { data: existingDef } = await supabase
          .from('portfolio_asset_definitions')
          .select('id')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
          .maybeSingle()

        if (existingDef) {
          const { error: defErr } = await supabase
            .from('portfolio_asset_definitions')
            .update(defPayload)
            .eq('id', existingDef.id)
          if (defErr) throw defErr
        } else {
          const { error: defErr } = await supabase
            .from('portfolio_asset_definitions')
            .insert(defPayload)
          if (defErr) throw defErr
        }

        // Salvar/Atualizar a alocação alvo
        const targetPct = parseFloat(targetPercentage)
        if (targetPct > 0) {
          const { data: existingTarget } = await supabase
            .from('target_allocations')
            .select('id')
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)
            .maybeSingle()

          if (existingTarget) {
            const { error: targetErr } = await supabase
              .from('target_allocations')
              .update({ target_percentage: targetPct })
              .eq('id', existingTarget.id)
            if (targetErr) throw targetErr
          } else {
            const { error: targetErr } = await supabase
              .from('target_allocations')
              .insert({
                portfolio_id: portfolioId,
                ticker: tickerUpper,
                target_percentage: targetPct
              })
            if (targetErr) throw targetErr
          }
        } else {
          await supabase
            .from('target_allocations')
            .delete()
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)
        }
      }

      // 3. Reconciliar caixa automaticamente
      const context = await fetchPortfolioCashContext(portfolioId)
      await reconcileCashOffsetOnTransactionSave({
        portfolioId,
        transactionId: txId,
        amount: qty * unitPrice,
        date,
        assetPricingMode: finalPricingMode,
        operationType,
        transactions: context.transactions,
        definitions: context.definitions,
      })

      toast.success(isEditing ? 'Lançamento atualizado!' : 'Transação registrada com sucesso!')
      
      // Disparar eventos locais para atualizar views e caches
      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_transactions' }
      }))
      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_asset_definitions' }
      }))

      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar transação.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!editingTransaction) return
    setIsConfirmDeleteOpen(false)
    setSaving(true)
    try {
      await deleteCashOffsetTransactions(portfolioId, editingTransaction.id)

      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', editingTransaction.id)
        .eq('portfolio_id', portfolioId)

      if (error) throw error

      await cleanupOrphanPortfolioTickers(portfolioId, [editingTransaction.ticker])

      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_transactions' }
      }))

      toast.success('Lançamento excluído!')
      onSaved()
      onClose()
    } catch {
      toast.error('Erro ao excluir lançamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ModalForm
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? 'Editar Lançamento' : 'Lançar Transação'}
        onSubmit={handleSubmit}
        size="md"
        zIndexClass={zIndexClass}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={onClose}
            submitLabel={isEditing ? 'Salvar alterações' : 'Salvar Transação'}
            submitDisabled={saving || ((isCashType || isIncomeType) && !amount.trim()) || (!(isCashType || isIncomeType) && (!ticker.trim() || !price.trim()))}
            loading={saving}
            deleteLabel={isEditing ? 'Excluir lançamento' : undefined}
            onDelete={isEditing ? () => setIsConfirmDeleteOpen(true) : undefined}
          />
        )}
      >
        <div className="space-y-4 text-left">
          {/* Seletor de Ticker e Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ativo (Ticker)"
              type="text"
              required
              placeholder="Ex: WEGE3, CAIXA, VOO"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="h-10 w-full uppercase font-mono"
            />
            <Select
              label="Tipo de Operação"
              value={operationType}
              onChange={(e) => {
                const newOp = e.target.value as PortfolioOperationType
                const wasIncome = ['dividend', 'jcp', 'fii_yield'].includes(operationType)
                const isIncome = ['dividend', 'jcp', 'fii_yield'].includes(newOp)

                if (isIncome && !wasIncome) {
                  const qtyVal = parseFloat(quantity)
                  const priceVal = parseFloat(price)
                  if (!isNaN(qtyVal) && !isNaN(priceVal)) {
                    setAmount(String(qtyVal * priceVal))
                  }
                } else if (!isIncome && wasIncome) {
                  const amountVal = parseFloat(amount)
                  if (!isNaN(amountVal)) {
                    setPrice(String(amountVal))
                    setQuantity('1')
                  }
                }

                setOperationType(newOp)
              }}
              options={isCashType ? [
                { value: 'buy', label: 'Depósito (Entrada)' },
                { value: 'sell', label: 'Resgate (Saída)' }
              ] : [
                { value: 'buy', label: 'Compra' },
                { value: 'sell', label: 'Venda' },
                { value: 'dividend', label: 'Dividendo' },
                { value: 'jcp', label: 'Juros sobre Capital (JCP)' },
                { value: 'fii_yield', label: 'Rendimento FII' },
                { value: 'split', label: 'Desdobro' },
                { value: 'reverse_split', label: 'Grupamento' },
                { value: 'subscription', label: 'Subscrição' }
              ]}
            />
          </div>

          {/* Data do Lançamento */}
          <Input
            label="Data do Lançamento"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="font-semibold rounded-xl"
          />

          {/* Inputs Condicionais baseados em Ticker ou Provento */}
          {isCashType || isIncomeType ? (
            <NumberInput
              label={isCashType ? "Valor em Caixa (R$)" : `Valor do Provento (${currency === 'USD' ? '$' : 'R$'})`}
              required
              step={0.01}
              min={0}
              placeholder={isCashType ? "Ex: 5000.00" : "Ex: 150.00"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-semibold rounded-xl text-base"
              prefix={currency === 'USD' ? '$' : 'R$'}
              hideSpinButtons
            />
          ) : (
            <ModalFieldRow>
              <NumberInput
                label="Quantidade"
                required
                step="any"
                min={0}
                placeholder="Ex: 10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-semibold rounded-xl text-sm"
                hideSpinButtons
              />
              <NumberInput
                label="Preço Unitário"
                required
                step="any"
                min={0}
                placeholder="Ex: 35.50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="font-semibold rounded-xl text-sm"
                hideSpinButtons
              />
            </ModalFieldRow>
          )}

          {/* Configurações do Ativo (Se não for Caixa) */}
          {!isCashType && (
            <div className="border border-glass/40 bg-glass/5 rounded-2xl p-4 space-y-4">
              <button
                type="button"
                onClick={() => setShowAssetConfig(!showAssetConfig)}
                className="w-full flex items-center justify-between text-xs font-black uppercase text-secondary tracking-wider"
              >
                <span className="flex items-center gap-1.5">
                  Parâmetros do Ativo ({ticker || 'N/A'})
                  {isNewAsset && (
                    <span className="px-1.5 py-0.5 rounded bg-income/10 text-income text-[8px] font-black uppercase tracking-normal">
                      Novo Ativo
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-primary/60 font-semibold px-2 py-0.5 rounded bg-primary/5 border border-glass/40">
                  {showAssetConfig ? 'Ocultar' : 'Configurar'}
                </span>
              </button>

              {showAssetConfig && (
                <div className="space-y-4 pt-4 border-t border-glass/20 animate-fade-in text-left">
                  {/* Forma de Precificação */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-secondary">Forma de Precificação</label>
                    <Select
                      value={pricingMode}
                      onChange={handlePricingModeChange}
                      options={[
                        { value: 'market', label: 'Cotação de Mercado (B3 / Yahoo)' },
                        { value: 'fixed_income', label: 'Renda Fixa na Curva (CDI/SELIC/IPCA)' },
                        { value: 'manual_value', label: 'Valor Manual do Ativo' },
                        { value: 'cash', label: 'Saldo em Caixa (Depósitos)' }
                      ]}
                    />
                  </div>

                  {/* Moeda e Alvo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black text-secondary">Moeda Padrão</label>
                      <Select
                        value={currency}
                        onChange={handleCurrencyChange}
                        options={[
                          { value: 'BRL', label: 'BRL (R$)' },
                          { value: 'USD', label: 'USD ($)' }
                        ]}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-black text-secondary">Alvo na Carteira (%)</label>
                      <NumberInput
                        step={0.01}
                        min={0}
                        max={100}
                        value={targetPercentage}
                        onChange={(e) => setTargetPercentage(e.target.value)}
                        placeholder="Ex: 5.5"
                        required
                        suffix="%"
                        hideSpinButtons
                      />
                    </div>
                  </div>

                  {/* Campos condicionais para Renda Fixa */}
                  {pricingMode === 'fixed_income' && (
                    <div className="space-y-4 p-3 bg-glass/5 rounded-2xl border border-glass/25 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black text-secondary">Indexador</label>
                          <Select
                            value={indexer}
                            onChange={handleIndexerChange}
                            options={[
                              { value: 'none', label: 'Pré-fixado (Nenhum)' },
                              { value: 'cdi', label: 'CDI' },
                              { value: 'selic', label: 'SELIC' },
                              { value: 'ipca', label: 'IPCA' }
                            ]}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black text-secondary">% do Indexador</label>
                          <NumberInput
                            step={0.1}
                            min={0}
                            value={indexerPercent}
                            onChange={(e) => setIndexerPercent(e.target.value)}
                            placeholder="Ex: 100"
                            disabled={indexer === 'none'}
                            required
                            suffix="%"
                            hideSpinButtons
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-black text-secondary">Taxa Contratada a.a. (%)</label>
                        <NumberInput
                          step={0.0001}
                          min={0}
                          value={contractRate}
                          onChange={(e) => setContractRate(e.target.value)}
                          placeholder="Ex: 6.5"
                          required
                          suffix="% a.a."
                          hideSpinButtons
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black text-secondary">Data de Aporte</label>
                          <Input
                            type="date"
                            value={applicationDate}
                            onChange={(e) => setApplicationDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black text-secondary">Vencimento</label>
                          <Input
                            type="date"
                            value={maturityDate}
                            onChange={(e) => setMaturityDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Campos condicionais para Valor Manual */}
                  {pricingMode === 'manual_value' && (
                    <div className="space-y-1 p-3 bg-glass/5 rounded-2xl border border-glass/25 animate-fade-in">
                      <label className="text-[9px] uppercase font-black text-secondary">Valor Atual do Ativo (Moeda Local)</label>
                      <NumberInput
                        step={0.01}
                        min={0}
                        value={manualCurrentValue}
                        onChange={(e) => setManualCurrentValue(e.target.value)}
                        placeholder="Ex: 50000.00"
                        required
                        hideSpinButtons
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Visualizador de Total */}
          {!isCashType && ((isIncomeType && amount) || (!isIncomeType && quantity && price)) && (() => {
            const totalTxValue = isIncomeType ? parseFloat(amount || '0') : (parseFloat(quantity || '0') * parseFloat(price || '0'))
            if (isNaN(totalTxValue) || totalTxValue <= 0) return null

            const isCashInflow = ['sell', 'dividend', 'jcp', 'fii_yield'].includes(operationType)
            const isCashOutflow = ['buy', 'subscription'].includes(operationType)

            let cashText = ''
            let cashVal = 0
            let isWarning = false

            if (isCashOutflow) {
              if (cashBalance >= totalTxValue) {
                cashText = 'Saldo em caixa restante'
                cashVal = cashBalance - totalTxValue
              } else {
                cashText = 'Aporte de caixa adicional necessário'
                cashVal = totalTxValue - cashBalance
                isWarning = true
              }
            } else if (isCashInflow) {
              cashText = 'Novo saldo em caixa'
              cashVal = cashBalance + totalTxValue
            }

            return (
              <div className="p-4 bg-glass/5 border border-glass/40 rounded-2xl animate-fade-in text-left space-y-3 select-none">
                <div>
                  <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Valor Total do Lançamento</span>
                  <span className="text-xl font-mono font-black text-primary mt-0.5 block">
                    {formatCurrencyByCode(totalTxValue, currency === 'USD' ? 'USD' : 'BRL')}
                  </span>
                </div>

                {(isCashOutflow || isCashInflow) && (
                  <div className="pt-3 border-t border-glass/25 flex justify-between items-center text-[10px] uppercase tracking-wider font-black">
                    <span className="text-secondary">{cashText}:</span>
                    <span className={`font-mono text-xs ${isWarning ? 'text-expense bg-expense/10 px-2 py-0.5 rounded-lg border border-expense/20' : 'text-income bg-income/10 px-2 py-0.5 rounded-lg border border-income/20'}`}>
                      {formatCurrencyByCode(cashVal, currency === 'USD' ? 'USD' : 'BRL')}
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </ModalForm>

      {isEditing && (
        <ConfirmModal
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="Excluir Lançamento"
          confirmLabel="Sim, excluir"
          confirmVariant="danger"
          loading={saving}
          onConfirm={confirmDelete}
        >
          <div className="space-y-2">
            <p className="text-sm text-secondary font-medium">
              Tem certeza de que deseja excluir permanentemente este lançamento do ativo{' '}
              <strong className="text-primary font-bold">{ticker}</strong>?
            </p>
            <p className="text-xs text-secondary/80">
              Esta ação removerá o lançamento da carteira e atualizará os saldos em caixa vinculados de forma automática.
            </p>
          </div>
        </ConfirmModal>
      )}
    </>
  )
}
