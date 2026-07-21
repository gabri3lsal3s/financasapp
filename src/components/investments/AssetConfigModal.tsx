import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/Modal'
import NumberInput from '@/components/NumberInput'
import CurrencyInput from '@/components/CurrencyInput'
import Select from '@/components/Select'
import Button from '@/components/Button'
import FieldLabel from '@/components/FieldLabel'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

interface AssetConfigModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  ticker: string
  onSaved: () => void
}

type PricingMode = 'market' | 'fixed_income' | 'manual_value' | 'cash'
type Currency = 'BRL' | 'USD'

const PRICING_MODES: PricingMode[] = ['market', 'fixed_income', 'manual_value', 'cash']
const CURRENCIES: Currency[] = ['BRL', 'USD']

export default function AssetConfigModal({
  isOpen,
  onClose,
  portfolioId,
  ticker,
  onSaved
}: AssetConfigModalProps) {
  const [loading, setLoading] = useState(false)

  // Campos do formulário
  const [pricingMode, setPricingMode] = useState<PricingMode>('market')
  const [currency, setCurrency] = useState<Currency>('BRL')
  const [targetPercentage, setTargetPercentage] = useState<string>('0')

  // Valor Manual específicos
  const [manualCurrentValue, setManualCurrentValue] = useState<number>(0)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Carregar definição do ativo
      const { data: def, error: defErr } = await supabase
        .from('portfolio_asset_definitions')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .eq('ticker', ticker.toUpperCase())
        .maybeSingle()

      if (defErr) throw defErr

      if (def) {
        setPricingMode(def.pricing_mode || 'market')
        setCurrency(def.currency || 'BRL')
        setManualCurrentValue(def.manual_current_value ?? 0)
      } else {
        setPricingMode('market')
        setCurrency('BRL')
        setManualCurrentValue(0)
      }

      // 2. Carregar alocação alvo
      const { data: target, error: targetErr } = await supabase
        .from('target_allocations')
        .select('target_percentage')
        .eq('portfolio_id', portfolioId)
        .eq('ticker', ticker.toUpperCase())
        .maybeSingle()

      if (targetErr) throw targetErr

      if (target) {
        setTargetPercentage(String(target.target_percentage))
      } else {
        setTargetPercentage('0')
      }
    } catch (err) {
      logger.error('[AssetConfigModal] Erro ao carregar configurações:', err)
      toast.error('Erro ao carregar configurações do ativo.')
    } finally {
      setLoading(false)
    }
  }, [portfolioId, ticker])

  useEffect(() => {
    if (isOpen && ticker && portfolioId) {
      void loadConfig()
    }
  }, [isOpen, ticker, portfolioId, loadConfig])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const upperTicker = ticker.toUpperCase().trim()

      const defPayload = {
        portfolio_id: portfolioId,
        ticker: upperTicker,
        pricing_mode: pricingMode,
        currency: currency,
        manual_current_value: pricingMode === 'manual_value' ? manualCurrentValue : null,
        manual_value_updated_at: pricingMode === 'manual_value' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }

      const { data: existingDef } = await supabase
        .from('portfolio_asset_definitions')
        .select('id')
        .eq('portfolio_id', portfolioId)
        .eq('ticker', upperTicker)
        .maybeSingle()

      if (existingDef) {
        const { error } = await supabase
          .from('portfolio_asset_definitions')
          .update(defPayload)
          .eq('id', existingDef.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('portfolio_asset_definitions')
          .insert(defPayload)
        if (error) throw error
      }

      const targetPct = parseFloat(targetPercentage)
      if (targetPct > 0) {
        const { data: existingTarget } = await supabase
          .from('target_allocations')
          .select('id')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', upperTicker)
          .maybeSingle()

        if (existingTarget) {
          const { error } = await supabase
            .from('target_allocations')
            .update({ target_percentage: targetPct })
            .eq('id', existingTarget.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('target_allocations')
            .insert({
              portfolio_id: portfolioId,
              ticker: upperTicker,
              target_percentage: targetPct
            })
          if (error) throw error
        }
      } else {
        await supabase
          .from('target_allocations')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('ticker', upperTicker)
      }

      toast.success(`Parâmetros de ${upperTicker} salvos!`)
      
      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_asset_definitions' }
      }))

      onSaved()
      onClose()
    } catch (err: unknown) {
      logger.error('[AssetConfigModal] Erro ao salvar:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar parametrização do ativo.')
    } finally {
      setLoading(false)
    }
  }

  const handlePricingChange = (e: { target: { value: string } }) => {
    const val = e.target.value
    if ((PRICING_MODES as string[]).includes(val)) {
      setPricingMode(val as PricingMode)
    }
  }

  const handleCurrencyChange = (e: { target: { value: string } }) => {
    const val = e.target.value
    if ((CURRENCIES as string[]).includes(val)) {
      setCurrency(val as Currency)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Parametrizar ${ticker.toUpperCase()}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4 text-left max-h-[80vh] overflow-y-auto custom-scrollbar pr-1">
        
        {/* Forma de Precificação */}
        <div className="space-y-1">
          <FieldLabel>Forma de Precificação</FieldLabel>
          <Select
            value={pricingMode}
            onChange={handlePricingChange}
            options={[
              { value: 'manual_value', label: 'Valor Manual do Ativo (Extrato)' },
              { value: 'market', label: 'Cotação de Mercado (B3 / Yahoo)' },
              { value: 'cash', label: 'Saldo em Caixa (Depósitos)' }
            ]}

          />
        </div>

        {/* Moeda e Alvo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel>Moeda Padrão</FieldLabel>
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
            <FieldLabel>Meta na Carteira (%)</FieldLabel>
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

        {/* Campos para Valor Manual */}
        {pricingMode === 'manual_value' && (
          <div className="space-y-1 p-3 bg-glass/5 rounded-2xl border border-glass/25 animate-fade-in">
            <FieldLabel>Valor Atual do Ativo (Moeda Local)</FieldLabel>
            <CurrencyInput
              value={manualCurrentValue}
              onChange={(_e, val) => setManualCurrentValue(val ?? 0)}
              placeholder="Ex: 50000.00"
              required
            />
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-3">
          <Button
            type="button"
            variant="link"
            onClick={onClose}
            className="flex-1 rounded-xl h-11"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="balance"
            disabled={loading}
            className="flex-1 rounded-xl h-11 font-black uppercase tracking-wider text-xs"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

      </form>
    </Modal>
  )
}
