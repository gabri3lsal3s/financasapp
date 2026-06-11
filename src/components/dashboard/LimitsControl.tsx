import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import { formatCurrency } from '@/utils/format'

interface LimitItem {
  categoryId: string
  name: string
  color: string
  value: number
  limitAmount: number
  usagePercentage: number
  isExceeded: boolean
  exceededAmount?: number
  remainingAmount?: number
  statusLabel: string
  alertStatusClass: string
}

interface LimitsControlProps {
  categoriesAttentionList: LimitItem[]
  onCategoryClick: (categoryId: string, categoryName: string) => void
}

type FilterType = 'all' | 'exceeded' | 'attention'

export default function LimitsControl({
  categoriesAttentionList,
  onCategoryClick,
}: LimitsControlProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // Filter list based on selected tab
  const filteredList = useMemo(() => {
    return categoriesAttentionList.filter((item) => {
      if (activeFilter === 'exceeded') return item.isExceeded
      if (activeFilter === 'attention') return !item.isExceeded
      return true
    })
  }, [categoriesAttentionList, activeFilter])

  // Count active limits in each state
  const counts = useMemo(() => {
    return {
      all: categoriesAttentionList.length,
      exceeded: categoriesAttentionList.filter((item) => item.isExceeded).length,
      attention: categoriesAttentionList.filter((item) => !item.isExceeded).length,
    }
  }, [categoriesAttentionList])

  // Stacked bar math calculations
  const { totalSpent, totalLimit, maxScale, limitThresholdPercent } = useMemo(() => {
    const spent = filteredList.reduce((sum, item) => sum + item.value, 0)
    const limit = filteredList.reduce((sum, item) => sum + item.limitAmount, 0)
    const scale = Math.max(spent, limit, 1)
    const threshold = (limit / scale) * 100
    return {
      totalSpent: spent,
      totalLimit: limit,
      maxScale: scale,
      limitThresholdPercent: threshold,
    }
  }, [filteredList])

  return (
    <Card className="border border-glass surface-glass p-4 sm:p-5 shadow-sm transition-all duration-300">
      {/* Header with Title and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-glass/40 pb-3">
        <div>
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            Controle de Limites
          </h3>
          <p className="text-[9px] sm:text-[10px] text-secondary mt-0.5">
            Categorias de gastos que excederam ou estão próximas do limite estabelecido
          </p>
        </div>

        {/* Compact Filters tabs */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-secondary/5 p-0.5 rounded-lg border border-glass">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-0.5 text-[9px] font-bold rounded transition-all ${
              activeFilter === 'all'
                ? 'bg-primary text-button-text shadow-sm'
                : 'text-secondary hover:bg-secondary/10'
            }`}
          >
            Todos ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('exceeded')}
            className={`px-2.5 py-0.5 text-[9px] font-bold rounded transition-all ${
              activeFilter === 'exceeded'
                ? 'bg-expense text-button-text shadow-sm'
                : 'text-secondary hover:bg-secondary/10'
            }`}
          >
            Excedidos ({counts.exceeded})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('attention')}
            className={`px-2.5 py-0.5 text-[9px] font-bold rounded transition-all ${
              activeFilter === 'attention'
                ? 'bg-warning text-button-text shadow-sm'
                : 'text-secondary hover:bg-secondary/10'
            }`}
          >
            Atenção ({counts.attention})
          </button>
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
          <p className="text-[11px] font-bold text-primary">Nenhum limite em alerta</p>
          <p className="text-[9px] text-secondary mt-0.5 max-w-[240px]">
            Tudo sob controle! Suas metas de orçamento estão sendo cumpridas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Consolidated Summary Text */}
          <div className="flex justify-between items-end text-xs font-semibold text-secondary px-0.5">
            <div>
              Total Gasto:{' '}
              <strong
                className={totalSpent > totalLimit ? 'text-expense font-black text-sm' : 'text-primary text-sm'}
              >
                {formatCurrency(totalSpent)}
              </strong>
            </div>
            <div>
              Limite total: <strong className="text-primary">{formatCurrency(totalLimit)}</strong>
            </div>
          </div>

          {/* Stacked Bar (Apple Storage style) */}
          <div className="relative w-full h-4 bg-secondary/15 rounded-full overflow-hidden flex border border-glass">
            {filteredList.map((item) => {
              const widthPercent = (item.value / maxScale) * 100
              if (widthPercent <= 0) return null
              return (
                <div
                  key={item.categoryId}
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: item.color,
                  }}
                  className="h-full transition-all duration-500 ease-out"
                  title={`${item.name}: ${formatCurrency(item.value)}`}
                />
              )
            })}

            {/* Red translucent overlay for overflow region (over 100% of limits) */}
            {totalSpent > totalLimit && (
              <div
                style={{
                  left: `${limitThresholdPercent}%`,
                  right: 0,
                }}
                className="absolute top-0 bottom-0 bg-expense/20 border-l-2 border-expense pointer-events-none"
                title={`Excesso Geral: ${formatCurrency(totalSpent - totalLimit)}`}
              />
            )}
          </div>

          {/* Pill tags layout representing each category below the bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mt-4">
            {filteredList.map((item) => (
              <div
                key={item.categoryId}
                onClick={() => onCategoryClick(item.categoryId, item.name)}
                className={`px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 hover:scale-[1.01] text-xs font-semibold min-w-0 ${
                  item.isExceeded
                    ? 'border-expense/30 bg-expense/5 hover:border-expense/60'
                    : 'border-glass surface-glass hover:border-glass-strong'
                }`}
              >
                {/* Left side: bullet and name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-primary truncate">{item.name}</span>
                </div>

                {/* Right side: exceeded amount (if exceeded) */}
                {item.isExceeded && (
                  <span className="text-expense font-extrabold shrink-0">
                    +{formatCurrency(item.exceededAmount || 0)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
