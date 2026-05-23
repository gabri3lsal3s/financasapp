import { RefreshCw } from 'lucide-react'
import Card from '@/components/Card'
import { formatCurrency } from '@/utils/format'

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
}: TransactionCardProps) {
  const showOriginalAmount =
    originalAmount !== undefined && Math.abs(originalAmount - amount) > 0.009

  return (
    <Card
      onClick={onClick}
      className={`flex-1 min-w-full sm:min-w-[calc(50%-1rem)] hover:border-primary transition-colors cursor-pointer p-0 overflow-hidden animate-stagger-item flex flex-col ${staggerClass}`}
    >
      <div className="flex bg-primary flex-1 h-full">
        {/* Barra lateral de cor da categoria */}
        <div
          className="w-1 flex-shrink-0"
          style={{ backgroundColor: categoryColor }}
        />
        
        <div className="flex-1 p-3.5 flex flex-col justify-center min-w-0">
          <div className="flex items-center justify-between gap-3">
            
            {/* Lado Esquerdo: Título, Subtítulo e Pagamento */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-primary truncate flex items-center gap-2">
                {title}
                {isOffline && (
                  <span title="Pendente de sincronização" className="flex-shrink-0 flex">
                    <RefreshCw size={12} className="text-accent animate-spin" />
                  </span>
                )}
              </p>
              
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[12px] text-secondary leading-tight">
                <span className="font-medium">{subtitle}</span>
                {paymentLabel && paymentLabel !== 'Outros' && (
                  <div className="flex items-center gap-1.5 min-w-0">
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
            <div className="flex flex-col items-end flex-shrink-0">
              {showOriginalAmount && (
                <p className="text-[10px] text-secondary line-through opacity-70 mb-0.5">
                  {formatCurrency(originalAmount)}
                </p>
              )}
              
              <div className="flex items-center gap-2">
                {installmentInfo && (
                  <span className="text-[9px] font-bold text-secondary opacity-60 bg-secondary px-1 py-0.5 rounded border border-primary/10 tracking-tighter whitespace-nowrap">
                    {installmentInfo}
                  </span>
                )}
                <p className="text-base font-bold text-primary leading-tight">
                  {formatCurrency(amount)}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 mt-1 text-[11px] text-secondary font-medium tracking-tight">
                {billCompetenceLabel ? (
                  <>
                    <span className="opacity-80 whitespace-nowrap">{dateLabel}</span>
                    <span className="opacity-30 flex-shrink-0">•</span>
                    <span className="text-accent whitespace-nowrap">{billCompetenceLabel}</span>
                  </>
                ) : (
                  <span className="opacity-80 whitespace-nowrap">{dateLabel}</span>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </Card>
  )
}
