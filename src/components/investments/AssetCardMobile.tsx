import { ChevronDown, Info, Edit2, BarChart2, Settings2 } from 'lucide-react'
import Input from '@/components/Input'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import {
  formatCurrencyByCode,
  formatPercentBR,
  formatQuantityBR,
  formatSignedPercentBR,
} from '@/utils/format'
import type { AssetPosition } from '@/services/investmentEngine'
import { Badge } from '@/components/ui/badge'

interface AssetCardMobileProps {
  filteredPositionsByClass: Record<string, AssetPosition[]>
  collapsedClasses: Record<string, boolean>
  toggleClassCollapsed: (className: string) => void
  expandedAssets: Record<string, boolean>
  toggleAssetExpanded: (ticker: string) => void
  editingPriceTicker: string | null
  editingPriceValue: string
  setEditingPriceValue: (v: string) => void
  setEditingPriceTicker: (ticker: string | null) => void
  savingPrice: boolean
  handleSaveInlinePrice: (ticker: string) => void
  handleOpenAssetTxModal: (pos: AssetPosition) => void
  setAssetDefTicker: (ticker: string) => void
  setAssetDefModalOpen: (open: boolean) => void
}

export default function AssetCardMobile({
  filteredPositionsByClass,
  collapsedClasses,
  toggleClassCollapsed,
  expandedAssets,
  toggleAssetExpanded,
  editingPriceTicker,
  editingPriceValue,
  setEditingPriceValue,
  setEditingPriceTicker,
  savingPrice,
  handleSaveInlinePrice,
  handleOpenAssetTxModal,
  setAssetDefTicker,
  setAssetDefModalOpen,
}: AssetCardMobileProps) {
  return (
    <div className="block md:hidden space-y-4 text-left">
      {Object.entries(filteredPositionsByClass).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-secondary animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
            <span className="opacity-40 text-lg">🔍</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Nenhum ativo encontrado</p>
            <p className="text-xs opacity-70 mt-0.5">Tente ajustar os filtros ativos</p>
          </div>
        </div>
      ) : (
        Object.entries(filteredPositionsByClass).map(([className, classPositions]) => {
          const isClassCollapsed = !!collapsedClasses[className]
          return (
            <div key={className} className="space-y-2 text-left animate-page-enter">
              {/* Cabeçalho do Grupo de Classe (Clicável para recolher) */}
              <div
                onClick={() => toggleClassCollapsed(className)}
                className="flex items-center justify-between surface-glass border border-glass border-l-4 border-l-[var(--color-income)] px-3.5 py-2.5 rounded-xl select-none text-left cursor-pointer hover:bg-secondary/60 active:bg-secondary/80 transition-colors"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                  {className}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[9px] font-black font-mono px-2 py-0.5 rounded-full">
                    {classPositions.length} {classPositions.length === 1 ? 'ativo' : 'ativos'}
                  </Badge>
                  <ChevronDown
                    size={12}
                    className={`text-secondary/60 transition-transform duration-300 ${
                      isClassCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </div>
              </div>

              {/* Cards de Ativos */}
              {!isClassCollapsed && (
                <div className="space-y-2.5">
                  {classPositions.map((pos) => {
                    const isGrossPositive = pos.gross_yield_pct >= 0
                    const isExpanded = !!expandedAssets[pos.ticker]

                    return (
                      <div
                        key={pos.ticker}
                        className={`surface-glass border border-glass border-l-4 ${
                          isGrossPositive ? 'border-l-[var(--color-income)]' : 'border-l-[var(--color-expense)]'
                        } rounded-2xl overflow-hidden animate-page-enter`}
                      >
                        {/* Cabeçalho compacto clicável */}
                        <div
                          onClick={() => toggleAssetExpanded(pos.ticker)}
                          className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-secondary/30 active:bg-secondary/50 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isGrossPositive ? 'bg-income' : 'bg-expense'}`} />
                            <div className="text-left min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-black text-primary text-[13px] block leading-tight tracking-wider truncate">
                                  {pos.ticker}
                                </span>
                                {pos.pricing_mode === 'fixed_income' && (
                                  <span
                                    title="Valoração na curva (taxa pactuada). Não reflete o valor de resgate antecipado a mercado."
                                    className="inline-flex shrink-0"
                                  >
                                    <Info
                                      size={11}
                                      className="text-secondary/60 cursor-help"
                                      aria-label="Valoração na curva"
                                    />
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-secondary font-medium block truncate">
                                {pos.sector || pos.asset_class || 'Outros'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right shrink-0">
                            <div>
                              <span className="text-xs font-black text-primary font-mono block leading-tight">
                                {formatCurrencyByCode(pos.total_value, pos.currency)}
                              </span>
                              <span
                                className={`text-[10px] font-bold font-mono block ${
                                  isGrossPositive ? 'text-income' : 'text-expense'
                                }`}
                              >
                                {formatSignedPercentBR(pos.gross_yield_pct)}
                              </span>
                            </div>
                            <ChevronDown
                              size={14}
                              className={`text-secondary/60 transition-transform duration-300 shrink-0 ${
                                isExpanded ? 'rotate-180' : 'rotate-0'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Conteúdo Expandido */}
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-out ${
                            isExpanded ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'
                          }`}
                        >
                          <div className="px-4 pb-4 pt-3 border-t border-glass space-y-3.5 modal-panel-glass text-left">
                            {/* Grid de Métricas */}
                            <div className="grid grid-cols-2 gap-0 rounded-xl border border-glass overflow-hidden">
                              <div className="p-3 bg-secondary/15">
                                <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">
                                  Quantidade
                                </span>
                                <span className="text-xs font-bold text-primary font-mono">
                                  {formatQuantityBR(pos.quantity)}
                                </span>
                              </div>

                              <div className="p-3 bg-secondary/15 border-l border-glass">
                                <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">
                                  Preço Médio
                                </span>
                                <span className="text-xs font-bold text-primary font-mono">
                                  {pos.quantity > 0
                                    ? formatCurrencyByCode(pos.cost_basis / pos.quantity, pos.currency)
                                    : formatCurrencyByCode(0, pos.currency)}
                                </span>
                              </div>

                              <div className="p-3 bg-secondary/5 border-t border-glass">
                                <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">
                                  Cotação
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-primary font-mono">
                                    {formatCurrencyByCode(pos.current_price, pos.currency)}
                                  </span>
                                  {pos.pricing_mode === 'market' && editingPriceTicker !== pos.ticker && (
                                    <IconButton
                                      type="button"
                                      size="sm"
                                      icon={<Edit2 size={9} className="shrink-0" />}
                                      label="Editar cotação manualmente"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingPriceTicker(pos.ticker)
                                        setEditingPriceValue(pos.current_price.toString())
                                      }}
                                      className="!rounded !p-0.5"
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="p-3 bg-secondary/5 border-t border-l border-glass">
                                <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">
                                  Custo Total
                                </span>
                                <span className="text-xs font-bold text-primary font-mono">
                                  {formatCurrencyByCode(pos.cost_basis, pos.currency)}
                                </span>
                              </div>
                            </div>

                            {/* Edição inline de preço */}
                            {editingPriceTicker === pos.ticker && (
                              <div
                                className="p-3 bg-balance/5 border border-balance/20 rounded-xl"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[9px] uppercase font-extrabold text-secondary block mb-1.5">
                                  Atualizar Preço ({pos.ticker})
                                </span>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editingPriceValue}
                                    onChange={(e) => setEditingPriceValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveInlinePrice(pos.ticker)
                                      if (e.key === 'Escape') setEditingPriceTicker(null)
                                    }}
                                    disabled={savingPrice}
                                    className="flex-1 !py-1.5 !px-3 text-xs !border-balance font-mono h-9"
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost-success"
                                    size="sm"
                                    onClick={() => handleSaveInlinePrice(pos.ticker)}
                                    disabled={savingPrice}
                                    className="h-9 px-3 font-semibold text-xs"
                                  >
                                    Salvar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost-danger"
                                    size="sm"
                                    onClick={() => setEditingPriceTicker(null)}
                                    disabled={savingPrice}
                                    className="h-9 px-3 font-semibold text-xs"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Barra de alocação real vs. meta */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-secondary font-medium">Participação real:</span>
                                  <span className="font-mono font-bold text-primary">
                                    {formatPercentBR(pos.current_percentage, 1)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-secondary font-medium">Meta:</span>
                                  <span className="font-mono font-bold text-income">
                                    {formatPercentBR(pos.target_percentage, 0)}
                                  </span>
                                </div>
                              </div>
                              <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden relative">
                                <div
                                  className="h-full bg-income rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(pos.current_percentage, 100)}%` }}
                                />
                                {pos.target_percentage > 0 && (
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-balance/60"
                                    style={{ left: `${Math.min(pos.target_percentage, 99)}%` }}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Ações rápidas */}
                            <div className="flex items-center justify-between pt-2 border-t border-primary/5">
                              <div>
                                {pos.pricing_mode === 'market' &&
                                  pos.is_b3_linked &&
                                  (pos.quotation_status === 'stale' || pos.quotation_status === 'unavailable') && (
                                    <Badge variant="warning" className="text-[8px] px-1.5 py-0.5 rounded-full shrink-0">
                                      Cotação desatualizada
                                    </Badge>
                                  )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenAssetTxModal(pos)
                                  }}
                                  className="!min-h-0 py-1.5 text-[10px] text-income border-income/25 bg-income/5 hover:bg-income/10 font-bold"
                                >
                                  <BarChart2 size={11} />
                                  <span>Transações</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAssetDefTicker(pos.ticker)
                                    setAssetDefModalOpen(true)
                                  }}
                                  className="!min-h-0 py-1.5 text-[10px] font-bold"
                                >
                                  <Settings2 size={11} />
                                  <span>Configurar</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
