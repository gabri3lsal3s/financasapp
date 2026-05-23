import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Portfolio, PortfolioTransaction, AssetPrice } from '@/types'
import { calculatePositions, calculateShareHistory, calculatePerformanceMetrics, AssetPosition } from '@/services/investmentEngine'
import { getAssetPrices } from '@/services/priceService'
import { generateConsultingPDF } from '@/services/pdfGenerator'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { Wallet, TrendingUp, DollarSign, FileText, CheckCircle, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ClientDashboard() {
  const { user } = useAuth()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [assetPrices, setAssetPrices] = useState<Record<string, AssetPrice>>({})
  const [assetTheses, setAssetTheses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<boolean>(true)

  // Estados calculados
  const [positions, setPositions] = useState<AssetPosition[]>([])
  const [portfolioValue, setPortfolioValue] = useState<number>(0)
  const [shareValue, setShareValue] = useState<number>(1.0)

  useEffect(() => {
    if (user) {
      loadClientData()
    }
  }, [user])

  const loadClientData = async () => {
    try {
      setLoading(true)
      
      // 1. Puxa o portfolio do cliente logado
      const { data: portData, error: portError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('client_id', user?.id)
        .maybeSingle()

      if (portError) throw portError
      if (!portData) {
        setPortfolio(null)
        setLoading(false)
        return
      }

      setPortfolio(portData)

      // 2. Carrega as transações da carteira do cliente
      const { data: txsData, error: txsError } = await supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('portfolio_id', portData.id)
        .order('date', { ascending: true })

      if (txsError) throw txsError
      const txs = txsData || []
      setTransactions(txs)

      // 3. Carrega metas de alocação (Cerrado)
      const { data: targetsData, error: targetsError } = await supabase
        .from('target_allocations')
        .select('*')
        .eq('portfolio_id', portData.id)

      if (targetsError) throw targetsError

      // 4. Carrega as teses de investimentos do consultor vinculadas
      if (portData.consultant_id) {
        const { data: thesesData, error: thesesError } = await supabase
          .from('asset_theses')
          .select('*')
          .eq('consultant_id', portData.consultant_id)

        if (!thesesError && thesesData) {
          const mappedTheses: Record<string, string> = {}
          for (const item of thesesData) {
            mappedTheses[item.ticker.toUpperCase()] = item.thesis
          }
          setAssetTheses(mappedTheses)
        }
      }

      // 5. Busca cotações dos ativos para os cálculos
      const tickers = Array.from(new Set([
        ...txs.map(t => t.ticker.toUpperCase()),
        ...(targetsData || []).map(t => t.ticker.toUpperCase())
      ]))

      if (tickers.length > 0) {
        const prices = await getAssetPrices(tickers)
        setAssetPrices(prices)

        const { positions: calcPositions, totalValue } = calculatePositions(
          txs,
          targetsData || [],
          prices,
          Number(portData.cash_balance)
        )
        setPositions(calcPositions)
        setPortfolioValue(totalValue)

        const { currentShareValue } = calculateShareHistory(txs, prices, Number(portData.cash_balance))
        setShareValue(currentShareValue)
      } else {
        setPositions([])
        setPortfolioValue(Number(portData.cash_balance))
        setShareValue(1.0)
      }

    } catch (err) {
      console.error('Erro ao compilar painel do cliente:', err)
      toast.error('Erro ao processar dados da sua carteira')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!portfolio) return
    toast.loading('Compilando seu relatório premium...', { id: 'client-report' })
    try {
      const { shareHistory } = calculateShareHistory(transactions, assetPrices, Number(portfolio.cash_balance))
      const metrics = calculatePerformanceMetrics(shareHistory)

      await generateConsultingPDF({
        clientName: user?.email?.split('@')[0].toUpperCase() || 'CLIENTE CERRADO',
        portfolio,
        positions,
        shareHistory,
        metrics,
        theses: assetTheses,
        cashBalance: Number(portfolio.cash_balance)
      })
      toast.success('Relatório baixado com sucesso!', { id: 'client-report' })
    } catch (err) {
      console.error(err)
      toast.error('Falha ao baixar relatório.', { id: 'client-report' })
    }
  }

  if (loading) {
    return <Loader text="Carregando sua carteira do Cerrado..." className="py-24" />
  }

  return (
    <div className="space-y-6 lg:space-y-8 animate-page-enter">
      {/* Banner de Boas-Vindas */}
      <div className="relative overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 rounded-3xl border border-emerald-800/30 text-white shadow-xl">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
              <CheckCircle size={12} className="text-emerald-400" />
              Carteira Sob Gestão Cerrado
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white">Meu Painel de Investimentos</h2>
            <p className="text-sm text-slate-300 mt-1">Transparência em tempo real sobre seu patrimônio acumulado</p>
          </div>
          <div>
            <Button
              onClick={handleDownloadReport}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 py-2.5 px-6 rounded-xl"
            >
              <FileText size={18} />
              Baixar Relatório Mensal PDF
            </Button>
          </div>
        </div>
      </div>

      {portfolio ? (
        <>
          {/* Grid de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
            <Card className="p-5 bg-gradient-to-br from-card to-background border-l-4 border-emerald-500 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Patrimônio Líquido</span>
                <strong className="text-2xl font-black text-primary mt-1.5 block">
                  R$ {portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <Wallet size={24} />
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-card to-background border-l-4 border-sky-500 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Saldo Líquido em Caixa</span>
                <strong className="text-2xl font-black text-primary mt-1.5 block">
                  R$ {Number(portfolio.cash_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="p-3 bg-sky-500/10 text-sky-500 rounded-xl">
                <DollarSign size={24} />
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-card to-background border-l-4 border-purple-500 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider block">Rentabilidade Acumulada</span>
                <strong className="text-2xl font-black text-primary mt-1.5 block">
                  R$ {shareValue.toFixed(4)}
                  <span className="text-sm text-emerald-500 font-bold ml-2">
                    +{((shareValue - 1) * 100).toFixed(2)}%
                  </span>
                </strong>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                <TrendingUp size={24} />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Composição da Carteira */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-5 lg:p-6">
                <h3 className="font-bold text-lg text-primary mb-4">Composição de Ativos & Exposição</h3>
                
                {positions.length === 0 ? (
                  <p className="text-center py-8 text-sm text-secondary">Aguardando inserção dos lançamentos iniciais pelo seu consultor.</p>
                ) : (
                  <div className="overflow-x-auto border border-border/30 rounded-xl bg-background/50">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <th className="p-3.5 font-bold text-secondary">Ativo</th>
                          <th className="p-3.5 font-bold text-secondary text-right">Qtd</th>
                          <th className="p-3.5 font-bold text-secondary text-right">Cotação</th>
                          <th className="p-3.5 font-bold text-secondary text-right">Total Atual</th>
                          <th className="p-3.5 font-bold text-secondary text-center">Meu Peso</th>
                          <th className="p-3.5 font-bold text-secondary text-center">Peso Recomendado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {(() => {
                          const positionsByClass: Record<string, AssetPosition[]> = {}
                          positions.forEach(pos => {
                            const cls = pos.asset_class || 'Renda Fixa'
                            if (!positionsByClass[cls]) positionsByClass[cls] = []
                            positionsByClass[cls].push(pos)
                          })
                          return Object.entries(positionsByClass).map(([className, classPositions]) => (
                            <div key={className} style={{ display: 'contents' }}>
                              {/* Linha de cabeçalho do grupo de classe */}
                              <tr className="bg-muted/10 border-l-4 border-l-emerald-500 font-extrabold text-xs tracking-wider">
                                <td colSpan={6} className="p-3 text-secondary uppercase font-extrabold">
                                  {className}
                                </td>
                              </tr>
                              {classPositions.map(pos => (
                                <tr key={pos.ticker} className="hover:bg-muted/10 transition-colors">
                                  <td className="p-3.5 pl-6 font-extrabold text-primary flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {pos.ticker}
                                    <span className="text-[10px] text-secondary font-normal">({pos.sector || 'Outros'})</span>
                                  </td>
                                  <td className="p-3.5 text-right text-secondary font-medium">{pos.quantity.toLocaleString('pt-BR')}</td>
                                  <td className="p-3.5 text-right font-semibold text-secondary">R$ {pos.current_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-3.5 text-right font-bold text-primary">R$ {pos.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-3.5 text-center">
                                    <span className="px-2 py-0.5 bg-muted rounded text-xs font-bold text-secondary">{pos.current_percentage}%</span>
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold">{pos.target_percentage}%</span>
                                  </td>
                                </tr>
                              ))}
                            </div>
                          ))
                        })()}
                        <tr className="bg-muted/10 font-bold border-t border-border/40">
                          <td className="p-3.5 text-primary">CAIXA DISPONÍVEL</td>
                          <td className="p-3.5 text-right text-secondary">-</td>
                          <td className="p-3.5 text-right text-secondary">1,00</td>
                          <td className="p-3.5 text-right text-primary">R$ {Number(portfolio.cash_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 bg-muted rounded text-xs font-bold text-secondary">
                              {((Number(portfolio.cash_balance) / portfolioValue) * 100).toFixed(2)}%
                            </span>
                          </td>
                          <td className="p-3.5 text-center">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* Coluna da Direita: Teses & Suporte */}
            <div className="space-y-6">
              {/* Teses de Investimentos do Consultor */}
              <Card className="p-5 lg:p-6">
                <h3 className="font-bold text-base text-primary flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-emerald-500" />
                  Por que possuo estes ativos?
                </h3>
                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                  {positions.filter(pos => assetTheses[pos.ticker]).length === 0 ? (
                    <p className="text-xs text-secondary text-center py-4">Seu consultor ainda não anexou teses qualitativas este mês.</p>
                  ) : (
                    positions.filter(pos => assetTheses[pos.ticker]).map(pos => (
                      <div key={pos.ticker} className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-primary">
                          <span>{pos.ticker}</span>
                          <span className="text-[10px] text-emerald-500 font-semibold">{pos.target_percentage}% alvo</span>
                        </div>
                        <p className="text-[11px] text-secondary leading-relaxed pt-1">
                          {assetTheses[pos.ticker]}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Informações de Contato / Transparência */}
              <Card className="p-5 bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-800/30 text-white relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <h4 className="font-bold text-sm text-indigo-400 flex items-center gap-1.5 mb-2">
                  <HelpCircle size={15} />
                  Governança & RLS
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Sua carteira é gerenciada com isolamento total de inquilinos (Row Level Security) diretamente no banco. Nenhuma alteração financeira ou inserção pode ser disparada deste painel, garantindo governança total sobre seu patrimônio sob gestão.
                </p>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <Card className="p-10 text-center space-y-3 bg-gradient-to-br from-card to-background">
          <p className="text-secondary text-sm">Nenhuma carteira ativa foi vinculada à sua conta pelo seu consultor.</p>
          <p className="text-xs text-secondary/70">Entre em contato com sua assessoria do Cerrado para inicializar seus aportes.</p>
        </Card>
      )}
    </div>
  )
}
