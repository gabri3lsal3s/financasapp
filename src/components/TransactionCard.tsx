import { RefreshCw, Pencil, Trash2 } from 'lucide-react'
import InfoTooltip from '@/components/InfoTooltip'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'
import Button from '@/components/Button'
import Card from '@/components/Card'
import IconButton from '@/components/IconButton'
import { formatCurrency } from '@/utils/format'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { motion, AnimatePresence } from 'framer-motion'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const getMonthAbbreviation = (month: string) => {
  const monthMap: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
  }
  return monthMap[month] || month
}

interface TransactionCardProps {
  title: string
  subtitle: string
  amount: number
  originalAmount?: number
  dateLabel: string
  categoryColor: string
  categoryIconName?: string
  isOffline?: boolean
  onClick: () => void
  staggerClass?: string
  installmentInfo?: string
  paymentLabel?: string
  paymentColor?: string
  billCompetenceLabel?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

function MobileLayout({
  title, subtitle, amount, originalAmount, dateLabel, categoryColor,
  categoryIconName, isOffline, onClick, staggerClass, isExpanded,
  onToggleExpand, onEdit, onDelete, paymentLabel, paymentColor,
  installmentInfo, billCompetenceLabel,
}: TransactionCardProps) {
  const showOriginalAmount = originalAmount !== undefined && Math.abs(originalAmount - amount) > 0.009

  const handleCardClick = () => {
    if (onToggleExpand) {
      onToggleExpand()
    } else {
      onClick()
    }
  }

  return (
    <Card
      onClick={handleCardClick}
      className={`w-full surface-glass-strong glass-card-interactive hover:border-glass transition-colors cursor-pointer p-0 overflow-hidden animate-stagger-item flex flex-col focus:ring-0 focus:outline-none ${staggerClass ?? ''}`}
    >
      <div className="flex flex-1 h-full flex-col">
        <div className="flex flex-1 items-stretch">
          <div
            className="w-[3px] flex-shrink-0 rounded-l-sm"
            style={{ backgroundColor: categoryColor }}
          />
          <div className="flex-1 px-3.5 py-3 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold leading-snug flex items-center gap-2 w-full min-w-0"
                  style={{ color: 'var(--ds-color-text-primary)' }}
                >
                  <span
                    className="overflow-hidden whitespace-nowrap flex-grow"
                    style={{
                      maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                    }}
                  >
                    {title}
                  </span>
                  {isOffline && (
                    <span title="Pendente de sincronização" className="flex-shrink-0 flex">
                      <RefreshCw size={12} style={{ color: 'var(--ds-color-accent-primary)' }} className="animate-spin" />
                    </span>
                  )}
                </p>
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] leading-tight"
                  style={{ color: 'var(--ds-color-text-secondary)' }}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      style={{ color: categoryColor }}
                      className="flex items-center justify-center flex-shrink-0"
                    >
                      {getCategoryIcon(subtitle, 12, categoryIconName)}
                    </span>
                    <span>{subtitle}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="flex flex-col items-end">
                  {showOriginalAmount && (
                    <p className="flex items-center gap-1 justify-end mb-0.5">
                      <span
                        className="text-[10px] line-through"
                        style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.65 }}
                      >
                        {formatCurrency(originalAmount)}
                      </span>
                      <InfoTooltip content={WEIGHT_TOOLTIPS.transactionValue} iconSize={8} />
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <p
                      className="text-base font-bold leading-tight font-mono"
                      style={{ color: 'var(--ds-color-text-primary)' }}
                    >
                      {formatCurrency(amount)}
                    </p>
                  </div>
                  <div
                    className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 mt-0.5 text-[10px] font-medium tracking-tight"
                    style={{ color: 'var(--ds-color-text-secondary)' }}
                  >
                    <span className="opacity-75 whitespace-nowrap">{dateLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded area for mobile */}
        <AnimatePresence initial={false}>
          {isExpanded && onToggleExpand && (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mx-3.5 border-t" style={{ borderColor: 'var(--glass-border)' }} />
              <div className="px-3.5 pt-2.5 pb-3.5 space-y-2.5">
                <div
                  className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px] leading-relaxed p-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--glass-surface)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div>
                    <span
                      className="text-[9px] uppercase font-bold tracking-widest block mb-0.5"
                      style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.7 }}
                    >
                      Método
                    </span>
                    <span
                      className="font-semibold font-mono truncate block text-[12px]"
                      style={paymentColor ? { color: paymentColor } : { color: 'var(--ds-color-text-primary)' }}
                    >
                      {paymentLabel || 'Outros'}
                    </span>
                  </div>
                  <div>
                    <span
                      className="text-[9px] uppercase font-bold tracking-widest block mb-0.5"
                      style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.7 }}
                    >
                      Data Completa
                    </span>
                    <span
                      className="font-semibold font-mono block text-[12px]"
                      style={{ color: 'var(--ds-color-text-primary)' }}
                    >
                      {dateLabel}
                    </span>
                  </div>
                  {installmentInfo && (
                    <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                      <span
                        className="text-[9px] uppercase font-bold tracking-widest block mb-0.5"
                        style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.7 }}
                      >
                        Parcelamento
                      </span>
                      <span className="font-semibold font-mono block text-[12px]" style={{ color: 'var(--ds-color-text-primary)' }}>
                        {installmentInfo}
                      </span>
                    </div>
                  )}
                  {billCompetenceLabel && (
                    <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                      <span
                        className="text-[9px] uppercase font-bold tracking-widest block mb-0.5"
                        style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.7 }}
                      >
                        Fatura Competência
                      </span>
                      <span className="font-semibold font-mono block text-[12px]" style={{ color: 'var(--ds-color-accent-primary)' }}>
                        {billCompetenceLabel}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 justify-end">
                  {onDelete && (
                    <Button
                      type="button" size="sm" variant="expense"
                      onClick={(e) => { e.stopPropagation(); onDelete() }}
                      className="gap-1.5 select-none min-h-[44px]"
                    >
                      <Trash2 size={16} aria-hidden />
                      <span className="text-xs font-bold">Excluir</span>
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      type="button" size="sm" variant="outline"
                      onClick={(e) => { e.stopPropagation(); onEdit() }}
                      className="gap-1.5 select-none min-h-[44px]"
                    >
                      <Pencil size={16} aria-hidden />
                      <span className="text-xs font-bold">Editar</span>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}

function DesktopLayout({
  title, subtitle, amount, originalAmount, dateLabel, categoryColor,
  categoryIconName, isOffline, onClick, staggerClass,
  paymentLabel, paymentColor, installmentInfo, billCompetenceLabel,
  onEdit, onDelete,
}: TransactionCardProps) {
  const showOriginalAmount = originalAmount !== undefined && Math.abs(originalAmount - amount) > 0.009
  const [day, month] = dateLabel.split('/')

  return (
    <Card
      onClick={onClick}
      className={`w-full surface-glass-strong glass-card-interactive hover:border-glass transition-colors cursor-pointer p-0 overflow-hidden animate-stagger-item flex flex-col focus:ring-0 focus:outline-none ${staggerClass ?? ''}`}
    >
      <div className="flex flex-1 h-full flex-col">
        <div className="flex flex-1 items-stretch">
          <div
            className="w-[3px] flex-shrink-0 rounded-l-sm"
            style={{ backgroundColor: categoryColor }}
          />
          <div className="flex-1 px-3.5 py-3 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between w-full gap-4 lg:gap-6">
              {/* Date block */}
              <div className="flex flex-col items-center justify-center px-3 py-1.5 bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-xl text-center flex-shrink-0 min-w-[56px] h-13 shadow-sm select-none">
                <span className="text-sm font-extrabold text-[var(--ds-color-text-primary)] leading-none">{day}</span>
                <span className="text-[9px] text-[var(--ds-color-text-secondary)] font-extrabold uppercase tracking-wider mt-1 leading-none">
                  {month ? getMonthAbbreviation(month) : ''}
                </span>
              </div>

              {/* Title and Category */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-normal flex items-center gap-2 w-full min-w-0" style={{ color: 'var(--ds-color-text-primary)' }}>
                  <span
                    className="overflow-hidden whitespace-nowrap flex-grow"
                    style={{
                      maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                    }}
                  >
                    {title}
                  </span>
                  {isOffline && (
                    <span title="Pendente de sincronização" className="flex-shrink-0 flex">
                      <RefreshCw size={12} style={{ color: 'var(--ds-color-accent-primary)' }} className="animate-spin" />
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-70 mt-0.5 animate-fade-in" style={{ color: 'var(--ds-color-text-secondary)' }}>
                  <span style={{ color: categoryColor }} className="flex items-center justify-center flex-shrink-0">
                    {getCategoryIcon(subtitle, 12, categoryIconName)}
                  </span>
                  <span>{subtitle}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex flex-col justify-center min-w-[120px] max-w-[160px] flex-shrink-0">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-50 text-[var(--ds-color-text-secondary)] mb-0.5">Pagamento</span>
                <span className="text-xs font-semibold truncate" style={paymentColor ? { color: paymentColor } : undefined}>
                  {paymentLabel || <span className="opacity-40">-</span>}
                </span>
              </div>

              {/* Competence and Installments */}
              <div className="flex flex-col justify-center min-w-[130px] flex-shrink-0">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-50 text-[var(--ds-color-text-secondary)] mb-0.5">Competência / Parcelas</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--ds-color-text-primary)]">
                    {billCompetenceLabel || 'Mês Atual'}
                  </span>
                  {installmentInfo && (
                    <span
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md tracking-tighter whitespace-nowrap border"
                      style={{ color: 'var(--ds-color-text-secondary)', backgroundColor: 'var(--glass-surface)', borderColor: 'var(--glass-border)' }}
                    >
                      {installmentInfo}
                    </span>
                  )}
                </div>
              </div>

              {/* Value */}
              <div className="flex flex-col items-end justify-center min-w-[110px] text-right flex-shrink-0 ml-auto">
                {showOriginalAmount && (
                  <p className="flex items-center gap-1 justify-end mb-0.5">
                    <span className="text-[10px] line-through" style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.65 }}>
                      {formatCurrency(originalAmount)}
                    </span>
                    <InfoTooltip content={WEIGHT_TOOLTIPS.transactionValue} iconSize={8} />
                  </p>
                )}
                <p className="text-base font-extrabold leading-tight font-mono" style={{ color: 'var(--ds-color-text-primary)' }}>
                  {formatCurrency(amount)}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 pl-3 border-l border-[var(--glass-border)] ml-1 flex-shrink-0">
                {onEdit && (
                  <IconButton
                    icon={<Pencil size={13} />} size="sm" variant="ghost" label="Editar"
                    onClick={(e) => { e.stopPropagation(); onEdit() }}
                    className="opacity-60 hover:opacity-100 hover:scale-105 transition-all text-[var(--ds-color-text-primary)]"
                  />
                )}
                {onDelete && (
                  <IconButton
                    icon={<Trash2 size={13} />} size="sm" variant="ghost-danger" label="Excluir"
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                    className="opacity-60 hover:opacity-100 hover:scale-105 transition-all text-[var(--ds-color-intent-danger)]"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function TransactionCard(props: TransactionCardProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')

  if (isMobile) {
    return <MobileLayout {...props} />
  }

  return <DesktopLayout {...props} />
}
