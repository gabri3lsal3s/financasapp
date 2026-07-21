import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ModalFieldRow from '@/components/ModalFieldRow'
import NumberInput from '@/components/NumberInput'
import CurrencyInput from '@/components/CurrencyInput'
import Input from '@/components/Input'
import FieldLabel from '@/components/FieldLabel'
import Select from '@/components/Select'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction, PortfolioOperationType, PortfolioPricingMode } from '@/types'
import { detectDefaultCurrency, isCashTicker } from '@/utils/assetClassifier'
import { formatCurrencyByCode } from '@/utils/format'
import { fetchPortfolioCashContext, reconcileCashOffsetOnTransactionSave, deleteCashOffsetTransactions } from '@/services/cashOffsetService'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'
import ConfirmModal from '@/components/ConfirmModal'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import type { ZIndexElevated } from '@/constants/zIndex'

interface PortfolioTransactionFormModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  editingTransaction: PortfolioTransaction | null
  onSaved: () => void
  zIndexClass?: ZIndexElevated
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
  const [amount, setAmount] = useState(0)
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pricingMode, setPricingMode] = useState<PortfolioPricingMode>('market')
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [saving, setSaving] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [cashBalance, setCashBalance] = useState<number>(0)

  // Renda Fixa específicos
  const [indexer, setIndexer] = useState<'none' | 'cdi' | 'selic' | 'ipca'>('none')
  const [indexerPercent, setIndexerPercent] = useState<string>('100')
  const [contractRate, setContractRate] = useState<string>('0')
  const [maturityDate, setMaturityDate] = useState<string>('')
  const [applicationDate, setApplicationDate] = useState<string>('')

  // Meta e Valor Atual
  const [targetPercentage, setTargetPercentage] = useState<string>('0')
  const [manualCurrentValue, setManualCurrentValue] = useState<number>(0)


  const isEditing = !!editingTransaction
  const isCashType = isCashTicker(ticker)
  const isIncomeType = ['dividend', 'jcp', 'fii_yield'].includes(operationType)

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
        setAmount(editingTransaction.price)
        setQuantity('1')
        setPrice(String(editingTransaction.price))
      } else if (isIncome) {
        const totalVal = Number(editingTransaction.quantity) * Number(editingTransaction.price)
        setAmount(totalVal)
        setQuantity('1')
        setPrice(String(totalVal))
      } else {
        setAmount(0)
        setQuantity(String(editingTransaction.quantity))
        setPrice(String(editingTransaction.price))
      }
    } else {
      setTicker('CAIXA')
      setOperationType('buy')
      setAmount(0)
      setQuantity('1')
      setPrice('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setIndexer('none')
      setIndexerPercent('100')
      setContractRate('0')
      setMaturityDate('')
      setApplicationDate('')
    }
  }, [isOpen, editingTransaction])

  // Carregar saldo em caixa do portfólio
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

  // Ajustar tipo de operação se o ticker mudar para CAIXA
  useEffect(() => {
    if (isCashType && !['buy', 'sell'].includes(operationType)) {
      setOperationType('buy')
    }
  }, [ticker])

  // Buscar definição do ativo para precificação e moeda
  useEffect(() => {
    if (!isOpen || !portfolioId) return
    const tickerUpper = ticker.toUpperCase().trim()
    if (!tickerUpper || isCashType) return

    let isSubscribed = true

    const fetchDef = async () => {
      try {
        const { data: def } = await supabase
          .from('portfolio_asset_definitions')
          .select('pricing_mode, currency, indexer, indexer_percent, contract_rate, maturity_date, application_date, manual_current_value')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
          .maybeSingle()

        const { data: target } = await supabase
          .from('target_allocations')
          .select('target_percentage')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
          .maybeSingle()

        if (!isSubscribed) return

        if (def) {
          setPricingMode(def.pricing_mode)
          setCurrency(def.currency || 'BRL')
          setIndexer(def.indexer || 'none')
          setIndexerPercent(String(def.indexer_percent ?? 100))
          setContractRate(String(def.contract_rate ?? 0))
          setMaturityDate(def.maturity_date ?? '')
          setApplicationDate(def.application_date ?? '')
          setManualCurrentValue(Number(def.manual_current_value) || 0)
        } else {
          // Novo ativo: sugerir parâmetros usando assetClassifier
          const isFixed = ['CDI', 'SELIC', 'IPCA', 'TESOURO', 'CDB', 'LCI', 'LCA', 'DEBENTURE'].some(rf => tickerUpper.includes(rf))
          const suggestedMode = isFixed ? 'manual_value' : 'market'
          setPricingMode(suggestedMode)
          setCurrency(detectDefaultCurrency(tickerUpper))
          setIndexer('none')
          setIndexerPercent('100')
          setContractRate('0')
          setMaturityDate('')
          setApplicationDate('')
          setManualCurrentValue(0)
        }

        if (target && target.target_percentage !== undefined && target.target_percentage !== null) {
          setTargetPercentage(String(target.target_percentage))
        } else {
          setTargetPercentage('0')
        }

      } catch (err) {
        logger.error('Erro ao carregar definição do ativo:', err)
      }
    }


    const timer = setTimeout(fetchDef, 300)
    return () => {
      isSubscribed = false
      clearTimeout(timer)
    }
  }, [ticker, isOpen, portfolioId])

  const PRICING_MODES: PortfolioPricingMode[] = ['market', 'fixed_income', 'manual_value', 'cash']

  const handlePricingModeChange = (e: { target: { value: string } }) => {
    const val = e.target.value
    if ((PRICING_MODES as string[]).includes(val)) {
      setPricingMode(val as PortfolioPricingMode)
    }
  }

  const handleCurrencyChange = (e: { target: { value: string } }) => {
    setCurrency(e.target.value as 'BRL' | 'USD')
  }

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
        unitPrice = amount
        qty = 1
        if (isNaN(unitPrice) || unitPrice <= 0) {
          throw new Error(isCashType ? 'Insira um valor de caixa válido.' : 'Insira um valor de provento válido.')
        }
      } else {
        qty = parseFloat(quantity)
        unitPrice = parseFloat(price)
        if (isNaN(qty) || qty <= 0) throw new Error('Quantidade inválida.')
        if (isNaN(unitPrice) || unitPrice < 0) throw new Error('Preço unitário inválido.')
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

      // Salvar/Atualizar definição do ativo
      const finalPricingMode = isCashType ? 'cash' : pricingMode
      const finalCurrency = isCashType ? 'BRL' : currency

      if (!isCashType) {
        const { data: existingDef } = await supabase
          .from('portfolio_asset_definitions')
          .select('id')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
          .maybeSingle()

        const manualValToSave = finalPricingMode === 'manual_value' && manualCurrentValue > 0 ? manualCurrentValue : null

        const defPayload = {
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: finalPricingMode,
          is_b3_linked: finalPricingMode === 'market',
          currency: finalCurrency,
          indexer: finalPricingMode === 'fixed_income' ? indexer : 'none',
          indexer_percent: finalPricingMode === 'fixed_income' ? parseFloat(indexerPercent) : 100,
          contract_rate: finalPricingMode === 'fixed_income' ? parseFloat(contractRate) : 0,
          maturity_date: finalPricingMode === 'fixed_income' && maturityDate ? maturityDate : null,
          application_date: finalPricingMode === 'fixed_income' && applicationDate ? applicationDate : null,
          manual_current_value: manualValToSave,
          manual_value_updated_at: manualValToSave ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }

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

        if (manualValToSave && manualValToSave > 0) {
          const qtyNum = parseFloat(quantity) || 1
          const unitPrice = qtyNum > 0 ? manualValToSave / qtyNum : manualValToSave
          await supabase.from('asset_price_daily').upsert(
            {
              ticker: tickerUpper,
              price_date: new Date().toISOString().slice(0, 10),
              close_price: unitPrice,
              source: 'manual_update',
            },
            { onConflict: 'ticker,price_date' }
          )
        }


        // Salvar/Atualizar Meta na Carteira (%)
        const targetPct = parseFloat(targetPercentage)
        if (!isNaN(targetPct)) {
          const { data: existingTarget } = await supabase
            .from('target_allocations')
            .select('id')
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)
            .maybeSingle()

          if (existingTarget) {
            await supabase
              .from('target_allocations')
              .update({ target_percentage: targetPct })
              .eq('id', existingTarget.id)
          } else if (targetPct > 0) {
            await supabase
              .from('target_allocations')
              .insert({
                portfolio_id: portfolioId,
                ticker: tickerUpper,
                target_percentage: targetPct,
              })
          }
        }
      }


      // Reconciliar caixa automaticamente
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
            submitLabel={isEditing ? 'Salvar alterações' : 'Salvar Transação'}              submitDisabled={saving || 
              ((isCashType || isIncomeType) && !amount) || 
              (!(isCashType || isIncomeType) && (!ticker.trim() || !price.trim()))}
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
                    setAmount(qtyVal * priceVal)
                  }
                } else if (!isIncome && wasIncome) {
                  if (!isNaN(amount)) {
                    setPrice(String(amount))
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

          {/* Inputs Condicionais */}
          {isCashType || isIncomeType ? (
            <CurrencyInput
              label={isCashType ? "Valor em Caixa" : "Valor do Provento"}
              required
              value={amount}
              onChange={(_e, val) => setAmount(val)}
              className="font-semibold rounded-xl text-base"
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
              <CurrencyInput
                label="Preço Unitário"
                required
                value={parseFloat(price) || 0}
                onChange={(_e, val) => setPrice(val > 0 ? String(val) : '')}
                className="font-semibold rounded-xl text-sm"
              />
            </ModalFieldRow>
          )}

          {/* Precificação, Moeda e Meta na Carteira */}
          {!isCashType && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <FieldLabel>Precificação</FieldLabel>
                <Select
                  value={pricingMode}
                  onChange={handlePricingModeChange}
                  options={[
                    { value: 'manual_value', label: 'Valor Manual' },
                    { value: 'market', label: 'Cotação B3' },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Moeda</FieldLabel>
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
                <FieldLabel>Meta na Carteira</FieldLabel>
                <NumberInput
                  step={0.1}
                  min={0}
                  max={100}
                  value={targetPercentage}
                  onChange={(e) => setTargetPercentage(e.target.value)}
                  placeholder="Ex: 5.0"
                  suffix="%"
                  hideSpinButtons
                />
              </div>
            </div>
          )}

          {/* Saldo Atual no Extrato para Valor Manual */}
          {!isCashType && pricingMode === 'manual_value' && (
            <div className="p-3 bg-glass/5 rounded-2xl border border-glass/25 text-left text-xs space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary block">Saldo Atual no Extrato (Opcional)</span>
                <span className="text-[10px] text-secondary font-mono font-bold">
                  {currency === 'USD' ? '$' : 'R$'}
                </span>
              </div>
              <CurrencyInput
                value={manualCurrentValue}
                onChange={(_e, val) => setManualCurrentValue(val)}
                placeholder="Ex: 5150.00"
              />
              <p className="text-secondary/80 text-[10px]">
                Preencha caso já queira definir o valor atual no extrato. Se mantido em zero, o valor de compra será considerado como saldo inicial.
              </p>
            </div>
          )}

          {/* Visualizador de Total + Impacto no Caixa */}
          {!isCashType && ((isIncomeType && amount) || (!isIncomeType && quantity && price)) && (() => {
            const totalTxValue = isIncomeType ? (amount || 0) : (parseFloat(quantity || '0') * parseFloat(price || '0'))
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
                cashText = 'Aporte adicional necessário'
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
