import Card from '@/components/Card'
import { ArrowUpRight, ArrowDownRight, Award } from 'lucide-react'
import { ConsolidatedGroup } from '@/services/investmentEngine'
import { PortfolioTransaction, AssetPrice } from '@/types'

interface BenchmarkComparisonTableProps {
  consolidatedClass: ConsolidatedGroup[]
  transactions: PortfolioTransaction[]
  assetPrices: Record<string, AssetPrice>
}

interface BenchmarkInfo {
  name: string
  rate: number
}

const BENCHMARK_MAPPING: Record<string, BenchmarkInfo> = {
  'Ações Nacionais': { name: 'IBOVESPA', rate: 11.50 },
  'Ações Internacionais': { name: 'S&P 500', rate: 12.50 },
  'Fundos Imobiliários': { name: 'IFIX', rate: 10.00 },
  'Renda Fixa': { name: 'CDI', rate: 10.75 },
  'Criptoativos': { name: 'Bitcoin (BTC)', rate: 35.00 },
  'Saldo em Caixa': { name: 'CDI', rate: 10.75 }
}

export default function BenchmarkComparisonTable({
  consolidatedClass,
  transactions,
  assetPrices
}: BenchmarkComparisonTableProps) {
  
  // Função rigorosa para calcular o período de carregamento (holding days) de cada classe de ativo
  const getHoldingDays = (className: string) => {
    if (className === 'Saldo em Caixa') {
      if (transactions.length === 0) return 365
      const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
      const firstDate = new Date(sorted[0].date)
      const diffTime = Math.abs(new Date().getTime() - firstDate.getTime())
      return Math.max(30, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    }
    
    const classTxs = transactions.filter(t => {
      const priceObj = assetPrices[t.ticker.toUpperCase()]
      const assetClass = priceObj?.asset_class || 'Renda Fixa'
      return assetClass === className
    })
    
    if (classTxs.length === 0) return 365
    
    const sorted = classTxs.sort((a, b) => a.date.localeCompare(b.date))
    const firstDate = new Date(sorted[0].date)
    const diffTime = Math.abs(new Date().getTime() - firstDate.getTime())
    return Math.max(30, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  return (
    <Card className="p-5 flex flex-col justify-between shadow-sm border border-border/40 text-left h-full">
      <div>
        <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
          <Award size={16} className="text-indigo-500" />
          Rentabilidade Consolidada Ponderada vs Benchmarks
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-[10px] uppercase font-extrabold text-secondary tracking-wider text-left">
                <th className="py-2.5 px-3">Classe</th>
                <th className="py-2.5 px-3 text-right">Patrimônio</th>
                <th className="py-2.5 px-3 text-right">% Carteira</th>
                <th className="py-2.5 px-3 text-right">Rentabilidade Ponderada (Real)</th>
                <th className="py-2.5 px-3 text-left">Benchmark (Ref)</th>
                <th className="py-2.5 px-3 text-right">Diferença (Alpha)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {consolidatedClass.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-secondary italic">
                    Nenhum dado consolidado de classes disponível.
                  </td>
                </tr>
              ) : (
                consolidatedClass.map((group) => {
                  // Resolve o benchmark padrão e taxa anualizada
                  const benchInfo = BENCHMARK_MAPPING[group.name] || { name: 'CDI', rate: 10.75 }
                  
                  // Calcula taxa equivalente ao período de carregamento (capitalização composta)
                  const days = getHoldingDays(group.name)
                  const years = days / 365
                  const benchmarkRate = (Math.pow(1 + benchInfo.rate / 100, years) - 1) * 100
                  
                  const alpha = group.yield_pct - benchmarkRate
                  const isAlphaPositive = alpha >= 0

                  return (
                    <tr key={group.name} className="hover:bg-muted/5 transition-colors font-sans">
                      <td className="py-3 px-3 font-semibold text-primary">{group.name}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-primary">
                        R$ {group.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-secondary">
                        {group.current_percentage.toFixed(2)}%
                      </td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${
                        group.yield_pct >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {group.yield_pct.toFixed(2)}%
                      </td>
                      <td className="py-3 px-3 text-left">
                        <span className="text-xs text-secondary font-medium font-sans block">{benchInfo.name}</span>
                        <span className="text-[10px] text-secondary/60 font-mono block">Ref: {benchmarkRate.toFixed(2)}% ({days} dias)</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                          isAlphaPositive 
                            ? 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15'
                            : 'text-red-600 bg-red-500/10 dark:text-red-400 dark:bg-red-500/15'
                        }`}>
                          {isAlphaPositive ? (
                            <ArrowUpRight size={12} className="text-emerald-500" />
                          ) : (
                            <ArrowDownRight size={12} className="text-red-500" />
                          )}
                          <span>{alpha > 0 ? '+' : ''}{alpha.toFixed(2)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-border/40 text-[10px] text-secondary/70 font-sans italic">
        * A rentabilidade real é calculada de forma consolidada e ponderada pelo custo de aquisição, consolidando o ganho específico de cada ativo (cotação de mercado para B3, valor teórico acumulado por indexador para renda fixa e valores manuais declarados). O benchmark de referência (Ref) é ajustado e capitalizado dinamicamente de forma composta proporcional aos dias decorridos desde o primeiro aporte de cada classe de ativo.
      </div>
    </Card>
  )
}
