import { useMemo, useState, useEffect } from 'react'
import Card from '@/components/Card'
import { formatCurrency, formatPercentBR, formatSignedPercentBR } from '@/utils/format'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import {
  aggregateClassPerformance,
  aggregateSectorPerformance,
  fetchBenchmarkReturns,
  type ClassPerformance,
} from '@/utils/portfolioBenchmarks'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const STORAGE_KEY = 'portfolio_class_view_mode'

interface ClassPerformanceCardProps {
  positions: ValuedPosition[]
  totalValue: number
}

type ViewMode = 'class' | 'sector'

export default function ClassPerformanceCard({
  positions,
  totalValue,
}: ClassPerformanceCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return saved === 'class' || saved === 'sector' ? saved : 'class'
  })
  const [benchmarkReturns, setBenchmarkReturns] = useState<Record<string, number>>({})

  // Persistir escolha
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode)
  }, [viewMode])

  // Buscar retornos reais de benchmarks
  useEffect(() => {
    const endDate = new Date().toISOString().slice(0, 10)
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    let cancelled = false

    fetchBenchmarkReturns(startDate, endDate)
      .then((returns) => {
        if (!cancelled) {
          setBenchmarkReturns(returns)
        }
      })
      .catch((err) => console.warn('[ClassPerformanceCard] Erro ao buscar benchmarks:', err))

    return () => { cancelled = true }
  }, []) // só busca uma vez na montagem

  const performanceData = useMemo<ClassPerformance[]>(() => {
    const data = viewMode === 'class'
      ? aggregateClassPerformance(positions, totalValue)
      : aggregateSectorPerformance(positions, totalValue)

    // Injetar retornos reais de benchmarks
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
  }, [positions, totalValue, viewMode, benchmarkReturns])

  if (performanceData.length === 0) return null

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 space-y-4 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-glass/40 pb-3">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">
            Rentabilidade por {viewMode === 'class' ? 'Classe' : 'Setor'}
          </h4>
          <p className="text-[10px] text-secondary font-medium">
            Performance consolidada vs. benchmark de referência
          </p>
        </div>
        <div className="flex gap-1 bg-glass/10 p-0.5 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setViewMode('class')}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
              viewMode === 'class'
                ? 'bg-glass/20 text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Classes
          </button>
          <button
            type="button"
            onClick={() => setViewMode('sector')}
            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${
              viewMode === 'sector'
                ? 'bg-glass/20 text-primary shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Setores
          </button>
        </div>
      </div>

      {/* Grid de cards de performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {performanceData.map((item) => {
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
              className="p-4 rounded-2xl border border-glass/30 bg-glass/5 hover:border-glass hover:bg-glass/10 transition-all duration-200 space-y-3"
            >
              {/* Nome e valor */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-black text-primary uppercase tracking-wider block truncate">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-secondary font-medium font-mono">
                    {formatPercentBR(item.percentage, 1)} da carteira
                  </span>
                </div>
                <span className="text-xs font-black text-primary font-mono shrink-0">
                  {formatCurrency(item.totalValue)}
                </span>
              </div>

              {/* Rentabilidade */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
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

                {/* Benchmark */}
                {hasBenchmark && item.benchmark.description && (
                  <div className="flex items-center justify-between text-[10px]">
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
                      {vsBenchmark !== null
                        ? formatSignedPercentBR(vsBenchmark, 2)
                        : 'N/A'}
                    </span>
                  </div>
                )}

                {/* Proventos */}
                {item.accumulatedDividends > 0 && (
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-glass/20">
                    <span className="text-secondary font-bold">Proventos acumulados</span>
                    <span className="font-black font-mono text-income">
                      {formatCurrency(item.accumulatedDividends)}
                    </span>
                  </div>
                )}
              </div>

              {/* Barra de performance vs benchmark */}
              {hasBenchmark && vsBenchmark !== null && (
                <div className="pt-1">
                  <div className="w-full h-1.5 bg-glass/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        beatingBenchmark ? 'bg-income' : 'bg-expense'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.abs(vsBenchmark) * 2)}%`,
                        marginLeft: beatingBenchmark ? '0%' : 'auto',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-glass/40 pt-3 text-[8px] font-semibold text-secondary text-center">
        Benchmarks de referência: IBOV (ações BR), IFIX (FIIs), CDI (renda fixa), S&P 500 (internacionais), BTC (cripto)
      </div>
    </Card>
  )
}
