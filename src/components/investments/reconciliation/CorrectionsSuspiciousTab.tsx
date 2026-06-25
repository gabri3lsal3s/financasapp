import B3ReconciliationGuidance from '@/components/investments/B3ReconciliationGuidance'
import SuspiciousInvestmentCard from '@/components/investments/SuspiciousInvestmentCard'
import type { PortfolioTransaction } from '@/types'

interface CorrectionsSuspiciousTabProps {
  existingOnly: PortfolioTransaction[]
  onDelete: (id: string) => void
}

export default function CorrectionsSuspiciousTab({
  existingOnly,
  onDelete,
}: CorrectionsSuspiciousTabProps) {
  return (
    <div className="space-y-3">
      <B3ReconciliationGuidance title="Correção manual necessária" variant="warning">
        Cada item abaixo existe no livro-razão mas não foi encontrado no extrato de movimentação. Exclua duplicatas ou
        corrija o ticker/data. Se o lançamento for legítimo fora do período do extrato, pode ignorar e seguir — a etapa
        de posição detectará saldo fantasma.
      </B3ReconciliationGuidance>

      <div className="text-left">
        <h5 className="text-sm font-black text-primary uppercase tracking-tight">
          Lançamentos Exclusivos do Livro-Razão
        </h5>
        <p className="text-[10px] text-secondary">
          Estes lançamentos existem apenas no sistema no período analisado, mas não constam no extrato B3 enviado. Podem
          ser duplicatas ou inserções manuais incorretas.
        </p>
      </div>

      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 text-left">
        {existingOnly.length === 0 ? (
          <p className="text-xs text-secondary italic py-6 text-center">Nenhum alerta pendente.</p>
        ) : (
          existingOnly.map((tx) => (
            <SuspiciousInvestmentCard key={tx.id} tx={tx} onDelete={() => onDelete(tx.id)} />
          ))
        )}
      </div>
    </div>
  )
}
