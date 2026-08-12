import SuspiciousDraftCard from '@/components/creditCards/SuspiciousDraftCard'
import type { BillExpenseItem } from '@/utils/creditCardBilling'

interface CsvSuspiciousStepProps {
  items: BillExpenseItem[]
  loading: boolean
  onUnlink: (item: BillExpenseItem) => Promise<void>
  onIgnore: (item: BillExpenseItem) => void
  onMove: (item: BillExpenseItem, newMonth: string) => Promise<void>
}

export default function CsvSuspiciousStep({
  items,
  loading,
  onUnlink,
  onIgnore,
  onMove,
}: CsvSuspiciousStepProps) {
  return (
    <div className="space-y-3 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-primary">
          Alertas: Possíveis Erros de Cadastro ({items.length})
        </h4>
        <p className="text-xs text-secondary">
          Lançamentos vinculados a este cartão no sistema que não constam no arquivo oficial da fatura.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-income/5 border border-income/20 rounded-xl p-6 text-center space-y-2">
          <span className="text-2xl text-income font-bold">✓</span>
          <h4 className="font-bold text-income text-sm">Nenhum lançamento suspeito!</h4>
          <p className="text-xs text-secondary">
            Não há lançamentos no sistema para este cartão que não constam no arquivo oficial da fatura.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
          {items.map((item) => (
            <SuspiciousDraftCard
              key={item.id}
              item={item}
              loading={loading}
              onUnlink={() => onUnlink(item)}
              onIgnore={() => onIgnore(item)}
              onMove={(newMonth) => onMove(item, newMonth)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
