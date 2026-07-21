import { useState, useMemo, useEffect } from 'react'
import Card from '@/components/Card'
import ViewModeToggle from '@/components/ViewModeToggle'
import PortfolioPieChart from '@/components/investments/PortfolioPieChart'
import { formatCurrency, formatPercentBR, formatSignedPercentBR } from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import type { PortfolioGroupTarget, PortfolioTransaction } from '@/types'
import {
  aggregateClassPerformance,
  aggregateSectorPerformance,
  fetchBenchmarkReturns,
  type ClassPerformance,
} from '@/utils/portfolioBenchmarks'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { logger } from '@/utils/logger'

interface AssetAnalyticsCardProps {
  positions: ValuedPosition[]
  cashValue: number
  totalValue: number
  groupTargets: PortfolioGroupTarget[]
  transactions?: PortfolioTransaction[]
  assetPieData?: Array<{ name: string; value: number; percentage: number; color: string }>
  classPieData?: Array<{ name: string; value: number; percentage: number; color: string }>
  sectorPieData?: Array<{ name: string; value: number; percentage: number; color: string }>
  onAssetSliceClick?: (ticker: string) => void
}

type MainViewMode = 'allocation' | 'performance' | 'pie'
type GroupByMode = 'class' | 'sector'
type PieView = 'asset' | 'class' | 'sector'

const CLASS_COLORS: Record<string, string> = {
  'Ações Nacionais': 'var(--color-primary)',
  'Ações Internacionais': 'var(--color-income)',
  'Fundos Imobiliários': 'var(--color-balance)',
  'ETFs': 'var(--color-text-primary)',
  'Criptoativos': 'var(--color-income-strong)',
  'Renda Fixa': 'var(--color-primary-strong)',
  'Saldo em Caixa': 'var(--color-text-secondary)',
  'Outros': 'var(--color-text-secondary)',
}

export default function AssetAnalyticsCard({
  positions,
  cashValue,
  totalValue,
  groupTargets,
  transactions = [],
  assetPieData = [],
  classPieData = [],
  sectorPieData = [],
  onAssetSliceClick,
}: AssetAnalyticsCardProps) {
  const [mainViewMode, setMainViewMode] = useState<MainViewMode>('allocation')
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('class')
  const [pieView, setPieView] = useState<PieView>('class')
  const [benchmarkReturns, setBenchmarkReturns] = useState<Record<string, number>>({})

  // Buscar benchmarks quando a visão de performance estiver selecionada
  useEffect(() => {
    if (mainViewMode !== 'performance') return

    const endDate = new Date().toISOString().slice(0, 10)
    let earliestTxDate = endDate
    for (const tx of transactions) {
      if (tx.date && tx.date < earliestTxDate) {
        earliestTxDate = tx.date
      }
    }

    const oneYearAgo = new Date(endDate)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)
    const startDate = earliestTxDate < oneYearAgoStr ? earliestTxDate : oneYearAgoStr

    let cancelled = false
    fetchBenchmarkReturns(startDate, endDate)
      .then((returns) => {
        if (!cancelled) {
          setBenchmarkReturns(returns)
        }
      })
      .catch((err) => logger.warn('[AssetAnalyticsCard] Erro ao buscar benchmarks:', err))

    return () => {
      cancelled = true
    }
  }, [mainViewMode, transactions])

  // Dados de Alocação (Barras)
  const allocationData = useMemo(() => {
    const map = new Map<string, number>()
    const isClass = groupByMode === 'class'

    positions.forEach((pos) => {
      if (pos.pricing_mode === 'cash') return
      const groupName = (isClass ? pos.asset_class : pos.sector) || 'Outros'
      const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
      map.set(groupName, (map.get(groupName) || 0) + valueInBrl)
    })

    if (isClass && cashValue > 0) {
      map.set('Saldo em Caixa', cashValue)
    }

    const totalCalculated = Array.from(map.values()).reduce((sum, v) => sum + v, 0)
    const divisor = totalValue > 0 ? totalValue : totalCalculated > 0 ? totalCalculated : 1

    const list = Array.from(map.entries()).map(([name, val]) => {
      const currentPct = (val / divisor) * 100
      const target = groupTargets.find(
        (t) => t.group_type === groupByMode && t.group_name.trim().toLowerCase() === name.trim().toLowerCase()
      )
      const targetPct = target ? Number(target.target_percentage) : 0

      return {
        name,
        currentValue: val,
        currentPercentage: currentPct,
        targetPercentage: targetPct,
      }
    })

    return list.sort((a, b) => b.currentValue - a.currentValue)
  }, [positions, cashValue, totalValue, groupTargets, groupByMode])

  // Dados de Performance (Com benchmarks)
  const nonCashPositions = useMemo(
    () => positions.filter((p) => p.pricing_mode !== 'cash'),
    [positions]
  )

  const performanceData = useMemo<ClassPerformance[]>(() => {
    const data =
      groupByMode === 'class'
        ? aggregateClassPerformance(nonCashPositions, totalValue)
        : aggregateSectorPerformance(nonCashPositions, totalValue)

    return data.map((item) => {
      const bm = item.benchmark
      let benchmarkYieldPct: number | null = null

      if (bm.ticker === 'CDI') {
        benchmarkYieldPct = benchmarkReturns['CDI'] ?? null
      } else if (benchmarkReturns[bm.ticker] !== undefined) {
        benchmarkYieldPct = benchmarkReturns[bm.ticker]
      }

      return { ...item, benchmarkYieldPct }
    })
  }, [nonCashPositions, totalValue, groupByMode, benchmarkReturns])

  // Dados de Gráfico Pizza
  const availablePieViews: PieView[] = [
    ...(assetPieData.length > 0 ? ['asset' as const] : []),
    ...(classPieData.length > 0 ? ['class' as const] : []),
    ...(sectorPieData.length > 0 ? ['sector' as const] : []),
  ]
  const effectivePieView = availablePieViews.includes(pieView) ? pieView : availablePieViews[0]

  const currentPieData =
    effectivePieView === 'asset'
      ? assetPieData
      : effectivePieView === 'class'
      ? classPieData
      : sectorPieData

  const handlePieSliceClick = (sliceName: string) => {
    if (effectivePieView === 'asset' && onAssetSliceClick && sliceName !== 'Outros') {
      onAssetSliceClick(sliceName)
    }
  }

  const pieViewOptions = availablePieViews.map((m) => ({
    value: m,
    label: m === 'asset' ? 'Por Ativo' : m === 'class' ? 'Por Classe' : 'Por Setor',
  }))

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-5 text-left">
      {/* Cabeçalho Limpo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-glass/40 pb-4">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">
            Análise da Carteira
          </h4>
          <p className="text-[10px] text-secondary font-medium">
            {mainViewMode === 'allocation'
              ? `Distribuição e metas por ${groupByMode === 'class' ? 'classe' : 'setor'}`
              : mainViewMode === 'performance'
              ? `Rentabilidade acumulada por ${groupByMode === 'class' ? 'classe' : 'setor'} vs benchmarks`
              : 'Visão gráfica da distribuição dos ativos'}
          </p>
        </div>

        {/* Alternadores de Visão */}
        <div className="flex flex-wrap items-center gap-2">
          {mainViewMode !== 'pie' && (
            <ViewModeToggle
              options={[
                { value: 'class', label: 'Classes' },
                { value: 'sector', label: 'Setores' },
              ]}
              value={groupByMode}
              onChange={(v) => setGroupByMode(v as GroupByMode)}
              size="sm"
            />
          )}

          {mainViewMode === 'pie' && pieViewOptions.length > 1 && (
            <ViewModeToggle
              options={pieViewOptions as [typeof pieViewOptions[0], ...typeof pieViewOptions[0][]]}
              value={effectivePieView}
              onChange={(v) => setPieView(v as PieView)}
              size="sm"
            />
          )}

          <ViewModeToggle
            options={[
              { value: 'allocation', label: 'Alocação' },
              { value: 'performance', label: 'Performance' },
              { value: 'pie', label: 'Gráfico' },
            ]}
            value={mainViewMode}
            onChange={(v) => setMainViewMode(v as MainViewMode)}
            size="sm"
          />
        </div>
      </div>

      {/* MODO 1: Alocação & Metas (Barras) */}
      {mainViewMode === 'allocation' && (
        <div className="space-y-4">
          {allocationData.length === 0 ? (
            <div className="py-8 text-center text-xs font-semibold text-secondary">
              Nenhuma posição ativa para exibir.
            </div>
          ) : (
            allocationData.map((item) => {
              const color = CLASS_COLORS[item.name] || 'var(--color-primary)'
              const hasTarget = item.targetPercentage > 0
              const isOver = hasTarget && item.currentPercentage > item.targetPercentage + 3
              const isUnder = hasTarget && item.targetPercentage > item.currentPercentage + 3

              return (
                <div key={item.name} className="space-y-2 hover:bg-glass/5 p-2 rounded-xl transition-all">
                  <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-xs font-semibold">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-extrabold text-primary truncate">{item.name}</span>
                      <span className="font-mono text-secondary shrink-0">({formatCurrency(item.currentValue)})</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-primary font-bold">
                        {formatPercentBR(item.currentPercentage, 1)}
                      </span>
                      {hasTarget && (
                        <span className="text-[10px] text-secondary">
                          / Alvo: {formatPercentBR(item.targetPercentage, 1)}
                        </span>
                      )}
                      {hasTarget && (
                        <span
                          className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                            isOver
                              ? 'bg-glass/10 text-secondary'
                              : isUnder
                              ? 'bg-primary/10 text-primary'
                              : 'bg-income/10 text-income'
                          }`}
                        >
                          {isOver ? 'Excesso' : isUnder ? 'Abaixo' : 'Alinhado'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-2 bg-glass/10 rounded-full overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: color,
                        width: `${Math.min(100, item.currentPercentage)}%`,
                      }}
                    />
                    {hasTarget && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-glass-strong border-l border-bg-primary"
                        style={{ left: `${Math.min(100, item.targetPercentage)}%` }}
                        title={`Meta: ${item.targetPercentage}%`}
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* MODO 2: Performance vs Benchmarks */}
      {mainViewMode === 'performance' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {performanceData.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs font-semibold text-secondary">
              Nenhuma posição ativa para analisar rentabilidade.
            </div>
          ) : (
            performanceData.map((item) => {
              const isPositive = item.grossYieldPct >= 0
              const hasBenchmark = item.benchmarkYieldPct !== null
              const vsBenchmark =
                hasBenchmark && item.benchmarkYieldPct !== null
                  ? item.grossYieldPct - item.benchmarkYieldPct
                  : null
              const beatingBenchmark = vsBenchmark !== null && vsBenchmark >= 0

              return (
                <div
                  key={item.name}
                  className="p-4 rounded-2xl border border-glass/30 bg-glass/5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-black text-primary uppercase tracking-wider block truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-secondary font-mono font-medium">
                        {formatPercentBR(item.percentage, 1)} da carteira
                      </span>
                    </div>
                    <span className="text-xs font-black text-primary font-mono shrink-0">
                      {formatCurrency(item.totalValue)}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-secondary font-bold">Rentabilidade</span>
                      <span
                        className={`font-black font-mono flex items-center gap-1 ${
                          isPositive ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {formatSignedPercentBR(item.grossYieldPct, 2)}
                      </span>
                    </div>

                    {hasBenchmark && item.benchmark.description && (
                      <div className="flex items-center justify-between">
                        <span className="text-secondary font-bold">
                          vs {item.benchmark.description}
                        </span>
                        <span
                          className={`font-black font-mono flex items-center gap-1 ${
                            beatingBenchmark ? 'text-income' : 'text-expense'
                          }`}
                        >
                          {beatingBenchmark ? (
                            <TrendingUp size={11} />
                          ) : vsBenchmark !== null && vsBenchmark < 0 ? (
                            <TrendingDown size={11} />
                          ) : (
                            <Minus size={11} />
                          )}
                          {vsBenchmark !== null ? formatSignedPercentBR(vsBenchmark, 2) : 'N/A'}
                        </span>
                      </div>
                    )}

                    {item.accumulatedDividends > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-glass/20">
                        <span className="text-secondary font-bold">Proventos</span>
                        <span className="font-black font-mono text-income">
                          {formatCurrency(item.accumulatedDividends)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* MODO 3: Gráfico Pizza */}
      {mainViewMode === 'pie' && (
        <div className="pt-2">
          {currentPieData.length > 0 ? (
            <PortfolioPieChart
              data={currentPieData}
              innerRadius={65}
              outerRadius={105}
              onSliceClick={handlePieSliceClick}
            />
          ) : (
            <div className="py-8 text-center text-xs font-semibold text-secondary">
              Nenhum dado disponível para exibir no gráfico.
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
