import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  formatCurrency,
  formatPercentBR,
  formatSignedPercentBR,
  formatDate,
  formatChartYAxisCurrency,
} from '@/utils/format'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { TrendingUp, Calendar, Info } from 'lucide-react'

interface ShareHistoryPoint {
  date: string
  shareValue: number
  totalValue?: number
  cashValue?: number
  investedValue?: number
}

interface InvestmentEvolutionChartProps {
  shareHistoryData: ShareHistoryPoint[]
}

type PeriodType = '3M' | '6M' | '12M' | 'ALL'
type MetricType = 'portfolio' | 'yield'

interface CustomTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload as {
    date: string
    formattedDate: string
    totalValue: number
    investedValue: number
    cashValue: number
    yieldPct: number
    displayYieldPct: number
  }

  const isPositive = data.displayYieldPct >= 0

  return (
    <div className="surface-glass-strong border border-glass p-3 rounded-2xl shadow-xl backdrop-blur-md text-left min-w-[200px] flex flex-col gap-1.5 font-sans">
      <p className="text-[10px] font-extrabold text-secondary uppercase tracking-wider border-b border-glass pb-1 mb-1 font-mono">
        {data.formattedDate}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-secondary">Patrimônio Total:</span>
          <span className="font-bold text-primary font-mono">
            {formatCurrency(data.totalValue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-secondary">Valor Investido:</span>
          <span className="font-semibold text-primary/80 font-mono">
            {formatCurrency(data.investedValue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="text-secondary">Saldo Caixa:</span>
          <span className="font-semibold text-primary/80 font-mono">
            {formatCurrency(data.cashValue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-xs pt-1 border-t border-glass/40">
          <span className="text-secondary">Rentabilidade:</span>
          <span className={`font-black font-mono ${isPositive ? 'text-income' : 'text-expense'}`}>
            {formatSignedPercentBR(data.displayYieldPct)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function InvestmentEvolutionChart({ shareHistoryData }: InvestmentEvolutionChartProps) {
  const [metric, setMetric] = useState<MetricType>('portfolio')
  const [period, setPeriod] = useState<PeriodType>('ALL')

  const formattedData = useMemo(() => {
    if (!shareHistoryData || shareHistoryData.length === 0) return []
    const initialShareValue = shareHistoryData[0].shareValue || 1.0
    return shareHistoryData.map((p) => {
      const yieldPct = ((p.shareValue - initialShareValue) / initialShareValue) * 100
      return {
        ...p,
        yieldPct,
        formattedDate: formatDate(p.date),
        totalValue: p.totalValue ?? 0,
        investedValue: p.investedValue ?? 0,
        cashValue: p.cashValue ?? 0,
      }
    })
  }, [shareHistoryData])

  const filteredData = useMemo(() => {
    if (period === 'ALL' || formattedData.length === 0) return formattedData

    const limitDate = new Date()
    if (period === '3M') limitDate.setMonth(limitDate.getMonth() - 3)
    else if (period === '6M') limitDate.setMonth(limitDate.getMonth() - 6)
    else if (period === '12M') limitDate.setMonth(limitDate.getMonth() - 12)

    const limitStr = limitDate.toISOString().split('T')[0]
    const filtered = formattedData.filter((p) => p.date >= limitStr)
    
    // Se o filtro retornar vazio (ex: carteira muito recente), fallback para tudo
    return filtered.length > 0 ? filtered : formattedData
  }, [formattedData, period])

  const chartData = useMemo(() => {
    if (filteredData.length === 0) return []
    const periodStartShareValue = filteredData[0].shareValue || 1.0
    return filteredData.map((p) => {
      const displayYieldPct = ((p.shareValue - periodStartShareValue) / periodStartShareValue) * 100
      return {
        ...p,
        displayYieldPct,
      }
    })
  }, [filteredData])

  if (formattedData.length === 0) {
    return (
      <Card className="p-8 text-center text-secondary italic text-xs">
        Histórico de rentabilidade indisponível. Cadastre transações para iniciar o acompanhamento.
      </Card>
    )
  }

  // Obter o percentual acumulado do período filtrado
  const currentPeriodYield = chartData.length > 0 
    ? chartData[chartData.length - 1].displayYieldPct
    : 0

  const isYieldPositive = currentPeriodYield >= 0

  return (
    <Card className="p-4 lg:p-6 text-left relative overflow-hidden flex flex-col gap-4">
      {/* Elemento decorativo de fundo */}
      <div className="absolute right-0 top-0 w-36 h-36 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header com os controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-primary/5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-primary/10 shrink-0">
            <TrendingUp size={16} className="text-primary" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-primary">
              Desempenho da Carteira
            </h4>
            <p className="text-[9px] text-secondary font-semibold font-mono flex items-center gap-1 mt-0.5">
              <Calendar size={10} />
              {chartData[0] ? formatDate(chartData[0].date) : ''} até {chartData[chartData.length - 1] ? formatDate(chartData[chartData.length - 1].date) : ''}
            </p>
          </div>
        </div>

        {/* Controles de Visualização */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Métrica */}
          <div className="flex bg-secondary/30 p-0.5 rounded-xl border border-glass">
            <Button
              size="xs"
              variant={metric === 'portfolio' ? 'primary' : 'ghost'}
              onClick={() => setMetric('portfolio')}
              className={`font-black rounded-lg text-[9px] uppercase tracking-wider px-2.5 py-1 ${
                metric === 'portfolio' ? 'shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              Patrimônio
            </Button>
            <Button
              size="xs"
              variant={metric === 'yield' ? 'primary' : 'ghost'}
              onClick={() => setMetric('yield')}
              className={`font-black rounded-lg text-[9px] uppercase tracking-wider px-2.5 py-1 ${
                metric === 'yield' ? 'shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              Rentabilidade
            </Button>
          </div>

          {/* Período */}
          <div className="flex bg-secondary/30 p-0.5 rounded-xl border border-glass">
            {(['3M', '6M', '12M', 'ALL'] as const).map((p) => (
              <Button
                key={p}
                size="xs"
                variant={period === p ? 'primary' : 'ghost'}
                onClick={() => setPeriod(p)}
                className={`font-black rounded-lg text-[9px] uppercase tracking-wider px-2 py-1 ${
                  period === p ? 'shadow-sm' : 'text-secondary hover:text-primary'
                }`}
              >
                {p === 'ALL' ? 'Tudo' : p}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Resumo dinâmico de rentabilidade do período */}
      <div className="flex items-baseline justify-between relative z-10 px-1">
        <div>
          <span className="text-[10px] uppercase font-extrabold text-secondary block">
            {metric === 'portfolio' ? 'Patrimônio Atual' : 'Rentabilidade no Período'}
          </span>
          <span className="text-xl font-black text-primary font-mono leading-none mt-1 block">
            {metric === 'portfolio'
              ? formatCurrency(chartData[chartData.length - 1]?.totalValue || 0)
              : formatSignedPercentBR(currentPeriodYield)}
          </span>
        </div>
        
        {metric === 'portfolio' && (
          <div className="text-right">
            <span className="text-[10px] uppercase font-extrabold text-secondary block">
              Variação Relativa
            </span>
            <span className={`text-xs font-extrabold font-mono mt-1 block ${isYieldPositive ? 'text-income' : 'text-expense'}`}>
              {formatSignedPercentBR(currentPeriodYield)}
            </span>
          </div>
        )}
      </div>

      {/* Área do Gráfico */}
      <div className="h-64 sm:h-72 w-full relative z-10 mt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={chartData} margin={{ top: 10, bottom: 5, left: -20, right: 5 }}>
            <defs>
              <linearGradient id="chartEvolutionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.12} vertical={false} />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 9, fill: 'var(--color-text-secondary)', fontWeight: 'bold' }}
              axisLine={false}
              tickLine={false}
              minTickGap={45}
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'var(--color-text-secondary)', fontWeight: 'bold' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={
                metric === 'portfolio'
                  ? (v) => formatChartYAxisCurrency(v)
                  : (v) => `${formatPercentBR(v, 0)}`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={metric === 'portfolio' ? 'totalValue' : 'displayYieldPct'}
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#chartEvolutionGrad)"
              dot={{ fill: 'var(--color-primary)', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-secondary/15 rounded-xl border border-glass/40 text-[9px] text-secondary leading-snug">
        <Info size={11} className="text-secondary shrink-0" />
        <span>
          * Os dados históricos são calculados dinamicamente com base nas transações e cotações diárias registradas no sistema.
        </span>
      </div>
    </Card>
  )
}
