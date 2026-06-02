import Card from '@/components/Card'
import { Shield, TrendingUp, Percent, Gauge } from 'lucide-react'
import { PerformanceMetrics } from '@/services/investmentEngine'
import { formatNumberBR } from '@/utils/format'

interface PerformanceMetricsCardProps {
  metrics: PerformanceMetrics
}

export default function PerformanceMetricsCard({ metrics }: PerformanceMetricsCardProps) {
  const { sharpe_ratio, beta_ibov, beta_sp500, volatility_monthly, return_monthly_avg } = metrics

  // Sharpe interpretation
  let sharpeInterpretation = 'Neutro'
  let sharpeColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20'
  let sharpeGaugeColor = 'rgb(245, 158, 11)'
  if (sharpe_ratio >= 2.0) {
    sharpeInterpretation = 'Excelente'
    sharpeColor = 'text-teal-500 bg-teal-500/10 border-teal-500/20'
    sharpeGaugeColor = 'rgb(20, 184, 166)'
  } else if (sharpe_ratio >= 1.0) {
    sharpeInterpretation = 'Muito Atrativo'
    sharpeColor = 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
    sharpeGaugeColor = 'rgb(99, 102, 241)'
  } else if (sharpe_ratio > 0) {
    sharpeInterpretation = 'Moderado'
    sharpeColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    sharpeGaugeColor = 'rgb(16, 185, 129)'
  } else {
    sharpeInterpretation = 'Subtítulo/Abaixo CDI'
    sharpeColor = 'text-red-500 bg-red-500/10 border-red-500/20'
    sharpeGaugeColor = 'rgb(239, 68, 68)'
  }

  // Calculate SVG gauge stroke dashoffset
  // Sharpe normalizado de -1.0 a 3.0 para a barra
  const minSharpe = -1.0
  const maxSharpe = 3.0
  const normalizedSharpe = Math.max(minSharpe, Math.min(maxSharpe, sharpe_ratio))
  const percentage = ((normalizedSharpe - minSharpe) / (maxSharpe - minSharpe)) * 100

  // Circular gauge config
  const radius = 35
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <Card className="p-5 flex flex-col justify-between shadow-sm border border-border/40 text-left h-full">
      <div>
        <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
          <Gauge size={16} className="text-indigo-500" />
          Indicadores de Performance e Risco
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center mb-4">
          {/* Sharpe Gauge */}
          <div className="flex flex-col items-center justify-center p-3 bg-muted/20 border border-border/30 rounded-xl">
            <span className="text-[10px] uppercase font-extrabold text-secondary tracking-wider mb-2 font-sans">
              Índice Sharpe
            </span>
            <div className="relative flex items-center justify-center h-20 w-20">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="var(--color-border, rgb(51, 65, 85))"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  opacity={0.3}
                />
                {/* Foreground circle */}
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke={sharpeGaugeColor}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-lg font-bold text-primary font-mono block leading-none">
                  {formatNumberBR(sharpe_ratio, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-secondary font-sans">Sharpe</span>
              </div>
            </div>
            <div className={`mt-2.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border ${sharpeColor}`}>
              {sharpeInterpretation}
            </div>
          </div>

          {/* Core Metrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-muted/10 border border-border/10 rounded-lg">
              <div className="flex items-center gap-1.5 text-secondary">
                <Percent size={13} className="text-indigo-500" />
                <span className="text-xs font-semibold font-sans">Volatilidade Mensal</span>
              </div>
              <span className="text-xs font-bold text-primary font-mono">
                {formatNumberBR(volatility_monthly, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/10 border border-border/10 rounded-lg">
              <div className="flex items-center gap-1.5 text-secondary">
                <TrendingUp size={13} className="text-emerald-500" />
                <span className="text-xs font-semibold font-sans">Retorno Médio Mensal</span>
              </div>
              <span className="text-xs font-bold text-primary font-mono">
                {formatNumberBR(return_monthly_avg, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </span>
            </div>
          </div>
        </div>

        {/* Beta Indicators */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
          <div className="p-2.5 bg-muted/20 border border-border/30 rounded-xl text-center">
            <span className="text-[9px] uppercase font-bold text-secondary tracking-wider block mb-0.5">
              Beta vs IBOV
            </span>
            <span className="text-sm font-bold text-primary font-mono">
              {formatNumberBR(beta_ibov, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[8px] text-secondary block font-sans mt-0.5">
              {beta_ibov > 1 ? 'Mais volátil que IBOV' : 'Mais defensivo que IBOV'}
            </span>
          </div>

          <div className="p-2.5 bg-muted/20 border border-border/30 rounded-xl text-center">
            <span className="text-[9px] uppercase font-bold text-secondary tracking-wider block mb-0.5">
              Beta vs S&P 500
            </span>
            <span className="text-sm font-bold text-primary font-mono">
              {formatNumberBR(beta_sp500, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[8px] text-secondary block font-sans mt-0.5">
              {beta_sp500 > 1 ? 'Mais volátil que S&P 500' : 'Mais defensivo que S&P'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
        {metrics.data_source === 'insufficient' && (
          <p className="text-[10px] text-secondary italic font-sans leading-relaxed">
            Histórico insuficiente para métricas confiáveis. Execute fechamentos mensais na carteira.
          </p>
        )}
        {metrics.data_source === 'share_history' && (
          <p className="text-[10px] text-secondary italic font-sans leading-relaxed">
            Beta calculado com benchmarks de referência simplificados; retornos derivados da série de cotas diária.
          </p>
        )}
        {metrics.data_source === 'snapshots' && (
          <p className="text-[10px] text-secondary italic font-sans leading-relaxed">
            Retornos mensais a partir de fechamentos oficiais da carteira; Beta ainda usa benchmarks de referência.
          </p>
        )}
        <div className="flex items-start gap-2 text-[10px] text-secondary italic font-sans leading-relaxed">
          <Shield size={14} className="shrink-0 text-indigo-500 mt-0.5" />
          <span>
            {sharpe_ratio >= 1.0
              ? 'A carteira tem demonstrado excelente retorno ajustado ao risco histórico.'
              : 'Recomenda-se diversificar classes de ativos para mitigar volatilidade e melhorar o Sharpe.'}
          </span>
        </div>
      </div>
    </Card>
  )
}
