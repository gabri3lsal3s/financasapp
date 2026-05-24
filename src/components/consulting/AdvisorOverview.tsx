import { Profile } from '@/types'
import { isPrimaryAdminEmail, isPrimaryAdminProfile } from '@/constants/adminProfile'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { Wallet, UserPlus, Star, Eye, Trash2 } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface ClientRow {
  id: string
  name: string
  email: string
  aum: number
  cash: number
  assetsCount: number
  deviationPct: number
}

interface GlobalAumData {
  totalAum: number
  totalCash: number
  clientCount: number
  clientRows: ClientRow[]
}

interface AdvisorOverviewProps {
  globalAumData: GlobalAumData | null
  clients: Profile[]
  onSelectClient: (id: string) => void
  onDeleteClient: (client: Profile) => void
}

export default function AdvisorOverview({
  globalAumData,
  clients,
  onSelectClient,
  onDeleteClient,
}: AdvisorOverviewProps) {
  return (
    <div className="space-y-6 lg:space-y-8 animate-page-enter">
      {/* Banner de Gestão de Consultoria */}
      <div className="relative overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 rounded-3xl border border-indigo-900/30 text-white shadow-xl text-left">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 font-sans">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
            <Star size={12} className="text-indigo-400" />
            Painel do Gestor de Patrimônio
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white">Consolidação Geral da Consultoria</h2>
          <p className="text-sm text-slate-300 mt-1">Acompanhamento unificado de patrimônio, desvio de metas e clientes sob sua assessoria</p>
        </div>
      </div>

      {/* Cards de KPIs Globais */}
      {globalAumData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 text-left animate-page-enter">
          <Card className="p-5 bg-gradient-to-br from-card to-background border-l-4 border-l-indigo-500 flex items-center justify-between shadow-sm transition-all hover:border-l-indigo-400">
            <div>
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">AUM Total Sob Gestão</span>
              <strong className="text-2xl font-black text-primary mt-1.5 block">
                {formatCurrency(globalAumData.totalAum)}
              </strong>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Wallet size={24} />
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-card to-background border-l-4 border-l-emerald-500 flex items-center justify-between shadow-sm transition-all hover:border-l-emerald-400">
            <div>
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Total de Contas Clientes</span>
              <strong className="text-2xl font-black text-primary mt-1.5 block">
                {globalAumData.clientCount} Contas Ativas
              </strong>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <UserPlus size={24} />
            </div>
          </Card>
        </div>
      )}

      {/* Tabela de Contas Clientes */}
      <Card className="p-5 lg:p-6 text-left">
        <h3 className="font-bold text-lg text-primary mb-4 flex items-center gap-2">
          <Star size={18} className="text-indigo-500 fill-indigo-500" />
          Monitoramento Ativo de Carteiras Clientes
        </h3>

        {!globalAumData || globalAumData.clientRows.length === 0 ? (
          <p className="text-center py-8 text-sm text-secondary italic">Nenhum cliente com carteira ativa vinculado a você.</p>
        ) : (
          <div className="overflow-x-auto border border-border/30 rounded-xl bg-background/50">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="p-3.5 font-bold text-secondary">Cliente</th>
                  <th className="p-3.5 font-bold text-secondary text-right">Ativos</th>
                  <th className="p-3.5 font-bold text-secondary text-right">AUM Consolidado</th>
                  <th className="p-3.5 font-bold text-secondary text-center">Desvio Médio</th>
                  <th className="p-3.5 font-bold text-secondary text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {globalAumData.clientRows.map(row => {
                  const isHighDev = row.deviationPct > 10.0
                  return (
                    <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3.5 font-extrabold text-primary flex flex-col">
                        <span>{row.name}</span>
                        <span className="text-[10px] text-secondary font-normal font-mono">{row.email}</span>
                      </td>
                      <td className="p-3.5 text-right font-medium text-secondary">{row.assetsCount} ativos</td>
                      <td className="p-3.5 text-right font-bold text-primary">{formatCurrency(row.aum)}</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isHighDev 
                            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' 
                            : 'bg-emerald-500/10 text-emerald-600'
                        }`}>
                          {formatNumberBR(row.deviationPct)}% {isHighDev && '⚠️'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => onSelectClient(row.id)}
                            variant="outline"
                            className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-xl border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 dark:hover:text-indigo-300 font-semibold shadow-sm transition-all"
                          >
                            <Eye size={12} />
                            Visualizar
                          </Button>
                          {(() => {
                            const cl = clients.find(c => c.id === row.id)
                            const isClientAdmin = cl ? isPrimaryAdminProfile(cl) : isPrimaryAdminEmail(row.email)
                            if (isClientAdmin) return null
                            return (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (cl) {
                                    onDeleteClient(cl)
                                  }
                                }}
                                variant="outline"
                                className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-xl border-red-500/20 text-red-600 hover:bg-red-500/10 dark:hover:text-red-300 font-semibold shadow-sm transition-all"
                              >
                                <Trash2 size={12} />
                                Excluir
                              </Button>
                            )
                          })()}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
