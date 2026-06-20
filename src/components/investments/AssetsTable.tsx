import { Fragment } from 'react'
import { ChevronDown, Edit2, Check, X, Settings2, Info } from 'lucide-react'
import Input from '@/components/Input'
import IconButton from '@/components/IconButton'
import {
  formatCurrencyByCode,
  formatPercentBR,
  formatQuantityBR,
  formatSignedPercentBR,
} from '@/utils/format'
import type { AssetPosition } from '@/services/investmentEngine'
import { Badge } from '@/components/ui/badge'

interface AssetsTableProps {
  filteredPositionsByClass: Record<string, AssetPosition[]>
  collapsedClasses: Record<string, boolean>
  toggleClassCollapsed: (className: string) => void
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

export default function AssetsTable({
  filteredPositionsByClass,
  collapsedClasses,
  toggleClassCollapsed,
  editingPriceTicker,
  editingPriceValue,
  setEditingPriceValue,
  setEditingPriceTicker,
  savingPrice,
  handleSaveInlinePrice,
  handleOpenAssetTxModal,
  setAssetDefTicker,
  setAssetDefModalOpen,
}: AssetsTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto border border-glass rounded-2xl ring-1 ring-primary/5 text-left">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="surface-glass border-b border-glass text-[10px] font-black text-secondary uppercase tracking-widest">
            <th className="px-4 py-3">Ativo</th>
            <th className="px-4 py-3">Setor</th>
            <th className="px-4 py-3 text-right">Qtd</th>
            <th className="px-4 py-3 text-right">Cotação</th>
            <th className="px-4 py-3 text-right">Valor Total</th>
            <th className="px-4 py-3 text-right">Rent. Bruta</th>
            <th className="px-4 py-3 text-center">Real</th>
            <th className="px-4 py-3 text-center">Alvo</th>
            <th className="px-4 py-3 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-glass">
          {Object.entries(filteredPositionsByClass).length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-secondary">
                  <span className="opacity-30 text-lg">🔍</span>
                  <p className="text-sm font-semibold">Nenhum ativo encontrado</p>
                  <p className="text-xs opacity-70">Tente ajustar os filtros ativos</p>
                </div>
              </td>
            </tr>
          ) : (
            Object.entries(filteredPositionsByClass).map(([className, classPositions]) => {
              const isCollapsed = !!collapsedClasses[className]
              return (
                <Fragment key={className}>
                  {/* Linha de cabeçalho do grupo de classe (Clicável para recolher) */}
                  <tr
                    onClick={() => toggleClassCollapsed(className)}
                    className="surface-glass border-l-4 border-l-[var(--color-primary)] border-b border-glass text-primary cursor-pointer hover:bg-secondary/60 transition-all duration-200 select-none"
                  >
                    <td colSpan={9} className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                          {className}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="success" className="text-[9px] font-black font-mono px-2 py-0.5 rounded-full">
                            {classPositions.length} {classPositions.length === 1 ? 'ativo' : 'ativos'}
                          </Badge>
                          <ChevronDown
                            size={13}
                            className={`text-secondary/60 transition-transform duration-300 ${
                              isCollapsed ? '-rotate-90' : 'rotate-0'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Linhas de posições do grupo */}
                  {!isCollapsed &&
                    classPositions.map((pos) => {
                      const isPositive = pos.gross_yield_pct >= 0
                      return (
                        <tr
                          key={pos.ticker}
                          className="hover:bg-primary/5 border-b border-glass/30 transition-all duration-200 cursor-pointer group/row"
                          onClick={() => handleOpenAssetTxModal(pos)}
                          title="Ver transações do ativo"
                        >
                          <td
                            className={`px-4 py-3 pl-7 font-bold text-primary border-l-4 ${
                              isPositive ? 'border-l-[var(--color-income)]' : 'border-l-[var(--color-expense)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-xs tracking-wider">{pos.ticker}</span>
                              {pos.pricing_mode === 'fixed_income' && (
                                <span
                                  title="Valoração na curva (taxa pactuada). Não reflete o valor de resgate antecipado a mercado."
                                  className="inline-flex shrink-0"
                                >
                                  <Info
                                    size={12}
                                    className="text-secondary/60 cursor-help"
                                    aria-label="Valoração na curva"
                                  />
                                </span>
                              )}
                              {pos.pricing_mode === 'market' &&
                                pos.is_b3_linked &&
                                (pos.quotation_status === 'stale' || pos.quotation_status === 'unavailable') && (
                                  <Badge variant="warning" className="text-[8px] px-1.5 py-0.5 rounded-full shrink-0">
                                    Desatualizada
                                  </Badge>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-secondary font-medium">
                            {pos.sector || 'Outros'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-primary font-semibold">
                            {formatQuantityBR(pos.quantity)}
                          </td>
                          <td className="px-4 py-3 text-right text-secondary">
                            {editingPriceTicker === pos.ticker ? (
                              <div
                                className="flex items-center justify-end gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
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
                                  className="!w-20 !py-0.5 !px-1.5 text-xs text-right !border-balance font-mono"
                                  autoFocus
                                />
                                <IconButton
                                  type="button"
                                  variant="success"
                                  size="sm"
                                  icon={<Check size={12} />}
                                  label="Salvar"
                                  onClick={() => handleSaveInlinePrice(pos.ticker)}
                                  disabled={savingPrice}
                                  className="!rounded"
                                />
                                <IconButton
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  icon={<X size={12} />}
                                  label="Cancelar"
                                  onClick={() => setEditingPriceTicker(null)}
                                  disabled={savingPrice}
                                  className="!rounded"
                                />
                              </div>
                            ) : (
                              <div
                                className="flex items-center justify-end gap-1 select-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="font-mono text-xs">
                                  {formatCurrencyByCode(pos.current_price, pos.currency)}
                                </span>
                                {pos.pricing_mode === 'market' && (
                                  <IconButton
                                    type="button"
                                    size="sm"
                                    icon={<Edit2 size={11} className="shrink-0" />}
                                    label="Editar cotação manualmente"
                                    onClick={() => {
                                      setEditingPriceTicker(pos.ticker)
                                      setEditingPriceValue(pos.current_price.toString())
                                    }}
                                    className="opacity-0 group-hover/row:opacity-100 !rounded transition-all"
                                  />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-primary font-black">
                            {formatCurrencyByCode(pos.total_value, pos.currency)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono text-xs font-black ${
                              pos.gross_yield_pct >= 0 ? 'text-income' : 'text-expense'
                            }`}
                          >
                            {formatSignedPercentBR(pos.gross_yield_pct)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs font-bold text-primary">
                            {formatPercentBR(pos.current_percentage, 1)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs font-bold text-income">
                            {formatPercentBR(pos.target_percentage, 0)}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              type="button"
                              size="sm"
                              icon={<Settings2 size={14} />}
                              label="Configurar Ativo"
                              onClick={() => {
                                setAssetDefTicker(pos.ticker)
                                setAssetDefModalOpen(true)
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
