import { AlertCircle, Clock, CreditCard as CreditCardIcon, CheckCircle2, Lock } from 'lucide-react'
import InfoTooltip from '@/components/InfoTooltip'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'
import type { CreditCard } from '@/types'
import { ensureHexColor } from '@/utils/colorValue'
import { formatCurrency, formatDate } from '@/utils/format'
import { Z_INDEX } from '@/constants/zIndex'

export type MonthlyCycleRow = {
  id: string
  credit_card_id: string
  competence: string
  closing_day: number
  due_day: number
}

interface CreditCardTimelineProps {
  card: CreditCard
  currentMonth: string
  totalPrevisto: number
  totalPago: number
  saldoAberto: number
  monthlyCycle: MonthlyCycleRow | undefined
  baseExpense?: number
}

function getSafeDate(year: number, month: number, day: number) {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  const clampedDay = Math.min(day, lastDayOfMonth)
  return new Date(year, month, clampedDay)
}

export default function CreditCardTimeline({
  card,
  currentMonth,
  totalPrevisto,
  totalPago,
  saldoAberto,
  monthlyCycle,
  baseExpense,
}: CreditCardTimelineProps) {
  const [yearStr, monthStr] = currentMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // 0-based for JS Date

  const effectiveClosingDay = monthlyCycle?.closing_day || card.closing_day
  const effectiveDueDay = monthlyCycle?.due_day || card.due_day

  const dueDate = getSafeDate(year, month, effectiveDueDay)

  let closingDate = getSafeDate(year, month, effectiveClosingDay)
  let startDate = getSafeDate(year, month - 1, effectiveClosingDay + 1)

  if (effectiveClosingDay >= effectiveDueDay) {
    closingDate = getSafeDate(year, month - 1, effectiveClosingDay)
    startDate = getSafeDate(year, month - 2, effectiveClosingDay + 1)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let status: 'paid' | 'empty' | 'overdue' | 'near_due' | 'closed' | 'open' = 'open'

  if (totalPrevisto <= 0.009) {
    status = 'empty'
  } else if (saldoAberto <= 0.009) {
    status = 'paid'
  } else if (today.getTime() > dueDate.getTime()) {
    status = 'overdue'
  } else {
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays <= 3) {
      status = 'near_due'
    } else if (today.getTime() < closingDate.getTime()) {
      status = 'open'
    } else {
      status = 'closed'
    }
  }

  const themeColor = card.color ? ensureHexColor(card.color) : 'var(--credit-card-default-color)'

  const statusBadgeClass: Record<typeof status, string> = {
    paid: 'bg-income/10 border-income/30 text-income',
    empty: 'bg-secondary border-primary text-secondary',
    overdue: 'bg-expense/10 border-expense/30 text-expense',
    near_due: 'bg-warning/10 border-warning/30 text-warning',
    closed: '',
    open: '',
  }

  const usesThemeAccent = status === 'closed' || status === 'open'
  const themeAccentStyle = usesThemeAccent
    ? {
        backgroundColor: `color-mix(in srgb, ${themeColor} 7%, transparent)`,
        borderColor: `color-mix(in srgb, ${themeColor} 16%, transparent)`,
        color: themeColor,
      }
    : undefined

  const statusBannerClass: Record<typeof status, string> = {
    paid: 'bg-income/5 border-income/20',
    empty: 'bg-secondary/50 border-primary/30',
    overdue: 'bg-expense/5 border-expense/20',
    near_due: 'bg-warning/5 border-warning/20',
    closed: '',
    open: '',
  }

  const themeBannerStyle = usesThemeAccent
    ? {
        backgroundColor: `color-mix(in srgb, ${themeColor} 5%, transparent)`,
        borderColor: `color-mix(in srgb, ${themeColor} 10%, transparent)`,
      }
    : undefined

  const config = {
    paid: {
      label: 'Paga',
      icon: <CheckCircle2 size={13} className="text-income" />,
      message: 'Fatura totalmente paga! Limite restabelecido.',
    },
    empty: {
      label: 'Fatura Zerada',
      icon: <CreditCardIcon size={13} className="text-secondary" />,
      message: 'Nenhum lançamento registrado nesta competência.',
    },
    overdue: {
      label: 'Vencida',
      icon: <AlertCircle size={13} className="text-expense" />,
      message: `ATENÇÃO: Fatura vencida em ${formatDate(dueDate)}. Regularize para evitar juros.`,
    },
    near_due: {
      label: 'Vence em Breve',
      icon: <Clock size={13} className="text-warning" />,
      message: `Atenção: Fatura fecha dia ${formatDate(closingDate)} e vence dia ${formatDate(dueDate)}. Pague logo!`,
    },
    closed: {
      label: 'Fechada',
      icon: <Lock size={13} style={{ color: themeColor }} />,
      message: `Fatura fechada em ${formatDate(closingDate)}. Aguardando pagamento até ${formatDate(dueDate)}.`,
    },
    open: {
      label: 'Em Aberto',
      icon: <CreditCardIcon size={13} style={{ color: themeColor }} />,
      message: `Fatura aberta para compras. Fechamento previsto em ${formatDate(closingDate)}.`,
    },
  }[status]

  let progressPct = 0
  if (status === 'paid') {
    progressPct = 100
  } else if (status === 'empty') {
    progressPct = 0
  } else {
    const tTime = today.getTime()
    const sTime = startDate.getTime()
    const cTime = closingDate.getTime()
    const dTime = dueDate.getTime()

    if (tTime <= sTime) {
      progressPct = 0
    } else if (tTime >= dTime) {
      progressPct = 100
    } else if (tTime < cTime) {
      const range = cTime - sTime
      const pct = range > 0 ? (tTime - sTime) / range : 0
      progressPct = Math.min(50, Math.max(0, pct * 50))
    } else {
      const range = dTime - cTime
      const pct = range > 0 ? (tTime - cTime) / range : 0
      progressPct = Math.min(100, Math.max(50, 50 + pct * 50))
    }
  }

  const containerHoverStyle = {
    '--timeline-halo-color': themeColor,
  } as React.CSSProperties

  const barStyle = {
    width: `${progressPct}%`,
    backgroundColor: themeColor,
  }

  const nodeRingStyle = {
    backgroundColor: themeColor,
    boxShadow: `0 0 0 4px ${themeColor}28`,
    borderColor: 'var(--color-bg-primary)',
  }

  const timelineItems = [
    {
      title: 'Início do Ciclo',
      date: startDate,
      desc: 'Compras começam a contar.',
      metricLabel: 'Previsto',
      metricVal: totalPrevisto,
      extraMetric: baseExpense !== undefined && baseExpense !== totalPrevisto ? baseExpense : undefined,
      isActive: true,
      isLast: false,
    },
    {
      title: 'Fechamento',
      date: closingDate,
      desc: 'Fatura encerrada para compras.',
      metricLabel: 'Pago',
      metricVal: totalPago,
      isActive: progressPct >= 50,
      isLast: false,
    },
    {
      title: 'Vencimento',
      date: dueDate,
      desc: 'Vencimento da fatura.',
      metricLabel: 'Saldo',
      metricVal: saldoAberto,
      isActive: progressPct >= 100,
      isLast: true,
    },
  ]

  return (
    <div
      className="glass-timeline-card p-4 sm:p-5 space-y-4 text-left transition-all duration-300"
      style={containerHoverStyle}
    >
      <div className="flex justify-end">
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all duration-300 ${statusBadgeClass[status]}`}
          style={themeAccentStyle}
        >
          {config.icon}
          {config.label}
        </span>
      </div>

      <div className="hidden sm:block relative pt-20 pb-16 px-20">
        <div className="h-1.5 w-full bg-muted/20 dark:bg-muted/10 rounded-full relative">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={barStyle}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center transition-all duration-500 ${Z_INDEX.CONTENT}`}
            style={progressPct >= 0 ? nodeRingStyle : undefined}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all duration-500 ${Z_INDEX.CONTENT} ${
              progressPct >= 50
                ? 'border-card'
                : 'border-glass bg-background'
            }`}
            style={progressPct >= 50 ? nodeRingStyle : undefined}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all duration-500 ${Z_INDEX.CONTENT} ${
              progressPct >= 100
                ? 'border-card'
                : 'border-glass bg-background'
            }`}
            style={progressPct >= 100 ? nodeRingStyle : undefined}
          />

          <div className="absolute bottom-5 left-0 -translate-x-1/2 flex flex-col items-center w-36 text-center">
            <span className="text-xs font-extrabold text-primary font-sans leading-tight whitespace-nowrap">
              Início do Ciclo
            </span>
            <span className="text-[10px] text-secondary font-bold font-mono mt-0.5">
              ({formatDate(startDate)})
            </span>
            <p className="text-[9px] text-secondary mt-1 leading-normal max-w-[120px]">
              Compras começam a contar.
            </p>
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center w-36 text-center">
            <span className="text-xs font-extrabold text-primary font-sans leading-tight whitespace-nowrap">
              Fechamento
            </span>
            <span className="text-[10px] text-secondary font-bold font-mono mt-0.5">
              ({formatDate(closingDate)})
            </span>
            <p className="text-[9px] text-secondary mt-1 leading-normal max-w-[120px]">
              Fatura encerrada para compras.
            </p>
          </div>

          <div className="absolute bottom-5 left-full -translate-x-1/2 flex flex-col items-center w-36 text-center">
            <span className="text-xs font-extrabold text-primary font-sans leading-tight whitespace-nowrap">
              Vencimento
            </span>
            <span className="text-[10px] text-secondary font-bold font-mono mt-0.5">
              ({formatDate(dueDate)})
            </span>
            <p className="text-[9px] text-secondary mt-1 leading-normal max-w-[120px]">
              Vencimento da fatura.
            </p>
          </div>

          <div className="absolute top-5 left-0 -translate-x-1/2 flex flex-col items-center w-36 text-center select-none">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
              Previsto
            </span>
            <span className="text-sm font-extrabold text-primary font-mono mt-0.5 whitespace-nowrap">
              {formatCurrency(baseExpense !== undefined ? baseExpense : totalPrevisto)}
            </span>
            {baseExpense !== undefined && baseExpense !== totalPrevisto && (
              <span className="text-[9px] text-secondary/60 font-sans flex items-center gap-0.5 justify-center">
                <span>({formatCurrency(totalPrevisto)} no relatório)</span>
                <InfoTooltip
                  content={WEIGHT_TOOLTIPS.billReportValue}
                  iconSize={8}
                />
              </span>
            )}
          </div>

          <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center w-36 text-center select-none">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
              Pago
            </span>
            <span className="text-sm font-extrabold text-income font-mono mt-0.5 whitespace-nowrap">
              {formatCurrency(totalPago)}
            </span>
          </div>

          <div className="absolute top-5 left-full -translate-x-1/2 flex flex-col items-center w-36 text-center select-none">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
              Saldo
            </span>
            <span className={`text-sm font-extrabold font-mono mt-0.5 whitespace-nowrap ${saldoAberto > 0.009 ? 'text-primary' : 'text-secondary'}`}>
              {formatCurrency(saldoAberto)}
            </span>
          </div>
        </div>
      </div>

      <div className="block sm:hidden relative pt-2 pb-2">
        <div className="space-y-0 text-left">
          {timelineItems.map((item, index) => {
            const isItemPaid = item.metricLabel === 'Pago'
            return (
              <div key={item.title + '-' + item.date.toISOString()} className="grid grid-cols-[24px_1fr] gap-x-4">
                {/* Left timeline line and dot */}
                <div className="flex flex-col items-center">
                  {/* Top connector line */}
                  <div 
                    className="w-0.5 h-3 shrink-0 transition-all duration-500" 
                    style={{ 
                      backgroundColor: index > 0 && timelineItems[index - 1].isActive 
                        ? themeColor 
                        : index > 0 
                          ? 'var(--color-border-muted)' 
                          : 'transparent' 
                    }} 
                  />
                  
                  {/* Dot */}
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 border-card ${Z_INDEX.CONTENT} shrink-0 transition-all duration-500`}
                    style={item.isActive ? nodeRingStyle : { backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}
                  />

                  {/* Bottom connector line */}
                  <div 
                    className="w-0.5 flex-1 min-h-[24px] transition-all duration-500" 
                    style={{ 
                      backgroundColor: !item.isLast && item.isActive 
                        ? themeColor 
                        : !item.isLast 
                          ? 'var(--color-border-muted)' 
                          : 'transparent' 
                    }} 
                  />
                </div>

                {/* Right content */}
                <div className="pb-6">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-xs sm:text-sm font-extrabold text-primary leading-tight">{item.title}</span>
                    <span className="text-[10px] text-secondary font-bold font-mono">({formatDate(item.date)})</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-secondary leading-normal mt-0.5">{item.desc}</p>
                  
                  {/* Metric details */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] font-bold text-secondary uppercase tracking-wider">{item.metricLabel}:</span>
                    <span className={`text-xs font-extrabold font-mono ${isItemPaid ? 'text-income' : 'text-primary'}`}>
                      {formatCurrency(item.metricVal)}
                    </span>
                    {item.extraMetric !== undefined && (
                      <span className="text-[9px] text-secondary/60 font-sans flex items-center gap-0.5">
                        <span>({formatCurrency(item.extraMetric)} no relatório)</span><InfoTooltip
                            content={WEIGHT_TOOLTIPS.billReportValue}
                            iconSize={8}
                          />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className={`flex gap-2 p-2.5 rounded-lg text-[10px] text-secondary font-sans border transition-all duration-300 leading-relaxed items-center ${statusBannerClass[status]}`}
        style={themeBannerStyle}
      >
        <span className="shrink-0">{config.icon}</span>
        <span>{config.message}</span>
      </div>
    </div>
  )
}
