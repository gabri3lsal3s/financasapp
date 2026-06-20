import Card from '@/components/Card'
import {
  formatCurrency,
  formatPercentBR,
  formatSignedPercentBR,
} from '@/utils/format'
import type { ConsolidatedGroup } from '@/services/investmentEngine'

interface AllocationPerformanceTableProps {
  groups: ConsolidatedGroup[]
  consolidationView: 'class' | 'sector'
}

export default function AllocationPerformanceTable({
  groups,
  consolidationView,
}: AllocationPerformanceTableProps) {
  const activeGroups = groups.filter((g) => g.total_value > 0)

  return (
    <Card className="p-4 lg:p-6 text-left space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-primary/5">
        <h4 className="text-xs font-black uppercase tracking-wider text-primary">
          Performance por {consolidationView === 'class' ? 'Classe' : 'Setor'}
        </h4>
        <span className="text-[9px] font-black text-secondary uppercase tracking-widest bg-secondary/50 px-2 py-0.5 rounded-full">
          Rentabilidade Consolidada
        </span>
      </div>

      {activeGroups.length === 0 ? (
        <p className="text-xs text-secondary italic text-center py-6">
          Nenhum ativo alocado para exibir métricas de performance.
        </p>
      ) : (
        <>
          {/* Visualização em Desktop */}
          <div className="hidden sm:block overflow-x-auto border border-glass rounded-2xl ring-1 ring-primary/5">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="surface-glass border-b border-glass text-[9px] font-black text-secondary uppercase tracking-widest">
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3 text-right">Patrimônio</th>
                  <th className="px-4 py-3 text-right">% Carteira</th>
                  <th className="px-4 py-3 text-right">Rent. Bruta</th>
                  <th className="px-4 py-3 text-right">Rent. Líquida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass font-medium">
                {activeGroups.map((g) => {
                  const isGrossPositive = g.gross_yield_pct >= 0
                  const isNetPositive = g.net_yield_pct >= 0

                  return (
                    <tr key={g.name} className="hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 font-bold text-primary">{g.name}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {formatCurrency(g.total_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-secondary">
                        {formatPercentBR(g.current_percentage, 1)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-bold ${
                          isGrossPositive ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {formatSignedPercentBR(g.gross_yield_pct)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-bold ${
                          isNetPositive ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {formatSignedPercentBR(g.net_yield_pct)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Visualização em Mobile */}
          <div className="block sm:hidden space-y-3.5">
            {activeGroups.map((g) => {
              const isGrossPositive = g.gross_yield_pct >= 0
              const isNetPositive = g.net_yield_pct >= 0

              return (
                <div
                  key={g.name}
                  className="p-4 border border-glass rounded-2xl surface-glass space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-primary/5 font-bold">
                    <span className="text-primary text-sm font-black">{g.name}</span>
                    <span className="font-mono text-secondary font-extrabold text-[11px] bg-secondary/20 px-2.5 py-0.5 rounded-lg">
                      {formatPercentBR(g.current_percentage, 1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-secondary leading-none">Patrimônio</div>
                      <div className="font-mono font-semibold text-primary truncate leading-tight">
                        {formatCurrency(g.total_value)}
                      </div>
                    </div>
                    <div className="space-y-1 text-center">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-secondary leading-none">Rent. Bruta</div>
                      <div
                        className={`font-mono font-bold leading-tight ${
                          isGrossPositive ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {formatSignedPercentBR(g.gross_yield_pct)}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-secondary leading-none">Rent. Líquida</div>
                      <div
                        className={`font-mono font-bold leading-tight ${
                          isNetPositive ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {formatSignedPercentBR(g.net_yield_pct)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
