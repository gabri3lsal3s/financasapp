import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'
import NumberInput from '@/components/NumberInput'
import Select from '@/components/Select'
import Button from '@/components/Button'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { PortfolioQuantPreferences } from '@/types'

interface QuantPreferencesEditorProps {
  portfolioId: string
  preferences: PortfolioQuantPreferences | null
  onSaved: () => void
}

export default function QuantPreferencesEditor({
  portfolioId,
  preferences,
  onSaved
}: QuantPreferencesEditorProps) {
  const [loading, setLoading] = useState(false)

  // Estados locais
  const [tierS, setTierS] = useState('20')
  const [tierA, setTierA] = useState('10')
  const [tierB, setTierB] = useState('5')
  const [tierC, setTierC] = useState('0')
  const [maxSectorAcoes, setMaxSectorAcoes] = useState('30')
  const [maxSectorFiis, setMaxSectorFiis] = useState('45')
  const [minRoic, setMinRoic] = useState('15')
  const [maxDivida, setMaxDivida] = useState('2.5')
  const [decayDays, setDecayDays] = useState<'90' | '180' | '365'>('365')

  useEffect(() => {
    if (preferences) {
      setTierS(String(preferences.tier_s_limit))
      setTierA(String(preferences.tier_a_limit))
      setTierB(String(preferences.tier_b_limit))
      setTierC(String(preferences.tier_c_limit))
      setMaxSectorAcoes(String(preferences.max_sector_acoes))
      setMaxSectorFiis(String(preferences.max_sector_fiis))
      setMinRoic(String(preferences.min_roic_excelente))
      setMaxDivida(String(preferences.max_divida_ebitda))
      setDecayDays(String(preferences.scuttlebutt_decay_days) as '90' | '180' | '365')
    }
  }, [preferences])

  const handleSave = async () => {
    if (!portfolioId) return
    setLoading(true)

    const payload: PortfolioQuantPreferences = {
      portfolio_id: portfolioId,
      tier_s_limit: parseFloat(tierS) || 0,
      tier_a_limit: parseFloat(tierA) || 0,
      tier_b_limit: parseFloat(tierB) || 0,
      tier_c_limit: parseFloat(tierC) || 0,
      max_sector_acoes: parseFloat(maxSectorAcoes) || 0,
      max_sector_fiis: parseFloat(maxSectorFiis) || 0,
      min_roic_excelente: parseFloat(minRoic) || 0,
      max_divida_ebitda: parseFloat(maxDivida) || 0,
      scuttlebutt_decay_days: parseInt(decayDays) as 90 | 180 | 365
    }

    try {
      const { error } = await supabase
        .from('portfolio_quant_preferences')
        .upsert(payload, { onConflict: 'portfolio_id' })

      if (error) throw error

      toast.success('Preferências quantamentais salvas!')
      
      // Disparar evento local de alteração
      window.dispatchEvent(
        new CustomEvent('local-data-changed', {
          detail: { entity: 'portfolio_quant_preferences' }
        })
      )
      
      onSaved()
    } catch (err) {
      logger.error('[QuantPreferencesEditor] Erro ao salvar preferências:', err)
      toast.error('Erro ao salvar preferências.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-5 text-left">
      {/* Header */}
      <div className="border-b border-glass/40 pb-3">
        <h4 className="text-sm font-black text-primary uppercase tracking-wider">
          Configurações Quantamentais
        </h4>
        <p className="text-[10px] text-secondary font-medium">
          Defina as regras de alocação indicativa por tiers de convicção e limites macro
        </p>
      </div>

      {/* Grid de Configurações */}
      <div className="space-y-4">
        {/* Limites de Tiers */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-black tracking-wider text-primary border-b border-glass/10 pb-1 block">
            Fator Limite por Tier de Convicção (% da Classe)
          </label>
          <p className="text-[9px] text-muted leading-relaxed">
            Fator máximo de alocação permitida para um único ativo do respectivo Tier, calculado como percentual da meta da classe macro.
          </p>
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Tier S (Ex: 20%)</label>
              <NumberInput min={0} max={100} step={1} value={tierS} onChange={(e) => setTierS(e.target.value)} suffix="%" compact hideSpinButtons />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Tier A (Ex: 10%)</label>
              <NumberInput min={0} max={100} step={1} value={tierA} onChange={(e) => setTierA(e.target.value)} suffix="%" compact hideSpinButtons />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Tier B (Ex: 5%)</label>
              <NumberInput min={0} max={100} step={1} value={tierB} onChange={(e) => setTierB(e.target.value)} suffix="%" compact hideSpinButtons />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Tier C (Ex: 0%)</label>
              <NumberInput min={0} max={100} step={1} value={tierC} onChange={(e) => setTierC(e.target.value)} suffix="%" compact hideSpinButtons />
            </div>
          </div>
        </div>

        {/* Travas de Concentração Setorial */}
        <div className="space-y-2 pt-2">
          <label className="text-[10px] uppercase font-black tracking-wider text-primary border-b border-glass/10 pb-1 block">
            Travas de Concentração Setorial Máxima
          </label>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Teto Setor Ações (%)</label>
              <NumberInput min={0} max={100} step={1} value={maxSectorAcoes} onChange={(e) => setMaxSectorAcoes(e.target.value)} suffix="%" compact hideSpinButtons />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Teto Setor FIIs (%)</label>
              <NumberInput min={0} max={100} step={1} value={maxSectorFiis} onChange={(e) => setMaxSectorFiis(e.target.value)} suffix="%" compact hideSpinButtons />
            </div>
          </div>
        </div>

        {/* Limiares Quantitativos & Obsolescência */}
        <div className="space-y-2 pt-2">
          <label className="text-[10px] uppercase font-black tracking-wider text-primary border-b border-glass/10 pb-1 block">
            Limiares de Indicadores & Obsolescência
          </label>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">ROIC Excelente (%)</label>
              <NumberInput min={0} max={100} step={0.5} value={minRoic} onChange={(e) => setMinRoic(e.target.value)} suffix="%" compact hideSpinButtons />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Max Dív. Líq/EBITDA</label>
              <NumberInput min={0} step={0.1} value={maxDivida} onChange={(e) => setMaxDivida(e.target.value)} compact hideSpinButtons />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] uppercase font-black text-secondary">Validade Scuttlebutt</label>
              <Select
                value={decayDays}
                onChange={(e) => setDecayDays(e.target.value as '90' | '180' | '365')}
                options={[
                  { value: '90', label: '90 dias' },
                  { value: '180', label: '180 dias' },
                  { value: '365', label: '365 dias' }
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ação */}
      <div className="pt-2">
        <Button
          onClick={handleSave}
          disabled={loading}
          variant="balance"
          className="w-full rounded-2xl h-10 font-black uppercase text-[10px] tracking-widest"
        >
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </Card>
  )
}
