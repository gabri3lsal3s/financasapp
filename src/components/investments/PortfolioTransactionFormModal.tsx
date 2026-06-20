import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ModalFieldRow from '@/components/ModalFieldRow'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction, PortfolioOperationType } from '@/types'
import { detectDefaultCurrency } from '@/utils/portfolioCalculations'
import { formatCurrency } from '@/utils/format'
import { fetchPortfolioCashContext, reconcileCashOffsetOnTransactionSave, deleteCashOffsetTransactions } from '@/services/cashOffsetService'
import { cleanupOrphanPortfolioTickers } from '@/services/portfolioOrphanCleanup'
import ConfirmModal from '@/components/ConfirmModal'
import toast from 'react-hot-toast'

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

  const isEditing = !!editingTransaction
  const isCashType = ticker === 'CAIXA' || ticker === 'SALDO_INV' || ticker === 'SALDO EM CAIXA' || ticker === 'SALDO_EM_CAIXA'

  useEffect(() => {
    if (!isOpen) return

    if (editingTransaction) {
      setTicker(editingTransaction.ticker.toUpperCase().trim())
      setOperationType(editingTransaction.operation_type)
      setDate(editingTransaction.date)
      
      const isCash = editingTransaction.ticker === 'CAIXA' || editingTransaction.ticker === 'SALDO_INV' || editingTransaction.ticker === 'SALDO EM CAIXA' || editingTransaction.ticker === 'SALDO_EM_CAIXA'
      
      if (isCash) {
        setAmount(String(editingTransaction.price))
        setQuantity('1')
        setPrice(String(editingTransaction.price))
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

  // Ajustar tipo de operação adequado se o ticker mudar para CAIXA
  useEffect(() => {
    if (isCashType && !['buy', 'sell'].includes(operationType)) {
      setOperationType('buy')
    }
  }, [ticker])

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

      let qty = 1
      let unitPrice = 0

      if (isCashType) {
        unitPrice = parseFloat(amount)
        qty = 1
        if (isNaN(unitPrice) || unitPrice <= 0) {
          throw new Error('Insira um valor de caixa válido maior que zero.')
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

      // 2. Criar definição básica do ativo se ainda não existir
      const pricingMode = isCashType ? 'cash' : (['CDI', 'SELIC', 'IPCA', 'TESOURO'].some(rf => tickerUpper.includes(rf)) ? 'fixed_income' : 'market')
      const currency = detectDefaultCurrency(tickerUpper)

      const { data: existingDef } = await supabase
        .from('portfolio_asset_definitions')
        .select('id')
        .eq('portfolio_id', portfolioId)
        .eq('ticker', tickerUpper)
        .maybeSingle()

      if (!existingDef) {
        await supabase
          .from('portfolio_asset_definitions')
          .insert({
            portfolio_id: portfolioId,
            ticker: tickerUpper,
            pricing_mode: pricingMode,
            is_b3_linked: pricingMode === 'market',
            applied_amount: pricingMode === 'fixed_income' ? qty * unitPrice : null,
            contract_rate: pricingMode === 'fixed_income' ? 0 : null,
            indexer: pricingMode === 'fixed_income' ? 'none' : 'none',
            indexer_percent: 100,
            maturity_date: null,
            application_date: date,
            manual_current_value: null,
            manual_value_updated_at: null,
            tax_exempt: false,
            is_treasury: tickerUpper.includes('TESOURO'),
            currency: currency,
            updated_at: new Date().toISOString(),
          })
      }

      // 3. Reconciliar caixa automaticamente
      const context = await fetchPortfolioCashContext(portfolioId)
      await reconcileCashOffsetOnTransactionSave({
        portfolioId,
        transactionId: txId,
        amount: qty * unitPrice,
        date,
        assetPricingMode: pricingMode,
        operationType,
        transactions: context.transactions,
        definitions: context.definitions,
      })

      toast.success(isEditing ? 'Lançamento atualizado!' : 'Transação registrada com sucesso!')
      
      // Disparar evento local
      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_transactions' }
      }))

      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar transação.')
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
            submitDisabled={saving || (!isEditing && isCashType && !amount.trim()) || (!isEditing && !isCashType && (!ticker.trim() || !price.trim()))}
            loading={saving}
            deleteLabel={isEditing ? 'Excluir lançamento' : undefined}
            onDelete={isEditing ? () => setIsConfirmDeleteOpen(true) : undefined}
          />
        )}
      >
        <div className="space-y-4 text-left">
          {/* Seletor de Ticker e Tipo (Apenas ao Adicionar) */}
          {!isEditing ? (
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
                onChange={(e) => setOperationType(e.target.value as any)}
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
          ) : (
            <div className="flex gap-4 p-3 bg-glass border border-glass rounded-xl text-xs font-semibold text-secondary items-center select-none">
              <div>
                <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Ativo</span>
                <strong className="text-primary font-mono text-sm">{ticker}</strong>
              </div>
              <div className="w-[1px] h-6 bg-glass-strong" />
              <div>
                <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Operação</span>
                <strong className="text-primary text-sm uppercase">
                  {operationType === 'buy' ? 'Compra' : operationType === 'sell' ? 'Venda' : operationType}
                </strong>
              </div>
            </div>
          )}

          {/* Data do Lançamento */}
          <Input
            label="Data do Lançamento"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="font-semibold rounded-xl"
          />

          {/* Inputs Condicionais baseados em Ticker */}
          {isCashType ? (
            <Input
              label="Valor em Caixa (R$)"
              type="number"
              required
              step="0.01"
              placeholder="Ex: 5000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-semibold rounded-xl text-base focus:ring-2 focus:ring-primary"
            />
          ) : (
            <ModalFieldRow>
              <Input
                label="Quantidade"
                type="number"
                required
                step="any"
                placeholder="Ex: 10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-semibold rounded-xl text-sm"
              />
              <Input
                label="Preço Unitário"
                type="number"
                required
                step="any"
                placeholder="Ex: 35.50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="font-semibold rounded-xl text-sm"
              />
            </ModalFieldRow>
          )}

          {/* Visualizador de Total */}
          {!isCashType && quantity && price && (
            <div className="p-3 bg-balance/5 border border-balance/25 rounded-2xl animate-fade-in text-left select-none">
              <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Valor Total do Lançamento</span>
              <span className="text-xl font-mono font-black text-balance mt-0.5 block">
                {formatCurrency(parseFloat(quantity || '0') * parseFloat(price || '0'))}
              </span>
            </div>
          )}
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
