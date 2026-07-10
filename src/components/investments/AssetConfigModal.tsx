import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/Modal'
import NumberInput from '@/components/NumberInput'
import CurrencyInput from '@/components/CurrencyInput'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Button from '@/components/Button'
import FieldLabel from '@/components/FieldLabel'
import SectionHeader from '@/components/SectionHeader'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { getAssetMetadata } from '@/utils/assetClassifier'
import { formatNumberWithTwoDecimalsBR, formatDateTime } from '@/utils/format'
import { AlertTriangle } from 'lucide-react'

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
  const [apiCache, setApiCache] = useState<any>(null)

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
  const [manualCurrentValue, setManualCurrentValue] = useState<number>(0)

  // Overrides manuais quantitativos
  const [manualRoic, setManualRoic] = useState<string>('')
  const [manualDividendYield, setManualDividendYield] = useState<string>('')
  const [manualPeRatio, setManualPeRatio] = useState<string>('')
  const [manualEvEbitda, setManualEvEbitda] = useState<string>('')
  const [manualNetDebtEbitda, setManualNetDebtEbitda] = useState<string>('')
  const [manualPe5yAverage, setManualPe5yAverage] = useState<string>('')
  const [manualEvEbitda5yAverage, setManualEvEbitda5yAverage] = useState<string>('')
  const [manualNetDebtTrendUp2y, setManualNetDebtTrendUp2y] = useState<boolean>(false)
  const [manualPVp, setManualPVp] = useState<string>('')
  const [manualVacancy, setManualVacancy] = useState<string>('')
  const [manualEtfFee, setManualEtfFee] = useState<string>('')
  const [manualEtfTrackingError, setManualEtfTrackingError] = useState<string>('')

  const meta = getAssetMetadata(ticker)
  const assetClass = meta.asset_class || ''
  
  const c = assetClass.trim().toUpperCase()
  const isStock = c.includes('AÇÃO') || c.includes('ACOES') || c.includes('AÇÕES') || c.includes('EQUITY') || c.includes('STOCK')
  const isFii = c.includes('FII') || c.includes('IMOBILIARIO') || c.includes('IMOBILIÁRIO') || c.includes('REAL ESTATE')
  const isEtf = c.includes('ETF')
  
  const showFundamentalsOverride = (isStock || isFii || isEtf) && pricingMode === 'market'

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
        setPricingMode(def.pricing_mode)
        setCurrency(def.currency || 'BRL')
        setIndexer(def.indexer)
        setIndexerPercent(String(def.indexer_percent ?? 100))
        setContractRate(String(def.contract_rate ?? 0))
        setMaturityDate(def.maturity_date ?? '')
        setApplicationDate(def.application_date ?? '')
        setManualCurrentValue(def.manual_current_value ?? 0)
        
        // Overrides
        setManualRoic(def.manual_roic != null ? String(def.manual_roic) : '')
        setManualDividendYield(def.manual_dividend_yield != null ? String(def.manual_dividend_yield) : '')
        setManualPeRatio(def.manual_pe_ratio != null ? String(def.manual_pe_ratio) : '')
        setManualEvEbitda(def.manual_ev_ebitda != null ? String(def.manual_ev_ebitda) : '')
        setManualNetDebtEbitda(def.manual_net_debt_ebitda != null ? String(def.manual_net_debt_ebitda) : '')
        setManualPe5yAverage(def.manual_pe_5y_average != null ? String(def.manual_pe_5y_average) : '')
        setManualEvEbitda5yAverage(def.manual_ev_ebitda_5y_average != null ? String(def.manual_ev_ebitda_5y_average) : '')
        setManualNetDebtTrendUp2y(!!def.manual_net_debt_trend_up_2y)
        setManualPVp(def.manual_p_vp != null ? String(def.manual_p_vp) : '')
        setManualVacancy(def.manual_vacancy != null ? String(def.manual_vacancy) : '')
        setManualEtfFee(def.manual_etf_fee != null ? String(def.manual_etf_fee) : '')
        setManualEtfTrackingError(def.manual_etf_tracking_error != null ? String(def.manual_etf_tracking_error) : '')
      } else {
        // Resetar para valores padrão
        setPricingMode('market')
        setCurrency('BRL')
        setIndexer('none')
        setIndexerPercent('100')
        setContractRate('0')
        setMaturityDate('')
        setApplicationDate('')
        setManualCurrentValue(0)

        // Overrides reset
        setManualRoic('')
        setManualDividendYield('')
        setManualPeRatio('')
        setManualEvEbitda('')
        setManualNetDebtEbitda('')
        setManualPe5yAverage('')
        setManualEvEbitda5yAverage('')
        setManualNetDebtTrendUp2y(false)
        setManualPVp('')
        setManualVacancy('')
        setManualEtfFee('')
        setManualEtfTrackingError('')
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

      // 3. Carregar cache da API
      const { data: cache } = await supabase
        .from('asset_fundamentals_cache')
        .select('*')
        .eq('ticker', ticker.toUpperCase())
        .maybeSingle()

      setApiCache(cache)

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

  const renderCompareWarning = (
    manualVal: string,
    apiVal: number | null | undefined,
    onReset: () => void,
    isPercentage = false
  ) => {
    if (!manualVal || apiVal == null) return null
    
    const numManual = parseFloat(manualVal)
    if (isNaN(numManual)) return null
    const numApi = apiVal
    
    if (Math.abs(numManual - numApi) > 0.01) {
      return (
        <div className="text-[8px] text-warning font-black mt-1 flex items-center justify-between bg-warning/10 p-1 px-1.5 rounded-lg border border-warning/20 animate-pulse">
          <span><AlertTriangle size={10} className="inline-block align-text-top mr-0.5 text-warning" /> Contrasta com a API ({formatNumberWithTwoDecimalsBR(apiVal)}{isPercentage ? '%' : ''})</span>
          <button 
            type="button" 
            onClick={onReset} 
            className="text-brand hover:text-brand-strong font-black uppercase tracking-widest text-[8px]"
          >
            Usar API
          </button>
        </div>
      )
    }
    return (
      <div className="text-[8px] text-income font-black mt-1 block">
        ✓ Alinhado com a API ({formatNumberWithTwoDecimalsBR(apiVal)}{isPercentage ? '%' : ''})
      </div>
    )
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
        manual_current_value: pricingMode === 'manual_value' ? manualCurrentValue : null,
        manual_value_updated_at: pricingMode === 'manual_value' ? new Date().toISOString() : null,
        
        // Overrides
        manual_roic: manualRoic ? parseFloat(manualRoic) : null,
        manual_dividend_yield: manualDividendYield ? parseFloat(manualDividendYield) : null,
        manual_pe_ratio: manualPeRatio ? parseFloat(manualPeRatio) : null,
        manual_ev_ebitda: manualEvEbitda ? parseFloat(manualEvEbitda) : null,
        manual_net_debt_ebitda: manualNetDebtEbitda ? parseFloat(manualNetDebtEbitda) : null,
        manual_pe_5y_average: manualPe5yAverage ? parseFloat(manualPe5yAverage) : null,
        manual_ev_ebitda_5y_average: manualEvEbitda5yAverage ? parseFloat(manualEvEbitda5yAverage) : null,
        manual_net_debt_trend_up_2y: manualNetDebtTrendUp2y,
        manual_p_vp: manualPVp ? parseFloat(manualPVp) : null,
        manual_vacancy: manualVacancy ? parseFloat(manualVacancy) : null,
        manual_etf_fee: manualEtfFee ? parseFloat(manualEtfFee) : null,
        manual_etf_tracking_error: manualEtfTrackingError ? parseFloat(manualEtfTrackingError) : null,
        
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
    } catch (err: unknown) {
      logger.error('[AssetConfigModal] Erro ao salvar:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar parametrização do ativo.')
    } finally {
      setLoading(false)
    }
  }

  type PricingMode = 'market' | 'fixed_income' | 'manual_value' | 'cash'
  type Currency = 'BRL' | 'USD'
  type Indexer = 'none' | 'cdi' | 'selic' | 'ipca'

  const PRICING_MODES: PricingMode[] = ['market', 'fixed_income', 'manual_value', 'cash']
  const CURRENCIES: Currency[] = ['BRL', 'USD']
  const INDEXERS: Indexer[] = ['none', 'cdi', 'selic', 'ipca']

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

  const handleIndexerChange = (e: { target: { value: string } }) => {
    const val = e.target.value
    if ((INDEXERS as string[]).includes(val)) {
      setIndexer(val as Indexer)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Parametrizar ${ticker.toUpperCase()}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        
        {/* Método de Precificação */}
        <div className="space-y-1">
          <FieldLabel>Forma de Precificação</FieldLabel>
          <Select
            value={pricingMode}
            onChange={handlePricingChange}
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
            <FieldLabel>Alvo na Carteira (%)</FieldLabel>
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
                <FieldLabel>Indexador</FieldLabel>
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
                <FieldLabel>% do Indexador</FieldLabel>
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
              <FieldLabel>Taxa Contratada a.a. (%)</FieldLabel>
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
                <FieldLabel>Data de Aporte</FieldLabel>
                <Input
                  type="date"
                  value={applicationDate}
                  onChange={(e) => setApplicationDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Vencimento</FieldLabel>
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
            <FieldLabel>Valor Atual do Ativo (Moeda Local)</FieldLabel>
            <CurrencyInput
              value={manualCurrentValue}
              onChange={(_e, val) => setManualCurrentValue(val)}
              placeholder="Ex: 50000.00"
              required
            />
          </div>
        )}

        {/* Overrides de Fundamentos para Renda Variável */}
        {showFundamentalsOverride && (
          <div className="space-y-4 p-4 bg-glass/5 rounded-2xl border border-glass/25 animate-fade-in">
            <SectionHeader as="h4" bordered>
              Overrides de Indicadores (Fundamentalistas)
            </SectionHeader>
            <div className="flex flex-col gap-1.5 bg-glass/2 p-2 rounded-xl">
              <p className="text-[9px] text-muted leading-relaxed">
                Use estes campos se desejar sobrescrever os dados vindos da API pública (Yahoo Finance) ou preencher dados não encontrados automaticamente.
              </p>
              {apiCache?.last_updated ? (
                <div className="text-[8px] font-black text-income uppercase tracking-wider bg-income/10 px-2.5 py-1 rounded-lg w-fit">
                  Sincronizado automaticamente via API em: {formatDateTime(apiCache.last_updated)}
                </div>
              ) : (
                <div className="text-[8px] font-black text-warning uppercase tracking-wider bg-warning/10 px-2.5 py-1 rounded-lg w-fit">
                  Sem dados automáticos da API. Recomenda-se preenchimento manual dos overrides abaixo.
                </div>
              )}
            </div>
            
            {isStock && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>ROIC (%)</span>
                      {manualRoic && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualRoic} onChange={(e) => setManualRoic(e.target.value)} placeholder="API" suffix="%" hideSpinButtons />
                    {renderCompareWarning(manualRoic, apiCache?.roic, () => setManualRoic(''), true)}
                  </div>
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Dividend Yield (%)</span>
                      {manualDividendYield && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualDividendYield} onChange={(e) => setManualDividendYield(e.target.value)} placeholder="API" suffix="%" hideSpinButtons />
                    {renderCompareWarning(manualDividendYield, apiCache?.dividend_yield, () => setManualDividendYield(''), true)}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>P/L Atual</span>
                      {manualPeRatio && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualPeRatio} onChange={(e) => setManualPeRatio(e.target.value)} placeholder="API" hideSpinButtons />
                    {renderCompareWarning(manualPeRatio, apiCache?.pe_ratio, () => setManualPeRatio(''))}
                  </div>
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>EV/EBITDA</span>
                      {manualEvEbitda && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualEvEbitda} onChange={(e) => setManualEvEbitda(e.target.value)} placeholder="API" hideSpinButtons />
                    {renderCompareWarning(manualEvEbitda, apiCache?.ev_ebitda, () => setManualEvEbitda(''))}
                  </div>
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Dív. Líq / EBITDA</span>
                      {manualNetDebtEbitda && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualNetDebtEbitda} onChange={(e) => setManualNetDebtEbitda(e.target.value)} placeholder="API" hideSpinButtons />
                    {renderCompareWarning(manualNetDebtEbitda, apiCache?.net_debt_ebitda, () => setManualNetDebtEbitda(''))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Média P/L 5 anos</span>
                      {manualPe5yAverage && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualPe5yAverage} onChange={(e) => setManualPe5yAverage(e.target.value)} placeholder="Ex: 12.5" hideSpinButtons />
                    {renderCompareWarning(manualPe5yAverage, apiCache?.pe_5y_average, () => setManualPe5yAverage(''))}
                  </div>
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Média EV/EBITDA 5a</span>
                      {manualEvEbitda5yAverage && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualEvEbitda5yAverage} onChange={(e) => setManualEvEbitda5yAverage(e.target.value)} placeholder="Ex: 8.0" hideSpinButtons />
                    {renderCompareWarning(manualEvEbitda5yAverage, apiCache?.ev_ebitda_5y_average, () => setManualEvEbitda5yAverage(''))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="net_debt_trend"
                    checked={manualNetDebtTrendUp2y}
                    onChange={(e) => setManualNetDebtTrendUp2y(e.target.checked)}
                    className="w-3.5 h-3.5 accent-brand rounded border-glass cursor-pointer"
                  />
                  <label htmlFor="net_debt_trend" className="text-[9px] font-bold text-secondary cursor-pointer select-none">
                    Tendência de Endividamento Cresceu nos Últimos 2 anos?
                  </label>
                </div>
              </div>
            )}

            {isFii && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Dividend Yield (%)</span>
                      {manualDividendYield && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualDividendYield} onChange={(e) => setManualDividendYield(e.target.value)} placeholder="API" suffix="%" hideSpinButtons />
                    {renderCompareWarning(manualDividendYield, apiCache?.dividend_yield, () => setManualDividendYield(''), true)}
                  </div>
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>P/VP</span>
                      {manualPVp && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.01} value={manualPVp} onChange={(e) => setManualPVp(e.target.value)} placeholder="Ex: 1.00" hideSpinButtons />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Vacância Física (%)</span>
                      {manualVacancy && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.1} value={manualVacancy} onChange={(e) => setManualVacancy(e.target.value)} placeholder="Ex: 5.0" suffix="%" hideSpinButtons />
                  </div>
                </div>
              </div>
            )}

            {isEtf && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Taxa Adm. (%)</span>
                      {manualEtfFee && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.01} value={manualEtfFee} onChange={(e) => setManualEtfFee(e.target.value)} placeholder="Ex: 0.30" suffix="%" hideSpinButtons />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel size="sm" className="flex justify-between">
                      <span>Tracking Error (%)</span>
                      {manualEtfTrackingError && <span className="text-brand font-black text-[7px] uppercase tracking-wider">Manual</span>}
                    </FieldLabel>
                    <NumberInput step={0.01} value={manualEtfTrackingError} onChange={(e) => setManualEtfTrackingError(e.target.value)} placeholder="Ex: 1.50" suffix="%" hideSpinButtons />
                  </div>
                </div>
              </div>
            )}
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
