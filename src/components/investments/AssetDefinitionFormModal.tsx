import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Checkbox from '@/components/Checkbox'
import { supabase } from '@/lib/supabase'
import { isB3TickerPattern, searchB3Assets } from '@/services/priceService'
import type { PortfolioAssetDefinition, PortfolioPricingMode, PortfolioAssetIndexer } from '@/types'
import { PORTFOLIO_PRICING_MODE_OPTIONS } from '@/constants/portfolioPricingMode'
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

export default function AssetDefinitionFormModal({
  isOpen,
  onClose,
  portfolioId,
  ticker,
  existing,
  onSaved,
}: AssetDefinitionFormModalProps) {
  const [pricingMode, setPricingMode] = useState<PortfolioPricingMode>('market')
  const [isB3Linked, setIsB3Linked] = useState(false)
  const [isTreasury, setIsTreasury] = useState(false)
  const [appliedAmount, setAppliedAmount] = useState('')
  const [contractRate, setContractRate] = useState('')
  const [indexer, setIndexer] = useState<PortfolioAssetIndexer>('none')
  const [indexerPercent, setIndexerPercent] = useState('100')
  const [maturityDate, setMaturityDate] = useState('')
  const [applicationDate, setApplicationDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [manualCurrentValue, setManualCurrentValue] = useState('')
  const [taxExempt, setTaxExempt] = useState(false)
  const [assetTicker, setAssetTicker] = useState(ticker)
  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [targetPct, setTargetPct] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const upper = ticker.toUpperCase()
    setAssetTicker(upper)

    const fetchTargetAndSetStates = async () => {
      // Carregar meta existente
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
      } else {
        setPricingMode('market')
        setIsB3Linked(isB3TickerPattern(upper))
        setIsTreasury(upper.includes('TESOURO'))
        setAppliedAmount('')
        setContractRate('')
        setIndexer('none')
        setIndexerPercent('100')
        setMaturityDate('')
        setApplicationDate(format(new Date(), 'yyyy-MM-dd'))
        setManualCurrentValue('')
        setTaxExempt(false)
      }
    }

    fetchTargetAndSetStates()
  }, [isOpen, ticker, existing, portfolioId])

  const handleTickerSearch = async (value: string) => {
    setAssetTicker(value.toUpperCase())
    if (pricingMode === 'market' && value.length >= 2) {
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

    if (pricingMode === 'fixed_income' && !appliedAmount) {
      toast.error('Informe o valor aplicado para renda fixa.')
      return
    }

    if (pricingMode === 'manual_value' && (!appliedAmount || !manualCurrentValue)) {
      toast.error('Informe valor aplicado e valor atual.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        portfolio_id: portfolioId,
        ticker: normTicker,
        pricing_mode: pricingMode,
        is_b3_linked: pricingMode === 'market' ? isB3Linked : false,
        applied_amount:
          pricingMode === 'cash' ? null : appliedAmount ? Number(appliedAmount) : null,
        contract_rate: contractRate ? Number(contractRate) : null,
        indexer: pricingMode === 'fixed_income' || isTreasury ? indexer : 'none',
        indexer_percent: Number(indexerPercent) || 100,
        maturity_date: maturityDate || null,
        application_date: applicationDate || null,
        manual_current_value: manualCurrentValue ? Number(manualCurrentValue) : null,
        manual_value_updated_at: manualCurrentValue ? new Date().toISOString() : null,
        tax_exempt: taxExempt,
        is_treasury: isTreasury,
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
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Tipo de precificação"
          value={pricingMode}
          onChange={(e) => setPricingMode(e.target.value as PortfolioPricingMode)}
          options={PORTFOLIO_PRICING_MODE_OPTIONS}
        />

        {pricingMode === 'market' && (
          <>
            <Input
              label="Ticker"
              value={assetTicker}
              onChange={(e) => handleTickerSearch(e.target.value)}
              placeholder="Ex: WEGE3"
            />
            {suggestions.length > 0 && (
              <div className="max-h-32 overflow-y-auto border border-primary rounded-lg">
                {suggestions.slice(0, 6).map((s) => (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() => {
                      setAssetTicker(s.ticker)
                      setIsB3Linked(isB3TickerPattern(s.ticker))
                      setSuggestions([])
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-tertiary"
                  >
                    <span className="font-bold">{s.ticker}</span> — {s.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2.5 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl">
              <Checkbox
                label="Vinculado à B3"
                description="Cotação atualizada automaticamente pelo mercado"
                checked={isB3Linked}
                onChange={(e) => setIsB3Linked(e.target.checked)}
              />
              <Checkbox
                label="Tesouro Direto (híbrido)"
                description="Cotação por mercado ou taxa contratada"
                checked={isTreasury}
                onChange={(e) => setIsTreasury(e.target.checked)}
              />
            </div>
          </>
        )}

        {(pricingMode === 'fixed_income' || pricingMode === 'manual_value' || pricingMode === 'cash') && (
          <Input
            label="Ticker / identificador"
            value={assetTicker}
            onChange={(e) => setAssetTicker(e.target.value.toUpperCase())}
            placeholder="Ex: CDB-INTER-2027"
          />
        )}

        {pricingMode === 'cash' && (
          <p className="text-xs text-secondary">
            Saldo em caixa não possui rentabilidade — o valor acompanha apenas os lançamentos de entrada e saída.
          </p>
        )}

        {pricingMode !== 'cash' && (
          <Input
            label="Valor aplicado (R$)"
            type="number"
            step="0.01"
            value={appliedAmount}
            onChange={(e) => setAppliedAmount(e.target.value)}
            placeholder="Ex: 10000"
          />
        )}

        <Input
          label="Data da aplicação"
          type="date"
          value={applicationDate}
          onChange={(e) => setApplicationDate(e.target.value)}
        />

        {pricingMode === 'fixed_income' && (
          <>
            <Select
              label="Indexador"
              value={indexer}
              onChange={(e) => setIndexer(e.target.value as PortfolioAssetIndexer)}
              options={INDEXER_OPTIONS}
            />
            {indexer !== 'none' && (
              <Input
                label="% do indexador"
                type="number"
                step="0.01"
                value={indexerPercent}
                onChange={(e) => setIndexerPercent(e.target.value)}
              />
            )}
            {indexer === 'none' && (
              <Input
                label="Taxa contratada (% a.a.)"
                type="number"
                step="0.01"
                value={contractRate}
                onChange={(e) => setContractRate(e.target.value)}
              />
            )}
            <Input
              label="Vencimento"
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
            />
            <Checkbox
              label="Isento de IR (LCI/LCA)"
              description="Não aplica tabela regressiva de imposto de renda"
              checked={taxExempt}
              onChange={(e) => setTaxExempt(e.target.checked)}
            />
          </>
        )}

        {pricingMode === 'manual_value' && (
          <Input
            label="Valor atual (R$)"
            type="number"
            step="0.01"
            value={manualCurrentValue}
            onChange={(e) => setManualCurrentValue(e.target.value)}
          />
        )}

        <Input
          label="Meta de Alocação Ideal (%)"
          type="number"
          step="0.1"
          min="0"
          max="100"
          placeholder="Ex: 15"
          value={targetPct}
          onChange={(e) => setTargetPct(e.target.value)}
          className="text-sm font-semibold font-mono"
        />

        <p className="text-[11px] text-secondary">
          Rentabilidade líquida usa estimativa simplificada de IR (tabela regressiva para RF; 15% para mercado).
          Sem come-cotas.
        </p>

        <ModalActionFooter onCancel={onClose} submitLabel="Salvar" submitDisabled={saving} />
      </form>
    </Modal>
  )
}
