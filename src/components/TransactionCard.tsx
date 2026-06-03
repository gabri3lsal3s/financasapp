import { RefreshCw, Pencil, Trash2 } from 'lucide-react'
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
      className={`flex-1 min-w-full sm:min-w-[calc(50%-1rem)] surface-glass-strong glass-card-interactive hover:border-glass transition-colors cursor-pointer p-0 overflow-hidden animate-stagger-item flex flex-col focus:ring-0 focus:outline-none ${staggerClass}`}
    >
      <div className="flex flex-1 h-full flex-col">
        <div className="flex flex-1 items-stretch">
          {/* Barra lateral colorida da categoria — largura aumentada para melhor visibilidade */}
          <div
            className="w-[3px] flex-shrink-0 rounded-l-sm"
            style={{ backgroundColor: categoryColor }}
          />

          <div className="flex-1 px-3.5 py-3 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between gap-3">

              {/* Lado Esquerdo: Título, Subtítulo e Pagamento */}
              <div className="flex-1 min-w-0">
                {/* Título: usa cor de texto primária do tema, tamanho calibrado */}
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
                      {/* WHY: cor de accent (não secondary) para o ícone offline ter contraste suficiente */}
                      <RefreshCw size={12} style={{ color: 'var(--ds-color-accent-primary)' }} className="animate-spin" />
                    </span>
                  )}
                </p>

                {/* Subtítulo e pagamento: texto secundário com contraste garantido pelo token ds */}
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] leading-tight"
                  style={{ color: 'var(--ds-color-text-secondary)' }}
                >
                  <span className="font-medium">{subtitle}</span>
                  {paymentLabel && paymentLabel !== 'Outros' && (
                    <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                      <span className="opacity-40 flex-shrink-0">•</span>
                      <span
                        className="truncate font-medium"
                        style={paymentColor ? { color: paymentColor } : undefined}
                      >
                        {paymentLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lado Direito: Valor, Parcelas, Data / Fatura */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="flex flex-col items-end">
                  {showOriginalAmount && (
                    <p
                      className="text-[10px] line-through mb-0.5"
                      style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.65 }}
                    >
                      {formatCurrency(originalAmount)}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    {installmentInfo && (
                      /* WHY: badge de parcela com background baseado em token para funcionar em todos os temas */
                      <span
                        className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-tighter whitespace-nowrap border"
                        style={{
                          color: 'var(--ds-color-text-secondary)',
                          backgroundColor: 'var(--glass-surface)',
                          borderColor: 'var(--glass-border)',
                        }}
                      >
                        {installmentInfo}
                      </span>
                    )}
                    {/* WHY: valor principal usa text-primary via token direto para contraste máximo em todos os temas */}
                    <p
                      className="text-base font-bold leading-tight font-mono"
                      style={{ color: 'var(--ds-color-text-primary)' }}
                    >
                      {formatCurrency(amount)}
                    </p>
                  </div>

                  {/* Data e fatura: tamanho e cor padronizados com o design system */}
                  <div
                    className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 mt-0.5 text-[10px] font-medium tracking-tight"
                    style={{ color: 'var(--ds-color-text-secondary)' }}
                  >
                    {billCompetenceLabel ? (
                      <>
                        <span className="opacity-75 whitespace-nowrap">{dateLabel}</span>
                        <span className="hidden sm:inline opacity-30 flex-shrink-0">•</span>
                        {/* WHY: fatura usa accent-primary para diferenciar visualmente, consistente com o restante da UI */}
                        <span
                          className="hidden sm:inline whitespace-nowrap font-semibold"
                          style={{ color: 'var(--ds-color-accent-primary)' }}
                        >
                          {billCompetenceLabel}
                        </span>
                      </>
                    ) : (
                      <span className="opacity-75 whitespace-nowrap">{dateLabel}</span>
                    )}
                  </div>
                </div>


              </div>

            </div>
          </div>
        </div>

        {/* Área expandida no mobile
            WHY: trocado spring por tween com ease-out para evitar o bug de height:auto
            travando no exit — spring não lida bem com height 0↔auto sem useMeasure.
            O clip-path garante que o conteúdo não vaze durante a animação. */}
        <AnimatePresence initial={false}>
          {isExpanded && onToggleExpand && (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
              className="sm:hidden"
            >
              {/* Separador com tokens do tema */}
              <div
                className="mx-3.5 border-t"
                style={{ borderColor: 'var(--glass-border)' }}
              />

              <div className="px-3.5 pt-2.5 pb-3.5 space-y-2.5">
                {/* Grid de metadata — usa glass-surface e glass-border para funcionar em todos os temas */}
                <div
                  className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px] leading-relaxed p-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--glass-surface)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div>
                    {/* WHY: labels em uppercase com ds-color-text-secondary garantem contraste em light e dark */}
                    <span
                      className="text-[9px] uppercase font-bold tracking-widest block mb-0.5"
                      style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.7 }}
                    >
                      Método
                    </span>
                    <span
                      className="font-semibold font-mono truncate block text-[12px]"
                      style={
                        paymentColor
                          ? { color: paymentColor }
                          : { color: 'var(--ds-color-text-primary)' }
                      }
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
                    <div
                      className="col-span-2 pt-2 border-t"
                      style={{ borderColor: 'var(--glass-border)' }}
                    >
                      <span
                        className="text-[9px] uppercase font-bold tracking-widest block mb-0.5"
                        style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.7 }}
                      >
                        Parcelamento
                      </span>
                      <span
                        className="font-semibold font-mono block text-[12px]"
                        style={{ color: 'var(--ds-color-text-primary)' }}
                      >
                        {installmentInfo}
                      </span>
                    </div>
                  )}

                  {billCompetenceLabel && (
                    <div
                      className="col-span-2 pt-2 border-t"
                      style={{ borderColor: 'var(--glass-border)' }}
                    >
                      <span
                        className="text-[9px] uppercase font-bold tracking-widest block mb-0.5"
                        style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.7 }}
                      >
                        Fatura Competência
                      </span>
                      <span
                        className="font-semibold font-mono block text-[12px]"
                        style={{ color: 'var(--ds-color-accent-primary)' }}
                      >
                        {billCompetenceLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Botões de ação */}
                <div className="flex items-center gap-2 justify-end">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}
