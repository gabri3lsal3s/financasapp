import { cn } from '@/lib/utils'
import { Plus, Pencil, Calendar, Undo2, Wallet, FileUp, ChevronUp, ChevronDown, CreditCard as CreditCardIcon } from 'lucide-react'
import Button from '@/components/Button'
import EmptyState from '@/components/EmptyState'
import IconButton from '@/components/IconButton'
import InfoTooltip from '@/components/InfoTooltip'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'
import CreditCardTimeline from '@/components/creditCards/CreditCardTimeline'
import BillExpenseRowButton from '@/components/creditCards/BillExpenseRowButton'
import RowButton from '@/components/RowButton'
import { formatCurrency, formatDate, roundToDecimals } from '@/utils/format'
import { CARD_BASE, CARD_PADDING } from '@/constants/layout'
import { parseRefundNote } from '@/utils/refundNote'
import type { MonthlyCycleRow } from '@/components/creditCards/CreditCardTimeline'
import type { CreditCard } from '@/types'
import type { BillExpenseItem, BillPaymentDisplayItem } from '@/utils/creditCardBilling'

interface CreditCardSectionProps {
  activeCards: CreditCard[]
  currentMonth: string
  expandedItems: Record<string, boolean>
  onToggleExpand: (id: string) => void
  expensesByCard: Record<string, number>
  paymentsByCard: Record<string, number>
  baseExpensesByCard: Record<string, number>
  billItemsByCard: Record<string, BillExpenseItem[]>
  paymentItemsByCard: Record<string, BillPaymentDisplayItem[]>
  monthlyCyclesByCard: Record<string, MonthlyCycleRow>
  onCreateCard: () => void
  onEditCard: (card: CreditCard) => void
  onOpenCycle: (card: CreditCard) => void
  onOpenRefund: (cardId: string) => void
  onOpenPayment: (cardId: string) => void
  onOpenCsv: (cardId: string) => void
  onOpenExpenseEdit: (item: BillExpenseItem) => void
  onOpenPaymentItem: (payment: BillPaymentDisplayItem) => void
}

/**
 * SEÇÃO 1 — Cartões de Crédito (extraída de Contas.tsx).
 *
 * Lista de cartões em accordion: cada cartão expandido mostra a timeline do
 * ciclo, ações (editar/ciclo/estorno/pagar/CSV) e os lançamentos e pagamentos
 * da competência.
 */
export default function CreditCardSection({
  activeCards,
  currentMonth,
  expandedItems,
  onToggleExpand,
  expensesByCard,
  paymentsByCard,
  baseExpensesByCard,
  billItemsByCard,
  paymentItemsByCard,
  monthlyCyclesByCard,
  onCreateCard,
  onEditCard,
  onOpenCycle,
  onOpenRefund,
  onOpenPayment,
  onOpenCsv,
  onOpenExpenseEdit,
  onOpenPaymentItem,
}: CreditCardSectionProps) {
  return (
    <section className={cn('space-y-3', CARD_BASE, CARD_PADDING)}>
      <div className="flex items-center justify-between border-b border-glass pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CreditCardIcon size={16} className="shrink-0 text-primary/60 sm:text-primary/70" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-primary truncate flex items-center gap-1.5">
              Cartões de Crédito
              <span className="text-xs font-medium text-secondary font-sans">
                ({activeCards.length})
              </span>
            </h2>
            <p className="text-xs text-secondary mt-0.5 truncate">Faturas e ciclo de competência ativa</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCreateCard}
          className="h-8 px-3 text-xs font-semibold flex items-center gap-1.5 bg-secondary/20 hover:bg-secondary/40 border border-glass shrink-0"
        >
          <Plus size={14} />
          Novo Cartão
        </Button>
      </div>

      {activeCards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon size={28} />}
          title="Nenhum cartão cadastrado"
          description="Cadastre seu primeiro cartão de crédito para começar a gerenciar suas faturas."
          action={{
            label: 'Cadastrar primeiro cartão',
            onClick: onCreateCard,
            variant: 'primary',
          }}
        />
      ) : (
        <div className="space-y-3">
          {activeCards.map((card) => {
            const totalPrevisto = Number(expensesByCard[card.id] || 0)
            const totalPago = Number(paymentsByCard[card.id] || 0)
            const saldoAberto = roundToDecimals(totalPrevisto - totalPago, 2)
            const billItems = billItemsByCard[card.id] || []
            const monthlyCycle = monthlyCyclesByCard[card.id]
            const effectiveClosingDay = monthlyCycle?.closing_day || card.closing_day
            const effectiveDueDay = monthlyCycle?.due_day || card.due_day
            const isExpanded = !!expandedItems[card.id]

            return (
              <div key={card.id} id={`credit-card-${card.id}`} className="p-0 overflow-hidden rounded-2xl border border-glass surface-glass shadow-sm transition-all duration-300">
                {/* Header Accordion */}
                <div
                  className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                  onClick={() => onToggleExpand(card.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full shadow-sm shrink-0"
                      style={{ backgroundColor: card.color || 'var(--color-primary)' }}
                    />
                    <div className="text-left min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-primary truncate">{card.name}</p>
                      <p className="text-[10px] sm:text-[11px] text-secondary mt-0.5 truncate">
                        {card.brand || 'Crédito'} • Fechamento: dia {effectiveClosingDay} • Vencimento: dia {effectiveDueDay}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] sm:text-xs text-secondary leading-tight flex items-center justify-end gap-1">
                        Fatura Atual
                        {baseExpensesByCard[card.id] !== undefined && baseExpensesByCard[card.id] !== totalPrevisto && (
                          <InfoTooltip content={WEIGHT_TOOLTIPS.billActualValue} iconSize={10} />
                        )}
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-primary font-mono mt-0.5">
                        {formatCurrency(baseExpensesByCard[card.id] ?? totalPrevisto)}
                      </p>
                      {baseExpensesByCard[card.id] !== undefined && baseExpensesByCard[card.id] !== totalPrevisto && (
                        <p className="text-[9px] text-secondary/50 font-sans mt-0.5">
                          Relatório: {formatCurrency(totalPrevisto)}
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                    ) : (
                      <ChevronDown size={14} className="text-secondary sm:w-[16px] sm:h-[16px]" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="p-4 border-t border-glass bg-secondary/5 space-y-5 animate-surface-enter text-left w-full">
                    {/* Linha do tempo (Timeline) */}
                    <CreditCardTimeline
                      card={card}
                      currentMonth={currentMonth}
                      totalPrevisto={totalPrevisto}
                      totalPago={totalPago}
                      saldoAberto={saldoAberto}
                      monthlyCycle={monthlyCycle}
                      baseExpense={baseExpensesByCard[card.id]}
                    />

                    {/* Ações do Cartão */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-secondary/20 p-2.5 sm:p-3 rounded-xl border border-glass">
                      <span className="text-xs uppercase font-bold text-secondary tracking-wider">Ações do Cartão</span>
                      <div className="flex flex-wrap gap-1.5">
                        <IconButton
                          size="sm"
                          icon={<Pencil size={14} />}
                          onClick={() => onEditCard(card)}
                          label="Editar Cartão"
                          title="Editar configurações do cartão"
                        />
                        <IconButton
                          size="sm"
                          icon={<Calendar size={14} />}
                          onClick={() => onOpenCycle(card)}
                          label="Ajustar Ciclo"
                          title="Ajustar fechamento/vencimento do mês"
                        />
                        <IconButton
                          size="sm"
                          icon={<Undo2 size={14} />}
                          onClick={() => onOpenRefund(card.id)}
                          label="Estorno"
                          title="Registrar estorno"
                        />
                        <IconButton
                          size="sm"
                          icon={<Wallet size={14} />}
                          onClick={() => onOpenPayment(card.id)}
                          label="Pagar Fatura"
                          title="Registrar pagamento"
                        />
                        <IconButton
                          size="sm"
                          icon={<FileUp size={14} />}
                          onClick={() => onOpenCsv(card.id)}
                          label="CSV"
                          title="Anexar CSV"
                        />
                      </div>
                    </div>

                    {/* Grid de 2 subcolunas: Lançamentos + Pagamentos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Lançamentos da Fatura */}
                      <div className="space-y-2.5 bg-secondary/10 p-3 rounded-xl border border-glass">
                        <div className="flex items-center justify-between border-b border-glass pb-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                            Lançamentos ({currentMonth})
                          </h4>
                          <span className="text-xs font-medium text-secondary">
                            {billItems.length} {billItems.length === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                        {billItems.length === 0 ? (
                          <p className="text-xs text-secondary py-2">Sem lançamentos nesta competência.</p>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                            {billItems.map((item) => (
                              <BillExpenseRowButton key={item.id} item={item} onOpen={onOpenExpenseEdit} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pagamentos e Ajustes */}
                      <div className="space-y-2.5 bg-secondary/10 p-3 rounded-xl border border-glass">
                        <div className="flex items-center justify-between border-b border-glass pb-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                            Pagamentos ({currentMonth})
                          </h4>
                          <span className="text-xs font-medium text-secondary">
                            {(paymentItemsByCard[card.id] || []).length} {(paymentItemsByCard[card.id] || []).length === 1 ? 'registro' : 'registros'}
                          </span>
                        </div>
                        {(paymentItemsByCard[card.id] || []).length === 0 ? (
                          <p className="text-xs text-secondary py-2">Sem pagamentos registrados nesta competência.</p>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                            {(paymentItemsByCard[card.id] || []).map((payment) => {
                              const refundMeta = parseRefundNote(payment.note)
                              return (
                                <RowButton key={payment.id} onClick={() => onOpenPaymentItem(payment)}>
                                  <div className="flex items-start justify-between gap-3 w-full text-left">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-primary truncate">
                                        {refundMeta.isRefund
                                          ? (refundMeta.description || 'Estorno de compra')
                                          : (payment.note || 'Pagamento de fatura')}
                                      </p>
                                      <p className="text-xs text-secondary mt-0.5 font-mono">
                                        {formatDate(payment.payment_date)}
                                        {refundMeta.isRefund ? ' • Estorno' : ''}
                                      </p>
                                    </div>
                                    <p className="text-xs font-bold text-income font-mono">{formatCurrency(payment.amount)}</p>
                                  </div>
                                </RowButton>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
