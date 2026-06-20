import { useEffect, useState } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import { FileSpreadsheet, Plus, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import type { PortfolioTransaction } from '@/types'
import { formatCurrency } from '@/utils/format'
import toast from 'react-hot-toast'

export default function Investments() {
  const [portfolioId, setPortfolioId] = useState<string>('')
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState<boolean>(false)
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle()

      if (!portfolio) {
        const { data: newPort, error: createError } = await supabase
          .from('portfolios')
          .insert({ client_id: user.id, cash_balance: 0.0 })
          .select('id')
          .single()
        if (createError) throw createError
        portfolio = newPort
      }

      if (portfolio) {
        setPortfolioId(portfolio.id)
        const txs = await fetchAllPortfolioTransactions(portfolio.id)
        setTransactions(txs || [])
      }
    } catch (err) {
      console.error('[Investments] Erro ao carregar carteira:', err)
      toast.error('Erro ao carregar dados de investimentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleOpenTxModal = (tx?: PortfolioTransaction) => {
    setEditingTransaction(tx ?? null)
    setIsTxModalOpen(true)
  }

  const handleCloseTxModal = () => {
    setIsTxModalOpen(false)
    setEditingTransaction(null)
  }

  // Ordenar transações mais recentes primeiro
  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date))
  const recentTransactions = sortedTransactions.slice(0, 10)

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.investments.title}
        subtitle={PAGE_HEADERS.investments.description}
        action={
          <PageHeaderActions launchModalOpen={isReconciliationOpen || isTxModalOpen}>
            <PageHeaderActionButton
              intent="income"
              icon={FileSpreadsheet}
              label="Conciliação B3"
              compactOnMobile={false}
              onClick={() => setIsReconciliationOpen(true)}
            />
            <PageHeaderActionButton
              actionRole="launch"
              intent="balance"
              icon={Plus}
              label="Lançar transação"
              compactOnMobile={false}
              onClick={() => handleOpenTxModal()}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto animate-page-enter">
        {loading ? (
          <Loader text="Carregando dados da carteira..." className="py-12" />
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Grid de Cards Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card B3 */}
              <Card className="border border-balance/25 bg-balance/5 rounded-3xl p-6 sm:p-8 flex flex-col justify-between items-center text-center gap-6 shadow-sm relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-balance/10 rounded-full blur-2xl pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-balance/10 flex items-center justify-center text-balance shrink-0">
                  <FileSpreadsheet size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-primary">Conciliação B3</h3>
                  <p className="text-xs text-secondary leading-relaxed max-w-sm font-medium mx-auto">
                    Importe seu extrato de negociações ou posições oficiais exportado diretamente da B3 em formato Excel (.xlsx).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="income"
                  onClick={() => setIsReconciliationOpen(true)}
                  className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-11 rounded-xl w-full"
                >
                  <Sparkles size={16} />
                  <span>Iniciar Conciliação B3</span>
                </Button>
              </Card>

              {/* Card Manual */}
              <Card className="border border-glass bg-glass/5 rounded-3xl p-6 sm:p-8 flex flex-col justify-between items-center text-center gap-6 shadow-sm relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Plus size={28} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-primary">Lançamento Manual</h3>
                  <p className="text-xs text-secondary leading-relaxed max-w-sm font-medium mx-auto">
                    Insira aportes, resgates, proventos ou saldos de caixa manualmente para registrar suas movimentações financeiras.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="balance"
                  onClick={() => handleOpenTxModal()}
                  className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-11 rounded-xl w-full"
                >
                  <Plus size={16} />
                  <span>Adicionar Manualmente</span>
                </Button>
              </Card>
            </div>


            {/* Tabela de Transações Recentes (Fluxo de Caixa) */}
            <Card className="border border-glass surface-glass rounded-3xl p-5 space-y-4 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-primary/5">
                <div>
                  <h4 className="text-sm font-black text-primary uppercase tracking-wider">Lançamentos Recentes</h4>
                  <p className="text-[10px] text-secondary font-medium">As últimas 10 transações registradas no fluxo de caixa</p>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="py-8 text-center text-xs font-semibold text-secondary">
                  Nenhuma transação encontrada no livro-razão. Use os botões acima para importar ou lançar movimentações.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-glass text-secondary font-bold select-none">
                        <th className="py-2.5 font-bold uppercase">Data</th>
                        <th className="py-2.5 font-bold uppercase">Ticker</th>
                        <th className="py-2.5 font-bold uppercase">Operação</th>
                        <th className="py-2.5 font-bold uppercase text-right">Qtd</th>
                        <th className="py-2.5 font-bold uppercase text-right">Preço</th>
                        <th className="py-2.5 font-bold uppercase text-right">Total</th>
                        <th className="py-2.5 text-center font-bold uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((tx) => {
                        const total = Number(tx.quantity) * Number(tx.price)
                        const opLabel = tx.operation_type === 'buy' ? 'Compra'
                          : tx.operation_type === 'sell' ? 'Venda'
                          : tx.operation_type === 'dividend' ? 'Dividendo'
                          : tx.operation_type === 'jcp' ? 'JCP'
                          : tx.operation_type === 'subscription' ? 'Subscrição'
                          : tx.operation_type === 'split' ? 'Desdobramento'
                          : tx.operation_type === 'reverse_split' ? 'Grupamento'
                          : tx.operation_type

                        const opColor = tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                          ? 'text-balance bg-balance/10'
                          : tx.operation_type === 'sell'
                            ? 'text-expense bg-expense/10'
                            : 'text-income bg-income/10'

                        return (
                          <tr key={tx.id} className="border-b border-glass/40 hover:bg-glass/10 transition-colors font-semibold">
                            <td className="py-3 font-mono">{tx.date}</td>
                            <td className="py-3 font-mono font-black text-primary">{tx.ticker}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${opColor}`}>
                                {opLabel}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono">{tx.quantity}</td>
                            <td className="py-3 text-right font-mono">{formatCurrency(Number(tx.price))}</td>
                            <td className="py-3 text-right font-mono text-primary">{formatCurrency(total)}</td>
                            <td className="py-3 text-center">
                              <Button
                                type="button"
                                variant="link"
                                onClick={() => handleOpenTxModal(tx)}
                                className="text-balance hover:text-balance-dark hover:underline font-bold transition-all px-2 py-1 rounded h-auto p-0"
                              >
                                Editar
                              </Button>
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
        )}
      </div>

      {portfolioId && (
        <>
          <PortfolioTransactionFormModal
            isOpen={isTxModalOpen}
            onClose={handleCloseTxModal}
            portfolioId={portfolioId}
            editingTransaction={editingTransaction}
            onSaved={loadData}
          />
          <InvestmentReconciliationModal
            isOpen={isReconciliationOpen}
            onClose={() => setIsReconciliationOpen(false)}
            portfolioId={portfolioId}
            existingTransactions={transactions}
            onSaved={loadData}
            onOpenAssetConfig={() => {
              toast('Para parametrizar ativos, utilize a planilha B3 ou aguarde a nova implementação.', {
                icon: 'ℹ️',
              })
            }}
          />
        </>
      )}
    </div>
  )
}
