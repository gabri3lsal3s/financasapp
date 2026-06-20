import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Button from '@/components/Button'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

interface AssetConfigModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  ticker: string
  onSaved: () => void
}

export default function AssetConfigModal({
  isOpen,
  onClose,
  portfolioId,
  ticker,
  onSaved
}: AssetConfigModalProps) {
  const [loading, setLoading] = useState(false)

  // Campos do formulário
  const [pricingMode, setPricingMode] = useState<'market' | 'fixed_income' | 'manual_value' | 'cash'>('market')
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [targetPercentage, setTargetPercentage] = useState<string>('0')

  // Renda Fixa específicos
  const [indexer, setIndexer] = useState<'none' | 'cdi' | 'selic' | 'ipca'>('none')
  const [indexerPercent, setIndexerPercent] = useState<string>('100')
  const [contractRate, setContractRate] = useState<string>('0')
  const [maturityDate, setMaturityDate] = useState<string>('')
  const [applicationDate, setApplicationDate] = useState<string>('')

  // Valor Manual específicos
  const [manualCurrentValue, setManualCurrentValue] = useState<string>('0')

  useEffect(() => {
    if (isOpen && ticker && portfolioId) {
      void loadConfig()
    }
  }, [isOpen, ticker, portfolioId])

  const loadConfig = async () => {
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
        setPricingMode(def.pricing_mode)
        setCurrency(def.currency || 'BRL')
        setIndexer(def.indexer)
        setIndexerPercent(String(def.indexer_percent ?? 100))
        setContractRate(String(def.contract_rate ?? 0))
        setMaturityDate(def.maturity_date ?? '')
        setApplicationDate(def.application_date ?? '')
        setManualCurrentValue(String(def.manual_current_value ?? 0))
      } else {
        // Resetar para valores padrão
        setPricingMode('market')
        setCurrency('BRL')
        setIndexer('none')
        setIndexerPercent('100')
        setContractRate('0')
        setMaturityDate('')
        setApplicationDate('')
        setManualCurrentValue('0')
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
      console.error('[AssetConfigModal] Erro ao carregar configurações:', err)
      toast.error('Erro ao carregar configurações do ativo.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const upperTicker = ticker.toUpperCase().trim()

      // 1. Salvar ou atualizar definição do ativo
      const defPayload = {
        portfolio_id: portfolioId,
        ticker: upperTicker,
        pricing_mode: pricingMode,
        currency: currency,
        indexer: pricingMode === 'fixed_income' ? indexer : 'none',
        indexer_percent: pricingMode === 'fixed_income' ? parseFloat(indexerPercent) : 100,
        contract_rate: pricingMode === 'fixed_income' ? parseFloat(contractRate) : 0,
        maturity_date: pricingMode === 'fixed_income' && maturityDate ? maturityDate : null,
        application_date: pricingMode === 'fixed_income' && applicationDate ? applicationDate : null,
        manual_current_value: pricingMode === 'manual_value' ? parseFloat(manualCurrentValue) : null,
        manual_value_updated_at: pricingMode === 'manual_value' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }

      // Buscar se definição já existe para decidir se é insert ou update
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

      // 2. Salvar ou atualizar alocação alvo
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
        // Se for zero, podemos remover o alvo
        await supabase
          .from('target_allocations')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('ticker', upperTicker)
      }

      toast.success(`Parâmetros de ${upperTicker} salvos!`)
      
      // Disparar evento local
      window.dispatchEvent(new CustomEvent('local-data-changed', {
        detail: { entity: 'portfolio_asset_definitions' }
      }))

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('[AssetConfigModal] Erro ao salvar:', err)
      toast.error(err.message || 'Erro ao salvar parametrização do ativo.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden bg-glass/95 border border-glass rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-glass/40">
          <div>
            <h3 className="text-base font-black text-primary uppercase tracking-wider">Parametrizar Ativo</h3>
            <p className="text-[10px] text-secondary font-bold font-mono">Ticker: {ticker.toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-glass/10 flex items-center justify-center text-secondary hover:text-primary transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          
          {/* Método de Precificação */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-black text-secondary">Forma de Precificação</label>
            <Select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as any)}
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
                onChange={(e) => setCurrency(e.target.value as any)}
                options={[
                  { value: 'BRL', label: 'BRL (R$)' },
                  { value: 'USD', label: 'USD ($)' }
                ]}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-black text-secondary">Alvo na Carteira (%)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={targetPercentage}
                onChange={(e) => setTargetPercentage(e.target.value)}
                placeholder="Ex: 5.5"
                required
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
                    onChange={(e) => setIndexer(e.target.value as any)}
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
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={indexerPercent}
                    onChange={(e) => setIndexerPercent(e.target.value)}
                    placeholder="Ex: 100"
                    disabled={indexer === 'none'}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-secondary">Taxa Contratada a.a. (%)</label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={contractRate}
                  onChange={(e) => setContractRate(e.target.value)}
                  placeholder="Ex: 6.5"
                  required
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
              <Input
                type="number"
                step="0.01"
                min="0"
                value={manualCurrentValue}
                onChange={(e) => setManualCurrentValue(e.target.value)}
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
      </div>
    </div>
  )
}
