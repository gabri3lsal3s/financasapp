import React from 'react'
import { AssetPosition } from '@/services/investmentEngine'
import { TargetAllocation, PortfolioGroupTarget, AssetPrice, PortfolioTransaction } from '@/types'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { Percent, Layers, Trash2, Edit } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface PositionsTableProps {
  positions: AssetPosition[]
  targetAllocations: TargetAllocation[]
  groupTargets: PortfolioGroupTarget[]
  assetPrices: Record<string, AssetPrice>
  assetTheses: Record<string, string>
  
  showTargetForm: boolean
  setShowTargetForm: (show: boolean) => void
  showGroupTargetForm: boolean
  setShowGroupTargetForm: (show: boolean) => void
  
  targetTicker: string
  setTargetTicker: (ticker: string) => void
  targetPct: string
  setTargetPct: (pct: string) => void
  targetAssetClass: string
  setTargetAssetClass: (cls: string) => void
  targetSector: string
  setTargetSector: (sec: string) => void
  isCustomTicker: boolean
  setIsCustomTicker: (isCustom: boolean) => void
  
  groupTargetType: 'class' | 'sector'
  setGroupTargetType: (type: 'class' | 'sector') => void
  groupTargetName: string
  setGroupTargetName: (name: string) => void
  groupTargetPct: string
  setGroupTargetPct: (pct: string) => void
  
  onSaveTarget: (e: React.FormEvent) => void
  onDeleteTarget: (id: string) => void
  onSaveGroupTarget: (e: React.FormEvent) => void
  onDeleteGroupTarget: (id: string) => void
  
  targetSuggestions: Array<{ ticker: string; name: string }>
  showTargetSuggestions: boolean
  setShowTargetSuggestions: (show: boolean) => void
  handleCustomTickerChange: (val: string) => void
  handleSelectRegisteredTicker: (val: string) => void
  
  onEditAssetClassification: (ticker: string, assetClass: string, sector: string) => void
  
  transactions: PortfolioTransaction[]
}

export default function PositionsTable({
  positions,
  targetAllocations,
  groupTargets,
  assetPrices,
  assetTheses,
  showTargetForm,
  setShowTargetForm,
  showGroupTargetForm,
  setShowGroupTargetForm,
  targetTicker,
  setTargetTicker,
  targetPct,
  setTargetPct,
  targetAssetClass,
  setTargetAssetClass,
  targetSector,
  setTargetSector,
  isCustomTicker,
  setIsCustomTicker,
  groupTargetType,
  setGroupTargetType,
  groupTargetName,
  setGroupTargetName,
  groupTargetPct,
  setGroupTargetPct,
  onSaveTarget,
  onDeleteTarget,
  onSaveGroupTarget,
  onDeleteGroupTarget,
  targetSuggestions,
  showTargetSuggestions,
  setShowTargetSuggestions,
  handleCustomTickerChange,
  handleSelectRegisteredTicker,
  onEditAssetClassification,
  transactions,
}: PositionsTableProps) {
  const sumTargetPercentages = targetAllocations.reduce((sum, t) => sum + Number(t.target_percentage), 0)

  const registeredTickers = Array.from(new Set([
    ...transactions.map(t => t.ticker.toUpperCase()),
    ...targetAllocations.map(t => t.ticker.toUpperCase())
  ])).sort()

  // Agrupar posições por classe
  const positionsByClass: Record<string, AssetPosition[]> = {}
  positions.forEach(pos => {
    const cls = pos.asset_class || 'Renda Fixa'
    if (!positionsByClass[cls]) positionsByClass[cls] = []
    positionsByClass[cls].push(pos)
  })

  return (
    <Card className="p-5 lg:p-6 text-left" style={{ isolation: 'isolate' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4.5">
        <h3 className="font-bold text-base text-primary">Composição Atual e Alvos</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const nextShow = !showTargetForm
              setShowTargetForm(nextShow)
              setShowGroupTargetForm(false)
              if (nextShow) {
                const registered = Array.from(new Set([
                  ...transactions.map(t => t.ticker.toUpperCase()),
                  ...targetAllocations.map(t => t.ticker.toUpperCase())
                ]))
                setIsCustomTicker(registered.length === 0)
              }
            }}
            className="flex items-center gap-1 text-xs"
          >
            <Percent size={14} />
            Ajustar Metas ({sumTargetPercentages}%)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowGroupTargetForm(!showGroupTargetForm)
              setShowTargetForm(false)
            }}
            className="flex items-center gap-1 text-xs border-purple-500/20 text-purple-600 hover:bg-purple-500/10 dark:hover:text-purple-300"
          >
            <Layers size={14} className="text-purple-500" />
            Limites de Exposição
          </Button>
        </div>
      </div>

      {showGroupTargetForm && (
        <form onSubmit={onSaveGroupTarget} className="p-4 bg-muted/20 border border-border/40 rounded-xl mb-4.5 space-y-4 animate-page-enter">
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-end text-left">
            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Tipo de Limite</label>
              <select
                value={groupTargetType}
                onChange={e => {
                  const val = e.target.value as 'class' | 'sector'
                  setGroupTargetType(val)
                  setGroupTargetName(val === 'class' ? 'Ações Nacionais' : '')
                }}
                className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                <option value="class">Por Classe de Ativos</option>
                <option value="sector">Por Setor Econômico</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              {groupTargetType === 'class' ? (
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Classe de Ativo</label>
                  <select
                    value={groupTargetName}
                    onChange={e => setGroupTargetName(e.target.value)}
                    className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                    required
                  >
                    <option value="Ações Nacionais">Ações Nacionais</option>
                    <option value="Ações Internacionais">Ações Internacionais</option>
                    <option value="Fundos Imobiliários">Fundos Imobiliários</option>
                    <option value="ETFs Nacionais">ETFs Nacionais</option>
                    <option value="ETFs Internacionais">ETFs Internacionais</option>
                    <option value="Criptoativos">Criptoativos</option>
                    <option value="Renda Fixa">Renda Fixa</option>
                  </select>
                </div>
              ) : (
                <Input
                  label="Setor Econômico"
                  type="text"
                  required
                  placeholder="Ex: Petróleo e Gás"
                  value={groupTargetName}
                  onChange={e => setGroupTargetName(e.target.value)}
                  className="text-sm font-semibold"
                />
              )}
            </div>

            <div className="w-[120px]">
              <Input
                label="Limite Alvo (%)"
                type="number"
                required
                placeholder="Ex: 30"
                value={groupTargetPct}
                onChange={e => setGroupTargetPct(e.target.value)}
                className="text-sm font-semibold"
              />
            </div>

            <Button type="submit" variant="primary" className="text-xs h-[42px] shrink-0 font-extrabold">
              Salvar Limite
            </Button>
          </div>

          {/* Listagem de Limites já Cadastrados */}
          {groupTargets.length > 0 && (
            <div className="pt-3 border-t border-primary/20 space-y-2 text-left">
              <p className="text-[10px] uppercase font-extrabold text-secondary tracking-wider">Limites Ativos:</p>
              <div className="flex flex-wrap gap-2 animate-page-enter">
                {groupTargets.map(gt => (
                  <span key={gt.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary border border-primary rounded-lg text-xs font-semibold text-primary">
                    <span className="text-secondary uppercase text-[9px] font-extrabold font-mono">
                      {gt.group_type === 'class' ? 'Classe' : 'Setor'}:
                    </span>
                    {gt.group_name} ({gt.target_percentage}%)
                    <button
                      type="button"
                      onClick={() => onDeleteGroupTarget(gt.id)}
                      className="text-secondary hover:text-red-500 transition-colors ml-1 font-bold text-sm"
                      title="Remover limite"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </form>
      )}

      {showTargetForm && (
        <form onSubmit={onSaveTarget} className="p-4 bg-muted/20 border border-border/40 rounded-xl mb-4.5 space-y-3 animate-page-enter">
          {/* Linha 1: Seletor de ticker + digitação livre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="text-left">
              <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Selecionar Ticker</label>
              <select
                value={isCustomTicker ? 'custom' : targetTicker}
                onChange={e => handleSelectRegisteredTicker(e.target.value)}
                className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                <option value="">Selecione um ativo...</option>
                {registeredTickers.map(ticker => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
                <option value="custom">➕ Outro Ativo (Digitar...)</option>
              </select>
            </div>

            {isCustomTicker && (
              <div className="relative text-left animate-page-enter">
                <Input
                  label="Digitar Ticker"
                  type="text"
                  required
                  placeholder="Ex: WEGE3"
                  value={targetTicker}
                  onChange={e => handleCustomTickerChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowTargetSuggestions(false), 200)}
                  onFocus={() => targetTicker.length >= 2 && setShowTargetSuggestions(true)}
                  className="uppercase text-sm font-semibold text-primary bg-primary font-mono"
                />
                {showTargetSuggestions && targetSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto" style={{ top: '100%' }}>
                    {targetSuggestions.map(s => (
                      <button
                        key={s.ticker}
                        type="button"
                        onClick={() => {
                          setTargetTicker(s.ticker)
                          const existing = assetPrices[s.ticker.toUpperCase()]
                          if (existing) {
                            setTargetAssetClass(existing.asset_class || '')
                            setTargetSector(existing.sector || '')
                          }
                          setShowTargetSuggestions(false)
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-tertiary text-primary flex items-center justify-between border-b border-primary/10 last:border-0"
                      >
                        <span className="font-bold font-mono">{s.ticker}</span>
                        <span className="text-[10px] text-secondary truncate max-w-[150px]">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Linha 2: % Alvo, Classe, Setor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="text-left">
              <Input
                label="% Alvo Ideal"
                type="number"
                required
                step="0.1"
                placeholder="Ex: 15"
                value={targetPct}
                onChange={e => setTargetPct(e.target.value)}
                className="text-sm font-semibold"
              />
            </div>
            <div className="text-left">
              <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Classe (Opcional)</label>
              <select
                value={targetAssetClass}
                onChange={e => setTargetAssetClass(e.target.value)}
                className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                <option value="">Inferir Auto</option>
                <option value="Ações Nacionais">Ações Nacionais</option>
                <option value="Ações Internacionais">Ações Internacionais</option>
                <option value="Fundos Imobiliários">Fundos Imobiliários</option>
                <option value="ETFs Nacionais">ETFs Nacionais</option>
                <option value="ETFs Internacionais">ETFs Internacionais</option>
                <option value="Criptoativos">Criptoativos</option>
                <option value="Renda Fixa">Renda Fixa</option>
              </select>
            </div>
            <div className="text-left">
              <Input
                label="Setor (Opcional)"
                type="text"
                placeholder="Ex: Energia"
                value={targetSector}
                onChange={e => setTargetSector(e.target.value)}
                className="text-sm font-semibold"
              />
            </div>
          </div>

          {/* Linha 3: Botão submit */}
          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary" className="text-xs h-[42px] px-6 font-extrabold shadow-sm">
              Salvar Meta
            </Button>
          </div>
        </form>
      )}

      {positions.length === 0 ? (
        <p className="text-center py-6 text-sm text-secondary italic">Nenhum ativo em carteira. Cadastre metas ou compras para começar.</p>
      ) : (
        <div className="overflow-x-auto border border-border/30 rounded-xl bg-background/30">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="p-3 font-semibold text-secondary">Ativo</th>
                <th className="p-3 font-semibold text-secondary text-right">Qtd</th>
                <th className="p-3 font-semibold text-secondary text-right">Custo Médio</th>
                <th className="p-3 font-semibold text-secondary text-right">Cotação</th>
                <th className="p-3 font-semibold text-secondary text-right">Total Atual</th>
                <th className="p-3 font-semibold text-secondary text-center">Peso Real</th>
                <th className="p-3 font-semibold text-secondary text-center">Meta Alvo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {Object.entries(positionsByClass).map(([className, classPositions]) => (
                <React.Fragment key={className}>
                  {/* Linha de cabeçalho do grupo de classe */}
                  <tr className="bg-muted/10 border-l-4 border-l-emerald-500 font-extrabold text-xs tracking-wider">
                    <td colSpan={7} className="p-3 text-secondary uppercase font-extrabold select-none">
                      {className}
                    </td>
                  </tr>
                  {classPositions.map(pos => (
                    <tr key={pos.ticker} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 pl-6 font-bold text-primary flex items-center gap-1.5 flex-wrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="font-mono">{pos.ticker}</span>
                        <span className="text-[10px] text-secondary font-normal font-sans">({pos.sector || 'Outros'})</span>
                        <button
                          onClick={() => onEditAssetClassification(pos.ticker, pos.asset_class || 'Renda Fixa', pos.sector || 'Outros')}
                          className="text-secondary hover:text-emerald-500 transition-colors p-0.5 ml-1"
                          title="Editar classificação"
                        >
                          <Edit size={11} />
                        </button>
                        {assetTheses[pos.ticker.toUpperCase()] && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 ml-1 shrink-0" title="Tese cadastrada" />
                        )}
                      </td>
                      <td className="p-3 text-right font-medium text-secondary font-mono">
                        {pos.pricing_mode === 'cash' ? '—' : formatNumberBR(pos.quantity)}
                      </td>
                      <td className="p-3 text-right text-secondary font-mono">
                        {pos.pricing_mode === 'cash'
                          ? '—'
                          : formatCurrency(pos.average_price)}
                      </td>
                      <td className="p-3 text-right text-secondary font-semibold font-mono">
                        {pos.pricing_mode === 'cash'
                          ? '—'
                          : formatCurrency(pos.current_price)}
                      </td>
                      <td className="p-3 text-right font-bold text-primary font-mono">
                        {pos.pricing_mode === 'cash' ? '—' : formatCurrency(pos.total_value)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-muted rounded text-xs font-semibold text-secondary font-mono">{pos.current_percentage}%</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold font-mono">{pos.target_percentage}%</span>
                          {pos.target_percentage > 0 && (
                            <button
                              onClick={() => {
                                const targetObj = targetAllocations.find(t => t.ticker.toUpperCase() === pos.ticker.toUpperCase());
                                if (targetObj) onDeleteTarget(targetObj.id);
                              }}
                              className="text-secondary hover:text-red-500 transition-colors"
                              title="Remover meta"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
