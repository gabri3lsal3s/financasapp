import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Checkbox from '@/components/Checkbox'
import { supabase } from '@/lib/supabase'
import { isB3TickerPattern, searchB3Assets, detectDefaultCurrency } from '@/services/priceService'
import type { PortfolioAssetDefinition, PortfolioPricingMode, PortfolioAssetIndexer } from '@/types'
import toast from 'react-hot-toast'

interface AssetDefinitionFormModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  ticker: string
  existing?: PortfolioAssetDefinition | null
  onSaved: () => void
}

const INDEXER_OPTIONS: { value: PortfolioAssetIndexer; label: string }[] = [
  { value: 'none', label: 'Pré-fixado (taxa contratada)' },
  { value: 'cdi', label: 'CDI' },
  { value: 'selic', label: 'SELIC' },
  { value: 'ipca', label: 'IPCA' },
]

type AssetCategory = 'variable' | 'fixed_or_other'
type FixedSubtype = 'fixed_income_standard' | 'treasury' | 'manual' | 'cash'

export default function AssetDefinitionFormModal({
  isOpen,
  onClose,
  portfolioId,
  ticker,
  existing,
  onSaved,
}: AssetDefinitionFormModalProps) {
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('variable')
  const [fixedSubtype, setFixedSubtype] = useState<FixedSubtype>('fixed_income_standard')
  
  const [pricingMode, setPricingMode] = useState<PortfolioPricingMode>('market')
  const [isB3Linked, setIsB3Linked] = useState(true)
  const [isTreasury, setIsTreasury] = useState(false)
  const [appliedAmount, setAppliedAmount] = useState('')
  const [contractRate, setContractRate] = useState('')
  const [indexer, setIndexer] = useState<PortfolioAssetIndexer>('none')
  const [indexerPercent, setIndexerPercent] = useState('100')
  const [maturityDate, setMaturityDate] = useState('')
  const [applicationDate, setApplicationDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [manualCurrentValue, setManualCurrentValue] = useState('')
  const [taxExempt, setTaxExempt] = useState(false)
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [assetTicker, setAssetTicker] = useState(ticker)
  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [targetPct, setTargetPct] = useState('')

  const upperTicker = assetTicker.trim().toUpperCase()
  const isB3Variable = isB3TickerPattern(upperTicker) && !upperTicker.includes('TESOURO')
  const isFixedIncomePrefix = upperTicker.startsWith('CDB') || upperTicker.startsWith('LCI') || upperTicker.startsWith('LCA') || upperTicker.startsWith('CRI') || upperTicker.startsWith('CRA') || upperTicker.includes('TESOURO') || upperTicker.includes('DEBENTURE') || upperTicker.includes('DEBÊNTURE') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(upperTicker)
  const isCashType = ['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA', 'SALDO'].includes(upperTicker)

  // Re-classify dynamically as the user types
  useEffect(() => {
    const t = assetTicker.trim().toUpperCase()
    if (!t) return

    const isB3 = isB3TickerPattern(t) && !t.includes('TESOURO')
    const isFixed = t.startsWith('CDB') || t.startsWith('LCI') || t.startsWith('LCA') || t.startsWith('CRI') || t.startsWith('CRA') || t.includes('TESOURO') || t.includes('DEBENTURE') || t.includes('DEBÊNTURE') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(t)
    const isCash = ['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA', 'SALDO'].includes(t)

    if (isB3) {
      setAssetCategory('variable')
    } else if (isFixed) {
      setAssetCategory('fixed_or_other')
      if (t.includes('TESOURO') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(t)) {
        setFixedSubtype('treasury')
      } else {
        setFixedSubtype('fixed_income_standard')
      }
    } else if (isCash) {
      setAssetCategory('fixed_or_other')
      setFixedSubtype('cash')
    }
  }, [assetTicker])

  // Map sub-type selection to pricing mode and treasury flags
  useEffect(() => {
    if (assetCategory === 'variable') {
      setPricingMode('market')
      setIsTreasury(false)
      setIsB3Linked(true)
    } else {
      setIsB3Linked(false)
      if (fixedSubtype === 'fixed_income_standard') {
        setPricingMode('fixed_income')
        setIsTreasury(false)
      } else if (fixedSubtype === 'treasury') {
        setPricingMode('fixed_income')
        setIsTreasury(true)
      } else if (fixedSubtype === 'manual') {
        setPricingMode('manual_value')
        setIsTreasury(false)
      } else if (fixedSubtype === 'cash') {
        setPricingMode('cash')
        setIsTreasury(false)
      }
    }
  }, [assetCategory, fixedSubtype])

  useEffect(() => {
    if (!isOpen) return
    const upper = ticker.toUpperCase()
    setAssetTicker(upper)

    const fetchTargetAndSetStates = async () => {
      try {
        const { data, error } = await supabase
          .from('target_allocations')
          .select('target_percentage')
          .eq('portfolio_id', portfolioId)
          .eq('ticker', upper)
          .maybeSingle()
        if (!error && data) {
          setTargetPct(String(data.target_percentage))
        } else {
          setTargetPct('')
        }
      } catch (err) {
        console.error('Erro ao carregar meta de alocação:', err)
        setTargetPct('')
      }

      if (existing) {
        setPricingMode(existing.pricing_mode)
        setIsB3Linked(existing.is_b3_linked)
        setIsTreasury(existing.is_treasury)
        setAppliedAmount(existing.applied_amount != null ? String(existing.applied_amount) : '')
        setContractRate(existing.contract_rate != null ? String(existing.contract_rate) : '')
        setIndexer(existing.indexer)
        setIndexerPercent(String(existing.indexer_percent))
        setMaturityDate(existing.maturity_date ?? '')
        setApplicationDate(existing.application_date ?? format(new Date(), 'yyyy-MM-dd'))
        setManualCurrentValue(existing.manual_current_value != null ? String(existing.manual_current_value) : '')
        setTaxExempt(existing.tax_exempt)
        setCurrency(existing.currency || detectDefaultCurrency(upper))

        // Classify loaded asset category & subtype
        if (existing.pricing_mode === 'market' && !existing.is_treasury) {
          setAssetCategory('variable')
        } else {
          setAssetCategory('fixed_or_other')
          if (existing.is_treasury) {
            setFixedSubtype('treasury')
          } else if (existing.pricing_mode === 'fixed_income') {
            setFixedSubtype('fixed_income_standard')
          } else if (existing.pricing_mode === 'manual_value') {
            setFixedSubtype('manual')
          } else if (existing.pricing_mode === 'cash') {
            setFixedSubtype('cash')
          }
        }
      } else {
        const isB3 = isB3TickerPattern(upper)
        const isTreasuryAsset = upper.includes('TESOURO') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(upper)
        
        if (isB3 && !isTreasuryAsset) {
          setAssetCategory('variable')
          setPricingMode('market')
          setIsB3Linked(true)
          setIsTreasury(false)
        } else {
          setAssetCategory('fixed_or_other')
          if (isTreasuryAsset) {
            setFixedSubtype('treasury')
          } else if (upper.startsWith('CDB') || upper.startsWith('LCI') || upper.startsWith('LCA') || upper.startsWith('CRI') || upper.startsWith('CRA')) {
            setFixedSubtype('fixed_income_standard')
          } else {
            setFixedSubtype('manual')
          }
        }

        setAppliedAmount('')
        setContractRate('')
        setIndexer('none')
        setIndexerPercent('100')
        setMaturityDate('')
        setApplicationDate(format(new Date(), 'yyyy-MM-dd'))
        setManualCurrentValue('')
        setTaxExempt(false)
        setCurrency(detectDefaultCurrency(upper))
      }
    }

    fetchTargetAndSetStates()
  }, [isOpen, ticker, existing, portfolioId])

  const handleTickerSearch = async (value: string) => {
    setAssetTicker(value.toUpperCase())
    if (assetCategory === 'variable' && value.length >= 2) {
      const results = await searchB3Assets(value)
      setSuggestions(results)
    } else {
      setSuggestions([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normTicker = assetTicker.trim().toUpperCase()
    if (!normTicker) {
      toast.error('Informe o ticker ou nome do ativo.')
      return
    }

    if (pricingMode === 'fixed_income' && (!appliedAmount || !applicationDate)) {
      toast.error('Informe o valor aplicado e data da aplicação para renda fixa.')
      return
    }

    if (pricingMode === 'manual_value' && (!appliedAmount || !manualCurrentValue || !applicationDate)) {
      toast.error('Informe valor aplicado, valor atual e data de aquisição para ativos manuais.')
      return
    }

    if (pricingMode === 'cash' && !applicationDate) {
      toast.error('Informe a data da aplicação/início para o saldo em caixa.')
      return
    }

    setSaving(true)
    try {
      const isFixedOrTreasury = pricingMode === 'fixed_income' || isTreasury || normTicker.includes('TESOURO') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(normTicker)
      const isTr = isTreasury || normTicker.includes('TESOURO') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(normTicker)
      const payload = {
        portfolio_id: portfolioId,
        ticker: normTicker,
        pricing_mode: pricingMode,
        is_b3_linked: pricingMode === 'market' ? isB3Linked : false,
        applied_amount:
          pricingMode === 'market' || pricingMode === 'cash' ? null : appliedAmount ? Number(appliedAmount) : null,
        contract_rate: isFixedOrTreasury && contractRate ? Number(contractRate) : null,
        indexer: isFixedOrTreasury ? indexer : 'none',
        indexer_percent: isFixedOrTreasury ? (Number(indexerPercent) || 100) : 100,
        maturity_date: isFixedOrTreasury ? (maturityDate || null) : null,
        application_date: pricingMode === 'market' ? null : (applicationDate || null),
        manual_current_value: pricingMode === 'manual_value' ? (manualCurrentValue ? Number(manualCurrentValue) : null) : null,
        manual_value_updated_at: pricingMode === 'manual_value' && manualCurrentValue ? new Date().toISOString() : null,
        tax_exempt: pricingMode === 'fixed_income' ? taxExempt : false,
        is_treasury: isTr,
        currency: currency,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('portfolio_asset_definitions')
        .upsert(payload, { onConflict: 'portfolio_id,ticker' })

      if (error) throw error

      // Salvar a meta de alocação (target_allocations)
      const pct = parseFloat(targetPct)
      if (!isNaN(pct) && pct > 0) {
        const { error: targetError } = await supabase
          .from('target_allocations')
          .upsert({
            portfolio_id: portfolioId,
            ticker: normTicker,
            target_percentage: pct
          }, { onConflict: 'portfolio_id,ticker' })
        if (targetError) throw targetError
      } else {
        await supabase
          .from('target_allocations')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('ticker', normTicker)
      }

      toast.success('Configuração do ativo salva.')
      onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível salvar a configuração do ativo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configurar ativo ${assetTicker || ''}`}
      maxWidth="max-w-lg"
    >
      {/* Categoria Principal: Renda Variável vs Renda Fixa com travas reativas */}
      <div className="flex bg-secondary/50 border border-primary p-1 rounded-xl mb-3">
        <button
          type="button"
          disabled={isFixedIncomePrefix || isCashType}
          onClick={() => setAssetCategory('variable')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
            assetCategory === 'variable'
              ? 'bg-primary text-primary shadow-md font-bold'
              : 'text-secondary hover:text-primary'
          } ${(isFixedIncomePrefix || isCashType) ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Renda Variável (Ações / FIIs)
        </button>
        <button
          type="button"
          disabled={isB3Variable}
          onClick={() => setAssetCategory('fixed_or_other')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
            assetCategory === 'fixed_or_other'
              ? 'bg-primary text-primary shadow-md font-bold'
              : 'text-secondary hover:text-primary'
          } ${isB3Variable ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Renda Fixa & Outros
        </button>
      </div>

      {/* Badges de classificação inteligente */}
      {isB3Variable && (
        <div className="mb-4 p-2.5 bg-balance/10 border border-balance/20 text-balance text-xs rounded-xl flex items-center justify-between font-medium animate-page-enter">
          <span>📈 Ativo de Renda Variável Detectado (B3)</span>
          <span className="text-[10px] bg-balance/20 px-2 py-0.5 rounded-full font-bold uppercase">Mercado</span>
        </div>
      )}
      {isFixedIncomePrefix && (
        <div className="mb-4 p-2.5 bg-warning/10 border border-warning/20 text-warning text-xs rounded-xl flex items-center justify-between font-medium animate-page-enter">
          <span>💰 Ativo de Renda Fixa Detectado</span>
          <span className="text-[10px] bg-warning/20 px-2 py-0.5 rounded-full font-bold uppercase">{upperTicker.includes('TESOURO') ? 'Tesouro Direto' : 'Renda Fixa'}</span>
        </div>
      )}
      {isCashType && (
        <div className="mb-4 p-2.5 bg-income/10 border border-income/20 text-income text-xs rounded-xl flex items-center justify-between font-medium animate-page-enter">
          <span>🏦 Saldo em Caixa Detectado</span>
          <span className="text-[10px] bg-income/20 px-2 py-0.5 rounded-full font-bold uppercase">Caixa</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Moeda de Precificação"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as 'BRL' | 'USD')}
          options={[
            { value: 'BRL', label: 'BRL - Real Brasileiro (R$)' },
            { value: 'USD', label: 'USD - Dólar Americano ($)' },
          ]}
          className="rounded-xl font-semibold text-sm"
        />

        {assetCategory === 'variable' ? (
          <div className="space-y-4 animate-page-enter">
            <div className="relative">
              <Input
                label="Ticker / Símbolo"
                value={assetTicker}
                onChange={(e) => handleTickerSearch(e.target.value)}
                placeholder="Ex: WEGE3, MXRF11, BOVA11"
                className="uppercase font-semibold tracking-wider"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-[1001] w-full mt-1 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-border/40 animate-page-enter">
                  {suggestions.slice(0, 6).map((s) => (
                    <button
                      key={s.ticker}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Impede o blur do input
                        setAssetTicker(s.ticker)
                        setIsB3Linked(isB3TickerPattern(s.ticker))
                        setSuggestions([])
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-balance/10 text-primary flex items-center justify-between transition-colors"
                    >
                      <span className="font-bold text-sm text-primary tracking-wide">{s.ticker}</span>
                      <span className="text-[10px] text-secondary font-medium truncate max-w-[180px]">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3.5 bg-secondary/30 border border-primary/40 rounded-2xl">
              <Checkbox
                label="Vinculado à B3"
                description="Sincroniza a cotação do ativo automaticamente a mercado"
                checked={isB3Linked}
                onChange={(e) => setIsB3Linked(e.target.checked)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-page-enter">
            <Select
              label="Tipo de Ativo"
              value={fixedSubtype}
              onChange={(e) => setFixedSubtype(e.target.value as FixedSubtype)}
              options={[
                { value: 'fixed_income_standard', label: 'Renda Fixa / Tesouro (CDB, LCI, LCA, CRI, CRA, Debêntures, Tesouro)' },
                { value: 'manual', label: 'Rentabilidade Manual (Outros ativos)' },
                { value: 'cash', label: 'Saldo em Caixa (Sem rentabilidade)' },
              ]}
              className="rounded-xl font-semibold"
            />
            
            <Input
              label={fixedSubtype === 'cash' ? 'Identificador do Caixa' : 'Identificador / Nome do Ativo'}
              value={assetTicker}
              onChange={(e) => setAssetTicker(e.target.value.toUpperCase())}
              placeholder={
                fixedSubtype === 'fixed_income_standard'
                  ? 'Ex: CDB BANCO INTER 110% CDI'
                  : fixedSubtype === 'cash'
                  ? 'Ex: CAIXA PRINCIPAL'
                  : 'Ex: MINHA STARTUP / IMOVEL X'
              }
              className="font-semibold rounded-xl"
            />
          </div>
        )}

        {pricingMode === 'cash' && (
          <p className="text-xs text-secondary bg-balance/5 border border-balance/10 rounded-2xl p-3.5 font-sans leading-relaxed animate-page-enter font-medium">
            Saldo em caixa não possui rentabilidade — o valor acompanha apenas as movimentações manuais de entrada e saída.
          </p>
        )}

        {pricingMode !== 'cash' && assetCategory !== 'variable' && (
          <Input
            label="Valor aplicado / Investido original (R$)"
            type="number"
            step="0.01"
            required
            value={appliedAmount}
            onChange={(e) => setAppliedAmount(e.target.value)}
            placeholder="Ex: 10000"
            className="font-semibold rounded-xl text-sm"
          />
        )}

        {assetCategory !== 'variable' && (
          <Input
            label="Data da aplicação / Aquisição"
            type="date"
            required
            value={applicationDate}
            onChange={(e) => setApplicationDate(e.target.value)}
            className="font-semibold rounded-xl text-sm"
          />
        )}

        {pricingMode === 'fixed_income' && (
          <div className="p-3.5 bg-secondary/30 border border-primary/40 rounded-2xl space-y-4 animate-page-enter">
            <Select
              label="Indexador"
              value={indexer}
              onChange={(e) => setIndexer(e.target.value as PortfolioAssetIndexer)}
              options={INDEXER_OPTIONS}
              className="rounded-xl font-semibold"
            />
            {indexer !== 'none' && (
              <Input
                label="% do indexador"
                type="number"
                step="0.01"
                value={indexerPercent}
                onChange={(e) => setIndexerPercent(e.target.value)}
                className="font-semibold rounded-xl text-sm"
              />
            )}
            {indexer === 'none' && (
              <Input
                label="Taxa contratada (% a.a.)"
                type="number"
                step="0.01"
                value={contractRate}
                onChange={(e) => setContractRate(e.target.value)}
                className="font-semibold rounded-xl text-sm"
              />
            )}
            <Input
              label="Data de Vencimento"
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
              className="font-semibold rounded-xl text-sm"
            />
            {fixedSubtype === 'fixed_income_standard' && (
              <Checkbox
                label="Isento de Imposto de Renda"
                description="LCI, LCA, CRI, CRA são isentos de IR (não aplica tabela regressiva)"
                checked={taxExempt}
                onChange={(e) => setTaxExempt(e.target.checked)}
              />
            )}
          </div>
        )}

        {pricingMode === 'manual_value' && (
          <div className="p-3.5 bg-secondary/30 border border-primary/40 rounded-2xl animate-page-enter">
            <Input
              label="Valor atual estimado / Último saldo (R$)"
              type="number"
              step="0.01"
              required
              value={manualCurrentValue}
              onChange={(e) => setManualCurrentValue(e.target.value)}
              placeholder="Ex: 12500"
              className="font-semibold rounded-xl text-sm"
            />
          </div>
        )}

        <div className="pt-3 border-t border-primary/20">
          <Input
            label="Meta de Alocação Ideal no Portfólio (%)"
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="Ex: 15"
            value={targetPct}
            onChange={(e) => setTargetPct(e.target.value)}
            className="text-sm font-semibold font-mono rounded-xl text-sm"
          />
        </div>

        <p className="text-[10px] text-secondary leading-relaxed opacity-85">
          A rentabilidade líquida estimada utiliza a tabela regressiva de IR para renda fixa, 15% de ganho de capital para mercado/outros, exceto se marcado como isento.
        </p>

        <ModalActionFooter onCancel={onClose} submitLabel="Salvar" submitDisabled={saving} />
      </form>
    </Modal>
  )
}
