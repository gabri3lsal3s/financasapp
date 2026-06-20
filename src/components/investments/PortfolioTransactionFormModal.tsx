import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ModalFieldRow from '@/components/ModalFieldRow'
import Input from '@/components/Input'
import { supabase } from '@/lib/supabase'
import type { PortfolioTransaction } from '@/types'
import { toPricingMode, detectCurrency, isTreasury } from '@/utils/assetClassifier'
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
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  const isEditing = !!editingTransaction
  const isCashType = isEditing ? (editingTransaction.ticker === 'CAIXA' || editingTransaction.ticker === 'SALDO_INV') : true

  useEffect(() => {
    if (!isOpen) return

    if (editingTransaction) {
      setDate(editingTransaction.date)
      if (editingTransaction.ticker === 'CAIXA' || editingTransaction.ticker === 'SALDO_INV') {
        setAmount(String(editingTransaction.price))
        setQuantity('1')
        setPrice(String(editingTransaction.price))
      } else {
        setAmount('')
        setQuantity(String(editingTransaction.quantity))
        setPrice(String(editingTransaction.price))
      }
    } else {
      setAmount('')
      setQuantity('1')
      setPrice('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
    }
  }, [isOpen, editingTransaction])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) {
      toast.error('Carteira não disponível.')
      return
    }

    setSaving(true)
    try {
      const tickerUpper = isEditing ? editingTransaction.ticker.toUpperCase().trim() : 'CAIXA'
      const operationType = isEditing ? editingTransaction.operation_type : 'buy'

      let qty = 1
      let unitPrice = 0

      if (tickerUpper === 'CAIXA' || tickerUpper === 'SALDO_INV') {
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

      const pricingMode = toPricingMode(tickerUpper) || 'market'
      const isTr = isTreasury(tickerUpper)
      const currency = detectCurrency(tickerUpper)

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

      // Upsert asset definitions to support cashOffsetService classifications
      await supabase
        .from('portfolio_asset_definitions')
        .upsert({
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: pricingMode,
          is_b3_linked: pricingMode === 'market',
          applied_amount: pricingMode === 'fixed_income' || pricingMode === 'manual_value' ? qty * unitPrice : null,
          contract_rate: null,
          indexer: 'none',
          indexer_percent: 100,
          maturity_date: null,
          application_date: date,
          manual_current_value: null,
          manual_value_updated_at: null,
          tax_exempt: false,
          is_treasury: isTr,
          currency: currency,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'portfolio_id,ticker' })

      // Automatically reconcile cash offsets in database
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

      toast.success(isEditing ? 'Transação atualizada!' : 'Aporte em caixa registrado!')
      onSaved()
      onClose()
    } catch (err) {
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

      window.dispatchEvent(
        new CustomEvent('local-data-changed', { detail: { entity: 'investments' } })
      )
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
        title={isEditing ? 'Editar Lançamento' : 'Adicionar Saldo em Caixa'}
        onSubmit={handleSubmit}
        size="md"
        zIndexClass={zIndexClass}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={onClose}
            submitLabel={isEditing ? 'Salvar alterações' : 'Salvar Aporte'}
            submitDisabled={saving || (!isEditing && !amount.trim())}
            loading={saving}
            deleteLabel={isEditing ? 'Excluir lançamento' : undefined}
            onDelete={isEditing ? () => setIsConfirmDeleteOpen(true) : undefined}
          />
        )}
      >
        {isEditing && (
          <div className="flex gap-4 p-3 bg-glass border border-glass rounded-xl text-xs font-semibold text-secondary items-center">
            <div>
              <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Ativo</span>
              <strong className="text-primary font-mono text-sm">{editingTransaction.ticker}</strong>
            </div>
            <div className="w-[1px] h-6 bg-glass-strong" />
            <div>
              <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Operação</span>
              <strong className="text-primary text-sm uppercase">
                {editingTransaction.operation_type === 'buy' ? 'Aporte/Compra' : editingTransaction.operation_type === 'sell' ? 'Retirada/Venda' : editingTransaction.operation_type}
              </strong>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Data do Lançamento"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="font-semibold rounded-xl"
          />

          {isCashType ? (
            <div>
              <Input
                label="Valor do Aporte em Caixa (R$)"
                type="number"
                required
                step="0.01"
                placeholder="Ex: 5000.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-semibold rounded-xl text-base focus:ring-2 focus:ring-primary"
              />
            </div>
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

          {!isCashType && quantity && price && (
            <div className="p-3 bg-balance/5 border border-balance/25 rounded-2xl animate-fade-in text-left">
              <span className="text-[10px] text-secondary font-bold uppercase tracking-wider block">Valor Total Movimentado</span>
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
              <strong className="text-primary font-bold">{editingTransaction.ticker}</strong>?
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
