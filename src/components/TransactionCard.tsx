import { RefreshCw, Pencil, Trash2, ChevronDown } from 'lucide-react'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { formatCurrency } from '@/utils/format'
import { motion, AnimatePresence } from 'framer-motion'

interface TransactionCardProps {
  title: string
  subtitle: string
  amount: number
  originalAmount?: number // Se houver diferença por conta do peso do relatório (mostra riscado)
  dateLabel: string
  categoryColor: string
  isOffline?: boolean
  onClick: () => void
  staggerClass?: string
  installmentInfo?: string // Ex: "1/12"
  paymentLabel?: string // Ex: "Cartão: Nubank"
  paymentColor?: string // Cor do texto do pagamento
  billCompetenceLabel?: string // Ex: "Fatura de Março"
  isExpanded?: boolean
  onToggleExpand?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function TransactionCard({
  title,
  subtitle,
  amount,
  originalAmount,
  dateLabel,
  categoryColor,
  isOffline = false,
  onClick,
  staggerClass = '',
  installmentInfo,
  paymentLabel,
  paymentColor,
  billCompetenceLabel,
  isExpanded = false,
  onToggleExpand,
  onEdit,
  onDelete,
}: TransactionCardProps) {
  const showOriginalAmount =
    originalAmount !== undefined && Math.abs(originalAmount - amount) > 0.009

  const handleCardClick = () => {
    if (window.innerWidth < 640 && onToggleExpand) {
      onToggleExpand()
    } else {
      onClick()
    }
  }

  return (
    <Card
      onClick={handleCardClick}
      className={`flex-1 min-w-full sm:min-w-[calc(50%-1rem)] hover:border-glass transition-colors cursor-pointer p-0 overflow-hidden animate-stagger-item flex flex-col glass-glow-card ${staggerClass}`}
    >
      <div className="flex bg-primary flex-1 h-full flex-col">
        <div className="flex flex-1 items-stretch">
          {/* Barra lateral de cor da categoria */}
          <div
            className="w-1 flex-shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
          
          <div className="flex-1 p-3.5 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between gap-3">
              
              {/* Lado Esquerdo: Título, Subtítulo e Pagamento */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary flex items-center gap-2 w-full min-w-0">
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
                      <RefreshCw size={12} className="text-accent animate-spin" />
                    </span>
                  )}
                </p>
                
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[12px] text-secondary leading-tight">
                  <span className="font-medium">{subtitle}</span>
                  {paymentLabel && paymentLabel !== 'Outros' && (
                    <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                      <span className="opacity-30 flex-shrink-0">•</span>
                      <span
                        className="truncate"
                        style={paymentColor ? { color: paymentColor } : undefined}
                      >
                        {paymentLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Lado Direito: Valor, Parcelas, Data / Fatura */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-end">
                  {showOriginalAmount && (
                    <p className="text-[10px] text-secondary line-through opacity-70 mb-0.5">
                      {formatCurrency(originalAmount)}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {installmentInfo && (
                      <span className="hidden sm:inline-block text-[9px] font-bold text-secondary opacity-60 bg-secondary px-1 py-0.5 rounded border border-primary/10 tracking-tighter whitespace-nowrap">
                        {installmentInfo}
                      </span>
                    )}
                    <p className="text-base font-bold text-primary leading-tight font-mono">
                      {formatCurrency(amount)}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 mt-1 text-[11px] text-secondary font-medium tracking-tight">
                    {billCompetenceLabel ? (
                      <>
                        <span className="opacity-80 whitespace-nowrap">{dateLabel}</span>
                        <span className="hidden sm:inline opacity-30 flex-shrink-0">•</span>
                        <span className="hidden sm:inline text-accent whitespace-nowrap">{billCompetenceLabel}</span>
                      </>
                    ) : (
                      <span className="opacity-80 whitespace-nowrap">{dateLabel}</span>
                    )}
                  </div>
                </div>

                {/* Mobile expansion indicator indicator */}
                {onToggleExpand && (
                  <div className="block sm:hidden text-secondary/40 self-center">
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : 'rotate-0'}`}
                    />
                  </div>
                )}
              </div>
              
            </div>
          </div>
        </div>

        {/* Expanded Area on Mobile with dynamic height spring animations */}
        <AnimatePresence initial={false}>
          {isExpanded && onToggleExpand && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="px-4 pb-4 pt-1.5 border-t border-primary/10 space-y-3 bg-secondary/10 overflow-hidden text-left sm:hidden"
            >
              <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed bg-primary/45 p-2.5 rounded-xl border border-primary/30 text-left">
                <div>
                  <span className="text-[9px] uppercase font-bold text-secondary tracking-wide block">Método</span>
                  <span
                    className="font-bold font-mono truncate block"
                    style={paymentColor ? { color: paymentColor } : undefined}
                  >
                    {paymentLabel || 'Outros'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-secondary tracking-wide block">Data Completa</span>
                  <span className="font-semibold text-primary font-mono block">{dateLabel}</span>
                </div>
                {installmentInfo && (
                  <div className="col-span-2 pt-1 border-t border-primary/5">
                    <span className="text-[9px] uppercase font-bold text-secondary tracking-wide block">Parcelamento</span>
                    <span className="font-semibold text-primary font-mono block">{installmentInfo}</span>
                  </div>
                )}
                {billCompetenceLabel && (
                  <div className="col-span-2 pt-1 border-t border-primary/5">
                    <span className="text-[9px] uppercase font-bold text-secondary tracking-wide block">Fatura Competência</span>
                    <span className="font-bold text-accent font-mono block">{billCompetenceLabel}</span>
                  </div>
                )}
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-2 justify-end pt-1">
                {onDelete && (
                  <Button
                    type="button"
                    size="xs"
                    variant="expense"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                    className="gap-1.5 select-none"
                  >
                    <Trash2 size={12} aria-hidden />
                    <span>Excluir</span>
                  </Button>
                )}
                {onEdit && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                    }}
                    className="gap-1.5 select-none"
                  >
                    <Pencil size={12} aria-hidden />
                    <span>Editar</span>
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}
