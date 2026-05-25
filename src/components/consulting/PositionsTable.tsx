import React from 'react'
import { AssetPosition } from '@/services/investmentEngine'
import { PortfolioGroupTarget } from '@/types'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { Edit, Settings2 } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface PositionsTableProps {
  positions: AssetPosition[]
  groupTargets: PortfolioGroupTarget[]
  assetTheses: Record<string, string>
  
  showGroupTargetForm: boolean
  
  groupTargetType: 'class' | 'sector'
  setGroupTargetType: (type: 'class' | 'sector') => void
  groupTargetName: string
  setGroupTargetName: (name: string) => void
  groupTargetPct: string
  setGroupTargetPct: (pct: string) => void
  
  onSaveGroupTarget: (e: React.FormEvent) => void
  onDeleteGroupTarget: (id: string) => void
  
  onEditAssetClassification: (ticker: string, assetClass: string, sector: string) => void
  onOpenAssetConfig: (ticker: string) => void
}

export default function PositionsTable({
  positions,
  groupTargets,
  assetTheses,
  showGroupTargetForm,
  groupTargetType,
  setGroupTargetType,
  groupTargetName,
  setGroupTargetName,
  groupTargetPct,
  setGroupTargetPct,
  onSaveGroupTarget,
  onDeleteGroupTarget,
  onEditAssetClassification,
  onOpenAssetConfig,
}: PositionsTableProps) {

  // Agrupar posições por classe
  const positionsByClass: Record<string, AssetPosition[]> = {}
  positions
    .forEach(pos => {
      const cls = pos.asset_class || 'Renda Fixa'
      if (!positionsByClass[cls]) positionsByClass[cls] = []
      positionsByClass[cls].push(pos)
    })

  return (
    <Card className="p-5 lg:p-6 text-left" style={{ isolation: 'isolate' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4.5">
        <h3 className="font-bold text-base text-primary">Composição Atual e Alvos</h3>
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


      {positions.length === 0 ? (
        <p className="text-center py-6 text-sm text-secondary italic">Nenhum ativo em carteira. Cadastre metas ou compras para começar.</p>
      ) : (
        <>
          {/* 1. Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto border border-border/30 rounded-xl bg-background/30">
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
                  <th className="p-3 font-semibold text-secondary text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {Object.entries(positionsByClass).map(([className, classPositions]) => (
                  <React.Fragment key={className}>
                    {/* Linha de cabeçalho do grupo de classe */}
                    <tr className="bg-muted/10 border-l-4 border-l-emerald-500 font-extrabold text-xs tracking-wider">
                      <td colSpan={8} className="p-3 text-secondary uppercase font-extrabold select-none">
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
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold font-mono">{pos.target_percentage}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onOpenAssetConfig(pos.ticker)}
                            className="text-secondary hover:text-primary transition-colors"
                            title="Configurar Ativo"
                          >
                            <Settings2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. Visualização em Cards para Mobile */}
          <div className="block md:hidden space-y-4">
            {Object.entries(positionsByClass).map(([className, classPositions]) => (
              <div key={className} className="space-y-2">
                {/* Cabeçalho do Grupo de Classe */}
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-secondary bg-muted/10 border-l-4 border-l-emerald-500 px-3 py-1.5 rounded-lg select-none">
                  {className}
                </div>
                
                {/* Posições da Classe */}
                <div className="space-y-3">
                  {classPositions.map(pos => {
                    const hasThesis = !!assetTheses[pos.ticker.toUpperCase()];
                    return (
                      <div 
                        key={pos.ticker}
                        className="p-4 bg-card border border-border/40 rounded-2xl space-y-3 shadow-sm transition-all hover:scale-[1.01] animate-page-enter"
                      >
                        {/* Cabeçalho do Ativo */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-mono font-bold text-primary text-sm">{pos.ticker}</span>
                            <span className="text-[10px] text-secondary font-medium">({pos.sector || 'Outros'})</span>
                            
                            {/* Editar Classificação */}
                            <button
                              onClick={() => onEditAssetClassification(pos.ticker, pos.asset_class || 'Renda Fixa', pos.sector || 'Outros')}
                              className="text-secondary hover:text-emerald-500 transition-colors p-1"
                              title="Editar classificação"
                            >
                              <Edit size={12} />
                            </button>

                            {/* Indicador de Tese */}
                            {hasThesis && (
                              <span 
                                className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[8px] font-extrabold bg-indigo-500/10 text-indigo-500 tracking-wider uppercase"
                                title="Tese cadastrada"
                              >
                                Tese
                              </span>
                            )}
                          </div>
                          
                          {/* Preço Atual */}
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-extrabold text-secondary block">Preço</span>
                            <span className="text-xs font-bold text-primary font-mono">
                              {pos.pricing_mode === 'cash' ? '—' : formatCurrency(pos.current_price)}
                            </span>
                          </div>
                        </div>

                        {/* Grid de Métricas */}
                        <div className="grid grid-cols-2 gap-3 text-left bg-secondary/30 p-2.5 rounded-xl border border-primary/10">
                          <div>
                            <span className="text-[9px] uppercase font-extrabold text-secondary block">Quantidade</span>
                            <span className="text-xs font-semibold text-primary font-mono">
                              {pos.pricing_mode === 'cash' ? '—' : formatNumberBR(pos.quantity)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-extrabold text-secondary block">Custo Médio</span>
                            <span className="text-xs font-semibold text-primary font-mono">
                              {pos.pricing_mode === 'cash' ? '—' : formatCurrency(pos.average_price)}
                            </span>
                          </div>
                          <div className="col-span-2 pt-1.5 border-t border-primary/10 flex items-center justify-between">
                            <span className="text-[9px] uppercase font-extrabold text-secondary block">Total Atual</span>
                            <span className="text-sm font-extrabold text-primary font-mono">
                              {formatCurrency(pos.total_value)}
                            </span>
                          </div>
                        </div>

                        {/* Progresso de Metas de Exposição */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className="text-secondary font-medium">Peso:</span>
                              <span className="font-mono font-bold text-primary">{pos.current_percentage}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-secondary font-medium">Meta:</span>
                              <span className="font-mono font-bold text-emerald-500">{pos.target_percentage}%</span>
                            </div>
                          </div>
                          
                          {/* Barra de Progresso elegante */}
                          <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden relative">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(pos.current_percentage, 100)}%` }}
                            />
                            {pos.target_percentage > 0 && (
                              <div 
                                className="absolute top-0 bottom-0 w-0.5 bg-emerald-300 dark:bg-emerald-700"
                                style={{ left: `${Math.min(pos.target_percentage, 99)}%` }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Ações rápidas */}
                        <div className="flex justify-end pt-2 border-t border-primary/5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAssetConfig(pos.ticker);
                            }}
                            className="flex items-center gap-1.5 text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-all py-1.5 px-3 border border-indigo-500/20 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 font-bold"
                          >
                            <Settings2 size={12} />
                            <span>Configurar Ativo</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}


