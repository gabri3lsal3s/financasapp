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
      <div className="relative overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 rounded-3xl border border-balance/30 text-white shadow-xl text-left">
        <div className="absolute right-0 top-0 w-64 h-64 bg-balance/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 font-sans">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-balance/10 border border-balance/20 text-balance text-xs font-bold rounded-full uppercase tracking-wider mb-3">
            <Star size={12} className="text-balance" />
            Painel do Gestor de Patrimônio
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white">Consolidação Geral da Consultoria</h2>
          <p className="text-sm text-slate-300 mt-1">Acompanhamento unificado de patrimônio, desvio de metas e clientes sob sua assessoria</p>
        </div>
      </div>

      {/* Cards de KPIs Globais */}
      {globalAumData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 text-left animate-page-enter">
          <Card className="p-5 bg-gradient-to-br from-card to-background border-l-4 border-l-balance flex items-center justify-between shadow-sm transition-all hover:border-l-balance/80">
            <div>
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">AUM Total Sob Gestão</span>
              <strong className="text-2xl font-black text-primary mt-1.5 block">
                {formatCurrency(globalAumData.totalAum)}
              </strong>
            </div>
            <div className="p-3 bg-balance/10 text-balance rounded-xl">
              <Wallet size={24} />
            </div>
          </Card>

          <Card className="p-5 bg-gradient-to-br from-card to-background border-l-4 border-l-income flex items-center justify-between shadow-sm transition-all hover:border-l-income/80">
            <div>
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Total de Contas Clientes</span>
              <strong className="text-2xl font-black text-primary mt-1.5 block">
                {globalAumData.clientCount} Contas Ativas
              </strong>
            </div>
            <div className="p-3 bg-income/10 text-income rounded-xl">
              <UserPlus size={24} />
            </div>
          </Card>
        </div>
      )}

      {/* Tabela de Contas Clientes */}
      <Card className="p-5 lg:p-6 text-left">
        <h3 className="font-bold text-lg text-primary mb-4 flex items-center gap-2">
          <Star size={18} className="text-balance fill-balance" />
          Monitoramento Ativo de Carteiras Clientes
        </h3>

        {!globalAumData || globalAumData.clientRows.length === 0 ? (
          <p className="text-center py-8 text-sm text-secondary italic">Nenhum cliente com carteira ativa vinculado a você.</p>
        ) : (
          <>
            {/* 1. Tabela para Desktop */}
            <div className="hidden md:block overflow-x-auto modal-table-shell">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-glass modal-table-head">
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
                              ? 'bg-warning/10 text-warning' 
                              : 'bg-income/10 text-income'
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
                              className="text-xs flex items-center gap-1.5 font-semibold"
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
                                  variant="expense"
                                  className="text-xs flex items-center gap-1.5 font-semibold"
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

            {/* 2. Cards para Mobile */}
            <div className="block md:hidden space-y-3">
              {globalAumData.clientRows.map(row => {
                const isHighDev = row.deviationPct > 10.0
                return (
                  <div 
                    key={row.id} 
                    className="p-4 surface-glass border-glass rounded-2xl space-y-3 hover:scale-[1.01] transition-all glass-card-interactive"
                  >
                    {/* Cabeçalho do Cliente */}
                    <div className="flex justify-between items-start gap-3 min-w-0">
                      <div className="text-left min-w-0 flex-1">
                        <h4 className="font-extrabold text-primary text-sm leading-snug truncate" title={row.name}>{row.name}</h4>
                        <span className="text-[10px] text-secondary font-mono leading-tight block mt-0.5 truncate" title={row.email}>{row.email}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase shrink-0 ${
                        isHighDev 
                          ? 'bg-warning/10 text-warning' 
                          : 'bg-income/10 text-income'
                      }`}>
                        Desvio: {formatNumberBR(row.deviationPct)}% {isHighDev && '⚠️'}
                      </span>
                    </div>

                    {/* Informações da Carteira */}
                    <div className="grid grid-cols-2 gap-3 text-left bg-secondary/35 p-2.5 rounded-xl border border-primary/5">
                      <div>
                        <span className="text-[9px] uppercase font-extrabold text-secondary block">Ativos</span>
                        <span className="text-xs font-bold text-primary font-mono">{row.assetsCount} ativos</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-extrabold text-secondary block">AUM Consolidado</span>
                        <span className="text-xs font-black text-primary font-mono">{formatCurrency(row.aum)}</span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2 pt-2 border-t border-primary/5">
                      <Button
                        size="sm"
                        onClick={() => onSelectClient(row.id)}
                        variant="outline"
                        className="flex-1 text-xs justify-center items-center gap-1.5 font-bold"
                      >
                        <Eye size={13} />
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
                            variant="expense"
                            className="flex-1 text-xs justify-center items-center gap-1.5 font-bold"
                          >
                            <Trash2 size={13} />
                            Excluir
                          </Button>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
