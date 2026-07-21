import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ModalFieldRow from '@/components/ModalFieldRow'
import NumberInput from '@/components/NumberInput'
import CurrencyInput from '@/components/CurrencyInput'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction, PortfolioOperationType } from '@/types'
import { detectDefaultCurrency, isCashTicker, requiresMarketQuote } from '@/utils/assetClassifier'
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
  initialTicker?: string
  onSaved: () => void
  zIndexClass?: ZIndexElevated
}

export default function PortfolioTransactionFormModal({
  isOpen,
  onClose,
  portfolioId,
  editingTransaction,
  initialTicker,
  onSaved,
  zIndexClass,
}: PortfolioTransactionFormModalProps) {
  const [ticker, setTicker] = useState('CAIXA')
  const [operationType, setOperationType] = useState<PortfolioOperationType>('buy')
  const [registrationType, setRegistrationType] = useState<'manual' | 'b3'>('manual')
  const [manualCurrentValue, setManualCurrentValue] = useState<number>(0)
  const [amount, setAmount] = useState(0)
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [saving, setSaving] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [cashBalance, setCashBalance] = useState<number>(0)

  const isEditing = !!editingTransaction
  const isCashType = isCashTicker(ticker)
  const isIncomeType = ['dividend', 'jcp', 'fii_yield'].includes(operationType)

  // Carregar dados da transação ou ticker inicial ao abrir
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
      setTicker(initialTicker ? initialTicker.toUpperCase().trim() : 'CAIXA')
      setOperationType('buy')
      setAmount(0)
      setQuantity('1')
      setPrice('')
      setManualCurrentValue(0)
      setDate(format(new Date(), 'yyyy-MM-dd'))
    }
  }, [isOpen, editingTransaction, initialTicker])

  // Carregar saldo em caixa do portfólio e identificar o tipo de lançamento automaticamente
  useEffect(() => {
    if (!isOpen || !portfolioId) return

    const fetchCashAndDef = async () => {
      try {
        const { data: pData } = await supabase
          .from('portfolios')
          .select('cash_balance')
          .eq('id', portfolioId)
          .maybeSingle()

        if (pData) {
          setCashBalance(Number(pData.cash_balance) || 0)
        }

        if (ticker) {
          const tickerUpper = ticker.toUpperCase().trim()
          if (isCashTicker(tickerUpper)) {
            setRegistrationType('manual')
            return
          }

          const { data: defData } = await supabase
            .from('portfolio_asset_definitions')
            .select('is_b3_linked, pricing_mode, manual_current_value')
            .eq('portfolio_id', portfolioId)
            .eq('ticker', tickerUpper)
            .maybeSingle()

          if (defData) {
            const isB3 = defData.is_b3_linked || defData.pricing_mode === 'market'
            setRegistrationType(isB3 ? 'b3' : 'manual')
            if (defData.manual_current_value != null) {
              setManualCurrentValue(Number(defData.manual_current_value))
            }
          } else {
            // Reconhecimento automático: Ativos B3 (Ações/FIIs/BDRs) e Internacionais (ETFs/US Stocks)
            const isMarketQuoteRequired = requiresMarketQuote(tickerUpper)
            setRegistrationType(isMarketQuoteRequired ? 'b3' : 'manual')
          }
        }
      } catch (err) {
        logger.warn('Erro ao buscar contexto do portfólio no modal:', err)
      }
    }

    void fetchCashAndDef()
  }, [isOpen, portfolioId, ticker])

  // Ajustar moeda dinamicamente conforme o ticker
  useEffect(() => {
    if (!isOpen || !ticker) return
    const tickerUpper = ticker.toUpperCase().trim()
    setCurrency(detectDefaultCurrency(tickerUpper))
  }, [ticker, isOpen])

  // Ajustar tipo de operação se o ticker mudar para CAIXA
  useEffect(() => {
    if (isCashType && !['buy', 'sell'].includes(operationType)) {
      setOperationType('buy')
    }
  }, [ticker, isCashType, operationType])

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

      // Salvar/Atualizar vínculo de precificação do ativo (Mercado vs Manual)
      if (!isCashType) {
        const { data: existingDef } = await supabase
          .from('portfolio_asset_definitions')
          .select('id')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', tickerUpper)
          .maybeSingle()

        const isB3 = registrationType === 'b3'
        const pricingMode = isB3 ? 'market' : 'manual_value'

        const defPayload = {
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: pricingMode,
          is_b3_linked: isB3,
          currency: currency,
          manual_current_value: registrationType === 'manual' && manualCurrentValue > 0 ? manualCurrentValue : null,
          manual_value_updated_at: registrationType === 'manual' && manualCurrentValue > 0 ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }

        if (existingDef) {
          await supabase
            .from('portfolio_asset_definitions')
            .update(defPayload)
            .eq('id', existingDef.id)
        } else {
          await supabase.from('portfolio_asset_definitions').insert(defPayload)
        }

        // Se o valor manual foi atualizado, registrar no histórico diário de preços
        if (registrationType === 'manual' && manualCurrentValue > 0) {
          await supabase.from('asset_price_daily').upsert(
            {
              ticker: tickerUpper,
              price_date: date,
              close_price: manualCurrentValue,
              source: 'manual_update',
            },
            { onConflict: 'ticker,price_date' }
          )
        }
      }

      // Reconciliar caixa automaticamente
      const context = await fetchPortfolioCashContext(portfolioId)
      await reconcileCashOffsetOnTransactionSave({
        portfolioId,
        transactionId: txId,
        amount: qty * unitPrice,
        date,
        assetPricingMode: isCashType ? 'cash' : (registrationType === 'b3' ? 'market' : 'manual_value'),
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
            submitLabel={isEditing ? 'Salvar alterações' : 'Salvar Transação'}
            submitDisabled={saving || 
              ((isCashType || isIncomeType) && !amount) || 
              (!(isCashType || isIncomeType) && (!ticker.trim() || !price.trim()))}
            loading={saving}
            deleteLabel={isEditing ? 'Excluir lançamento' : undefined}
            onDelete={isEditing ? () => setIsConfirmDeleteOpen(true) : undefined}
          />
        )}
      >
        <div className="space-y-4 text-left">
          {/* Tipo de Lançamento (Segmented Control Pill Bar) */}
          <div className="flex items-center justify-between gap-3 p-2 px-3 rounded-2xl bg-glass/5 border border-glass/20 text-xs select-none">
            <span className="font-black text-secondary text-[10px] uppercase tracking-widest">
              Precificação
            </span>

            <div className="bg-glass/10 p-0.5 rounded-xl border border-glass/20 flex gap-0.5">
              <button
                type="button"
                onClick={() => setRegistrationType('manual')}
                className={`px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-all duration-200 ease-out ${
                  registrationType === 'manual'
                    ? 'bg-glass-strong text-primary shadow-xs border border-glass/40 font-black'
                    : 'text-secondary hover:text-primary hover:bg-glass/5 font-medium'
                }`}
                title="Cotação e saldo definidos manualmente por extrato"
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setRegistrationType('b3')}
                className={`px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-all duration-200 ease-out ${
                  registrationType === 'b3'
                    ? 'bg-glass-strong text-income shadow-xs border border-income/30 font-black'
                    : 'text-secondary hover:text-primary hover:bg-glass/5 font-medium'
                }`}
                title="Cotação automática via B3 ou Yahoo Finance"
              >
                Mercado (B3 / Yahoo)
              </button>
            </div>
          </div>

          {/* Seletor de Ticker e Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ativo (Ticker)"
              type="text"
              required
              placeholder="Ex: WEGE3, VOO, CAIXA, AAPL"
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
              label={isCashType ? "Valor do Lançamento em Caixa" : "Valor do Provento"}
              required
              value={amount}
              onChange={(_e, val) => setAmount(val ?? 0)}
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
                onChange={(_e, val) => setPrice((val ?? 0) > 0 ? String(val ?? 0) : '')}
                className="font-semibold rounded-xl text-sm"
              />
            </ModalFieldRow>
          )}

          {/* Campo de Saldo Atual para Ativos Manuais */}
          {registrationType === 'manual' && !isCashType && (
            <CurrencyInput
              label="Saldo Atual do Ativo (Extrato - Opcional)"
              value={manualCurrentValue}
              onChange={(_e, val) => setManualCurrentValue(val ?? 0)}
              placeholder="Ex: 5000,00"
              className="font-semibold rounded-xl text-sm"
            />
          )}

          {/* Demonstrativo Discreto de Valor Total e Saldo em Caixa */}
          {(() => {
            const txVal = isCashType || isIncomeType ? amount : (parseFloat(quantity || '0') * parseFloat(price || '0'))
            if (isNaN(txVal) || txVal <= 0) return null

            let isOutflow = false
            let isInflow = false

            if (isCashType) {
              isOutflow = operationType === 'sell'
              isInflow = operationType === 'buy'
            } else {
              isOutflow = ['buy', 'subscription'].includes(operationType)
              isInflow = ['sell', 'dividend', 'jcp', 'fii_yield'].includes(operationType)
            }

            const finalCashBalance = isOutflow
              ? cashBalance - txVal
              : isInflow
              ? cashBalance + txVal
              : cashBalance

            const isDeficit = finalCashBalance < 0

            return (
              <div className="p-3 bg-glass/5 border border-glass/20 rounded-xl animate-fade-in text-xs space-y-2 select-none">
                <div className="flex items-center justify-between text-secondary">
                  <span className="font-medium text-[11px]">Valor Total</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {formatCurrencyByCode(txVal, currency === 'USD' ? 'USD' : 'BRL')}
                  </span>
                </div>

                <div className="pt-2 border-t border-glass/15 flex items-center justify-between text-[11px]">
                  <span className="text-secondary font-medium">Saldo em caixa</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-secondary font-medium">{formatCurrencyByCode(cashBalance, 'BRL')}</span>
                    <span className="text-secondary/60">→</span>
                    <span
                      className={`font-semibold ${
                        isDeficit ? 'text-expense font-bold' : 'text-income'
                      }`}
                    >
                      {isDeficit
                        ? `Aporte necessário: ${formatCurrencyByCode(Math.abs(finalCashBalance), 'BRL')}`
                        : formatCurrencyByCode(finalCashBalance, 'BRL')}
                    </span>
                  </div>
                </div>
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
