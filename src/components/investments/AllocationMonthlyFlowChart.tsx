import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import Card from '@/components/Card'
import { chartAnimProps } from '@/types/recharts'
import {
  ChartTooltip,
  InteractiveChartLegend,
  formatChartAxisTick,
} from '@/components/reports/reportsChartShared'
import { formatCurrency } from '@/utils/format'
import type { calculateShareHistory } from '@/services/investmentEngine'

type ShareHistoryItem = ReturnType<typeof calculateShareHistory>['shareHistory'][number]

interface AllocationMonthlyFlowChartProps {
  shareHistory: ShareHistoryItem[]
  chartPalette: string[]
  initialConsolidationView?: 'portfolio' | 'class'
}

export default function AllocationMonthlyFlowChart({
  shareHistory,
  chartPalette,
  initialConsolidationView = 'portfolio',
}: AllocationMonthlyFlowChartProps) {
  const [viewMode, setViewMode] = useState<'portfolio' | 'class'>(
    initialConsolidationView === 'class' ? 'class' : 'portfolio'
  )
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([])

  const animProps = useMemo(() => chartAnimProps(), [])

  // 1. Agrupar dados diários e preencher as lacunas mensais (gap filling)
  const monthlySnapshots = useMemo(() => {
    if (shareHistory.length === 0) return []

    const firstDate = shareHistory[0].date
    const lastDate = shareHistory[shareHistory.length - 1].date

    // Gerar todos os meses no intervalo (yyyy-MM)
    const monthsList: string[] = []
    const currentDate = new Date(firstDate + 'T00:00:00Z')
    const endDate = new Date(lastDate + 'T00:00:00Z')

    while (
      currentDate <= endDate ||
      (currentDate.getFullYear() === endDate.getFullYear() &&
        currentDate.getMonth() === endDate.getMonth())
    ) {
      const yyyy = currentDate.getFullYear()
      const mm = String(currentDate.getMonth() + 1).padStart(2, '0')
      monthsList.push(`${yyyy}-${mm}`)
      currentDate.setMonth(currentDate.getMonth() + 1)
    }

    // Mapear cada mês para a última entrada de shareHistory correspondente ou anterior
    return monthsList.map((month) => {
      const lastEntryPriorOrEqual = [...shareHistory]
        .reverse()
        .find((entry) => entry.date.slice(0, 7) <= month)

      const formattedMonth = month.split('-').reverse().join('/')

      if (!lastEntryPriorOrEqual) {
        return {
          month,
          label: formattedMonth,
          classes: {} as Record<string, { totalValue: number; yieldPct: number }>,
          totalValue: 0,
          investedCapital: 0,
        }
      }

      return {
        month,
        label: formattedMonth,
        classes: lastEntryPriorOrEqual.classes || {},
        totalValue: lastEntryPriorOrEqual.totalValue || 0,
        investedCapital: lastEntryPriorOrEqual.investedCapital || 0,
      }
    })
  }, [shareHistory])

  // 2. Extrair a lista de todas as séries (classes/consolidado) presentes no histórico
  const series = useMemo(() => {
    if (viewMode === 'portfolio') {
      return [
        {
          key: 'Total da Carteira',
          name: 'Total da Carteira',
          color: 'var(--ds-accent, var(--color-primary))',
        },
        {
          key: 'Valor Investido',
          name: 'Valor Investido',
          color: '#64748b',
        },
      ]
    }

    const uniqueNames = new Set<string>()
    monthlySnapshots.forEach((snapshot) => {
      const groupsObj = snapshot.classes
      Object.keys(groupsObj).forEach((name) => {
        if (name && name !== 'Outros' && name !== 'Não classificado') {
          uniqueNames.add(name)
        }
      })
    })

    // Adiciona categorias neutras no final para garantir ordem visual previsível
    monthlySnapshots.forEach((snapshot) => {
      const groupsObj = snapshot.classes
      if (groupsObj['Não classificado']) uniqueNames.add('Não classificado')
      if (groupsObj['Outros']) uniqueNames.add('Outros')
    })

    return Array.from(uniqueNames).map((name, index) => ({
      key: name,
      name,
      color: chartPalette[index % chartPalette.length],
    }))
  }, [monthlySnapshots, viewMode, chartPalette])

  // 3. Formatar dados compatíveis com a Recharts
  const chartData = useMemo(() => {
    return monthlySnapshots.map((snapshot) => {
      const dataObj: Record<string, string | number> = {
        month: snapshot.label,
      }

      if (viewMode === 'portfolio') {
        dataObj['Total da Carteira'] = snapshot.totalValue
        dataObj['Valor Investido'] = snapshot.investedCapital
      } else {
        const groupsObj = snapshot.classes

        series.forEach((s) => {
          const groupInfo = groupsObj[s.key]
          if (groupInfo) {
            dataObj[s.key] = groupInfo.totalValue
          } else {
            dataObj[s.key] = 0
          }
        })
      }

      return dataObj
    })
  }, [monthlySnapshots, viewMode, series])

  // 4. Tratamento do toggle de séries
  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  // 5. Configurar formatadores específicos por métrica
  const yAxisFormatter = (val: number) => {
    return formatChartAxisTick(val)
  }

  const tooltipValueFormatter = (val: number) => {
    return formatCurrency(val)
  }

  if (shareHistory.length === 0) {
    return null
  }

  return (
    <Card className="p-4 lg:p-6 text-left space-y-4">
      {/* Cabeçalho */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 pb-2 border-b border-primary/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-balance/10 shrink-0 text-balance">
            <LineChartIcon size={15} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-primary">
              Evolução Patrimonial por {viewMode === 'portfolio' ? 'Carteira' : 'Classe'}
            </h4>
            <p className="text-[10px] text-secondary font-medium leading-none mt-0.5 hidden sm:block">
              Patrimônio total vs capital investido acumulado
            </p>
          </div>
        </div>

        {/* Seletores premium */}
        <div className="flex flex-wrap items-center gap-2 select-none">
          {/* Consolidado vs Classes */}
          <div className="flex items-center bg-secondary/50 rounded-xl p-0.5 w-44 h-[32px]">
            <button
              type="button"
              onClick={() => {
                setViewMode('portfolio')
                setHiddenSeries([])
              }}
              className={`flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all ${
                viewMode === 'portfolio'
                  ? 'bg-glass-strong text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Consolidado
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('class')
                setHiddenSeries([])
              }}
              className={`flex-1 text-[10px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all ${
                viewMode === 'class'
                  ? 'bg-glass-strong text-primary shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Classes
            </button>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="w-full">
        {series.length === 0 ? (
          <p className="text-xs text-secondary italic text-center py-12">
            Sem dados consolidados no período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                strokeOpacity={0.1}
              />
              <XAxis
                dataKey="month"
                stroke="var(--color-text-secondary)"
                fontSize={11}
                tick={{ fill: 'var(--color-text-secondary)' }}
                minTickGap={30}
              />
              <YAxis
                stroke="var(--color-text-secondary)"
                fontSize={11}
                tick={{ fill: 'var(--color-text-secondary)' }}
                tickFormatter={yAxisFormatter}
              />
              <Tooltip content={<ChartTooltip formatValue={tooltipValueFormatter} />} />
              <Legend
                content={(props) => (
                  <InteractiveChartLegend
                    payload={props.payload}
                    hiddenSeries={hiddenSeries}
                    onToggle={toggleSeries}
                  />
                )}
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={s.key === 'Valor Investido' ? false : { r: 3, strokeWidth: 1 }}
                  activeDot={s.key === 'Valor Investido' ? false : { r: 5 }}
                  strokeDasharray={s.key === 'Valor Investido' ? '4 4' : undefined}
                  hide={hiddenSeries.includes(s.key)}
                  {...animProps}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
