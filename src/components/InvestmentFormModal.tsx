import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import { Investment } from '@/types'
import {
  APP_START_DATE,
  formatMoneyInput,
  parseMoneyInput,
} from '@/utils/format'
import { searchB3Assets, getAssetRichData } from '@/services/priceService'
import { Loader2, DollarSign, Briefcase } from 'lucide-react'

interface InvestmentFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingInvestment: Investment | null
  defaultMonth: string
  onCreate: (
    investment: Omit<Investment, 'id' | 'created_at'>
  ) => Promise<{ data: Investment | null; error: string | null }>
  onUpdate: (
    id: string,
    updates: Partial<Investment>
  ) => Promise<{ data: Investment | null; error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
}

export default function InvestmentFormModal({
  isOpen,
  onClose,
  editingInvestment,
  defaultMonth,
  onCreate,
  onUpdate,
  onDelete,
}: InvestmentFormModalProps) {
  const [formData, setFormData] = useState({
    type: 'cash', // 'cash' | 'asset'
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    month: defaultMonth,
    description: '',
    ticker: '',
    quantity: '',
    price: '',
  })

  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingRichData, setLoadingRichData] = useState(false)
  const [richData, setRichData] = useState<any>(null)

  // Sincronizar dados do formulário quando abre para edição ou novo
  useEffect(() => {
    if (isOpen) {
      if (editingInvestment) {
        const isAsset = !!editingInvestment.ticker
        setFormData({
          type: isAsset ? 'asset' : 'cash',
          amount: formatMoneyInput(editingInvestment.amount),
          date: `${editingInvestment.month}-01`,
          month: editingInvestment.month,
          description: editingInvestment.description || '',
          ticker: editingInvestment.ticker || '',
          quantity: editingInvestment.quantity ? String(editingInvestment.quantity) : '',
          price: editingInvestment.price ? formatMoneyInput(editingInvestment.price) : '',
        })
        setRichData(null)
        setSuggestions([])
        setShowSuggestions(false)
      } else {
        setFormData({
          type: 'cash',
          amount: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          month: defaultMonth,
          description: '',
          ticker: '',
          quantity: '',
          price: '',
        })
        setRichData(null)
        setSuggestions([])
        setShowSuggestions(false)
      }
    }
  }, [isOpen, editingInvestment, defaultMonth])

  // Recalcular valor total em tempo real no modo de aporte direto em ativo
  useEffect(() => {
    if (formData.type === 'asset') {
      const qty = parseFloat(formData.quantity)
      const prc = parseMoneyInput(formData.price)
      if (!isNaN(qty) && qty > 0 && !isNaN(prc) && prc > 0) {
        const total = qty * prc
        setFormData((prev) => ({ ...prev, amount: formatMoneyInput(total) }))
      } else {
        setFormData((prev) => ({ ...prev, amount: '' }))
      }
    }
  }, [formData.quantity, formData.price, formData.type])

  const handleAmountChange = (nextAmount: string) => {
    setFormData((prev) => ({ ...prev, amount: nextAmount }))
  }

  const handleTickerChange = async (val: string) => {
    setFormData((prev) => ({ ...prev, ticker: val }))
    if (val.length >= 2) {
      const results = await searchB3Assets(val)
      setSuggestions(results)
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = async (ticker: string) => {
    setFormData((prev) => ({ ...prev, ticker }))
    setShowSuggestions(false)
    setLoadingRichData(true)
    try {
      const data = await getAssetRichData(ticker)
      if (data) {
        setRichData(data)
        setFormData((prev) => ({
          ...prev,
          ticker: data.ticker,
          price: formatMoneyInput(data.price),
        }))
      }
    } catch (e) {
      console.warn('Erro ao obter cotação rica do ativo:', e)
    } finally {
      setLoadingRichData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const selectedDate = formData.date || format(new Date(), 'yyyy-MM-dd')
    const selectedMonth = selectedDate.substring(0, 7)

    if (formData.type === 'asset') {
      const tickerVal = formData.ticker.toUpperCase().trim()
      const qtyVal = parseFloat(formData.quantity)
      const priceVal = parseMoneyInput(formData.price)

      if (!tickerVal) {
        alert('Por favor, informe o Ticker do ativo.')
        return
      }
      if (isNaN(qtyVal) || qtyVal <= 0) {
        alert('Por favor, informe uma quantidade maior que zero.')
        return
      }
      if (isNaN(priceVal) || priceVal <= 0) {
        alert('Por favor, informe um preço unitário maior que zero.')
        return
      }

      const calculatedAmount = qtyVal * priceVal

      const investmentData: Omit<Investment, 'id' | 'created_at'> = {
        amount: calculatedAmount,
        month: selectedMonth,
        description: formData.description || `Aporte direto em ${tickerVal}`,
        ticker: tickerVal,
        quantity: qtyVal,
        price: priceVal,
      }

      if (editingInvestment) {
        const { error } = await onUpdate(editingInvestment.id, investmentData)
        if (!error) {
          onClose()
        } else {
          alert('Erro ao atualizar aporte: ' + error)
        }
      } else {
        const { error } = await onCreate(investmentData)
        if (!error) {
          onClose()
        } else {
          alert('Erro ao realizar aporte: ' + error)
        }
      }
    } else {
      // Tipo Caixa Livre
      if (!formData.amount) return

      const amount = parseMoneyInput(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        alert('Por favor, insira um valor válido maior que zero')
        return
      }

      const investmentData: Omit<Investment, 'id' | 'created_at'> = {
        amount,
        month: selectedMonth,
        description: formData.description || undefined,
        ticker: undefined,
        quantity: undefined,
        price: undefined,
        transaction_id: undefined,
      }

      if (editingInvestment) {
        const { error } = await onUpdate(editingInvestment.id, investmentData)
        if (!error) {
          onClose()
        } else {
          alert('Erro ao atualizar investimento: ' + error)
        }
      } else {
        const { error } = await onCreate(investmentData)
        if (!error) {
          onClose()
        } else {
          alert('Erro ao criar investimento: ' + error)
        }
      }
    }
  }

  const handleDeleteFromModal = async () => {
    if (!editingInvestment) return
    if (!confirm('Tem certeza que deseja excluir este investimento?')) return

    const { error } = await onDelete(editingInvestment.id)
    if (error) {
      alert('Erro ao excluir investimento: ' + error)
      return
    }

    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingInvestment ? 'Editar aporte' : 'Adicionar aporte'}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-4">
        {/* Seletor de Tipo (Tabs Premium) */}
        {!editingInvestment ? (
          <div className="flex gap-2 p-1 bg-secondary border border-primary rounded-xl mb-4 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, type: 'cash' }))}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                formData.type === 'cash'
                  ? 'bg-primary text-primary shadow-sm border border-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <DollarSign size={12} />
              Caixa Livre
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, type: 'asset' }))}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                formData.type === 'asset'
                  ? 'bg-primary text-primary shadow-sm border border-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Briefcase size={12} />
              Ativo B3
            </button>
          </div>
        ) : (
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary border border-primary rounded-full text-xs font-semibold text-secondary">
              {formData.type === 'asset' ? (
                <>
                  <Briefcase size={12} className="text-indigo-500" />
                  Aporte em Ativo: {formData.ticker}
                </>
              ) : (
                <>
                  <DollarSign size={12} className="text-emerald-500" />
                  Aporte em Caixa Livre
                </>
              )}
            </span>
          </div>
        )}

        {formData.type === 'cash' ? (
          <Input
            label="Valor"
            type="text"
            inputMode="decimal"
            value={formData.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            onBlur={() => {
              const parsed = parseMoneyInput(formData.amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                handleAmountChange(formatMoneyInput(parsed))
              }
            }}
            placeholder="0,00"
            required
          />
        ) : (
          <>
            {/* Ticker Autocomplete */}
            <div className="relative text-left">
              <Input
                label="Ticker do Ativo"
                type="text"
                value={formData.ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => formData.ticker.length >= 2 && setShowSuggestions(true)}
                placeholder="Ex: WEGE3, PETR4..."
                className="uppercase"
                required
                disabled={!!editingInvestment}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[1001] w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.ticker}
                      type="button"
                      onClick={() => handleSelectSuggestion(s.ticker)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-tertiary text-primary flex items-center justify-between border-b border-primary/10 last:border-0"
                    >
                      <span className="font-bold">{s.ticker}</span>
                      <span className="text-[10px] text-secondary truncate max-w-[150px]">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingRichData && (
              <div className="text-[10px] text-secondary animate-pulse pl-1 text-left flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin text-indigo-500" />
                Buscando cotação em tempo real na B3...
              </div>
            )}

            {richData && (
              <div className="p-3 bg-secondary/55 border border-primary rounded-xl text-xs space-y-1 text-secondary animate-page-enter text-left">
                <div className="flex justify-between items-center">
                  <strong className="text-primary font-bold">{richData.name}</strong>
                  <span className="text-emerald-500 font-extrabold">R$ {richData.price.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Qtd & Preço */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantidade"
                type="number"
                step="any"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="Ex: 10"
                required
              />
              <Input
                label="Preço Unitário"
                type="text"
                inputMode="decimal"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                onBlur={() => {
                  const parsed = parseMoneyInput(formData.price)
                  if (!Number.isNaN(parsed) && parsed >= 0) {
                    setFormData({ ...formData, price: formatMoneyInput(parsed) })
                  }
                }}
                placeholder="0,00"
                required
              />
            </div>

            {/* Valor Total Calculado */}
            <Input
              label="Valor Total do Aporte"
              type="text"
              value={formData.amount}
              disabled
              placeholder="Calculado automaticamente..."
              className="bg-secondary/40 cursor-not-allowed font-bold text-indigo-500 dark:text-indigo-300"
            />
          </>
        )}

        <Input
          label="Data"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          min={APP_START_DATE}
          required
        />

        <Input
          label="Descrição (opcional)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={formData.type === 'asset' ? 'Ex: Aporte carteira Cerrado...' : 'Ex: Reserva de emergência...'}
        />

        <ModalActionFooter
          onCancel={onClose}
          submitLabel={editingInvestment ? 'Salvar alterações' : 'Salvar'}
          deleteLabel={editingInvestment ? 'Excluir aporte' : undefined}
          onDelete={editingInvestment ? handleDeleteFromModal : undefined}
        />
      </form>
    </Modal>
  )
}
