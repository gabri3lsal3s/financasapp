import React, { useState, useMemo } from 'react'
import { Portfolio } from '@/types'
import { AssetPosition } from '@/services/investmentEngine'
import { supabase } from '@/lib/supabase'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { Check, Loader2, ArrowUpRight, AlertCircle } from 'lucide-react'
import {
  fetchPortfolioCashContext,
  reconcileCashOffsetOnTransactionSave,
} from '@/services/cashOffsetService'
import { calculateLedgerCashBalance } from '@/utils/cashBalanceApplication'
import { formatCurrency, formatMoneyInput, formatQuantityBR } from '@/utils/format'

interface ContributionSimulatorProps {
  portfolio: Portfolio
  positions: AssetPosition[]
  onContributionExecuted: () => void
}

interface SimulatedRow {
  ticker: string
  currentPercentage: number
  targetPercentage: number
  currentValue: number
  gap: number
  suggestedValue: number
  operation: 'Comprar' | 'Aguardar'
  sharesToBuy: number
}

export default function ContributionSimulator({
  portfolio,
  positions,
  onContributionExecuted
}: ContributionSimulatorProps) {
  const [contributionAmount, setContributionAmount] = useState<string>('')
  const [isSimulating, setIsSimulating] = useState<boolean>(false)
  const [simulatedRows, setSimulatedRows] = useState<SimulatedRow[]>([])
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  // Total da carteira atual (apenas ativos)
  const portfolioCurrentValue = positions.reduce((sum, p) => sum + p.total_value, 0)

  const currentCash = useMemo(() => {
    return positions
      .filter(p => p.ticker === 'SALDO_INV' || p.ticker === 'CAIXA' || p.ticker === 'SALDO EM CAIXA' || p.ticker === 'SALDO_EM_CAIXA' || p.pricing_mode === 'cash')
      .reduce((sum, p) => sum + p.total_value, 0)
  }, [positions])

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const amount = parseFloat(contributionAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Insira um valor de aporte válido maior que zero.')
      return
    }

    setIsSimulating(true)

    // Direciona o aporte para ativos abaixo da meta de alocação:
    // Novo patrimônio projetado = Patrimônio atual + Aporte
    const projectedValue = portfolioCurrentValue + amount

    // Filtra fora posições de caixa para o cálculo de distribuição do aporte
    const nonCashPositions = positions.filter(
      pos => pos.pricing_mode !== 'cash' && pos.ticker !== 'CAIXA' && pos.ticker !== 'SALDO_INV' && pos.ticker !== 'SALDO EM CAIXA' && pos.ticker !== 'SALDO_EM_CAIXA'
    )

    // 1. Calcula o Gap (Déficit) de cada ativo com base na meta de alocação no novo patrimônio
    const rows: {
      ticker: string
      currentPercentage: number
      targetPercentage: number
      currentValue: number
      gap: number
      currentPrice: number
    }[] = nonCashPositions.map(pos => {
      const targetValue = (pos.target_percentage / 100) * projectedValue
      const gap = targetValue - pos.total_value
      return {
        ticker: pos.ticker,
        currentPercentage: pos.current_percentage,
        targetPercentage: pos.target_percentage,
        currentValue: pos.total_value,
        gap: gap,
        currentPrice: pos.current_price
      }
    })

    // 2. Filtra apenas os ativos que possuem Gap positivo (estão defasados)
    const positiveGapRows = rows.filter(r => r.gap > 0)
    const totalPositiveGap = positiveGapRows.reduce((sum, r) => sum + r.gap, 0)

    // 3. Distribui o aporte proporcionalmente entre os ativos com gap positivo
    const simulationResult: SimulatedRow[] = rows.map(r => {
      let suggestedValue = 0
      let operation: 'Comprar' | 'Aguardar' = 'Aguardar'

      if (r.gap > 0 && totalPositiveGap > 0) {
        // Distribui proporcionalmente ao tamanho do gap do ativo em relação ao gap total
        suggestedValue = amount * (r.gap / totalPositiveGap)
        // Arredonda para 2 casas decimais
        suggestedValue = Math.round(suggestedValue * 100) / 100
        operation = 'Comprar'
      }

      // Calcula quantas cotas/ações inteiras/fracionadas podem ser compradas com esse valor sugerido
      const sharesToBuy = r.currentPrice > 0 ? suggestedValue / r.currentPrice : 0

      return {
        ticker: r.ticker,
        currentPercentage: r.currentPercentage,
        targetPercentage: r.targetPercentage,
        currentValue: r.currentValue,
        gap: Math.round(r.gap * 100) / 100,
        suggestedValue,
        operation,
        sharesToBuy: Math.round(sharesToBuy * 10000) / 10000 // suporta fracionado até 4 casas (cripto/ETFs)
      }
    })

    setSimulatedRows(simulationResult)
    setIsSimulating(false)
  }

  const handleExecuteContribution = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const purchases = simulatedRows.filter(r => r.operation === 'Comprar' && r.suggestedValue > 0)

      if (purchases.length === 0) {
        throw new Error('Nenhuma compra sugerida para registrar.')
      }

      // Registrar cada compra sugerida no livro-razão de transações (transactions)
      const transactionsToInsert = purchases.map(p => {
        const currentPos = positions.find(pos => pos.ticker === p.ticker)
        return {
          portfolio_id: portfolio.id,
          ticker: p.ticker,
          operation_type: 'buy' as const,
          quantity: p.sharesToBuy,
          price: currentPos?.current_price || 0,
          date: new Date().toISOString().split('T')[0] // Data atual (YYYY-MM-DD)
        }
      })

      const { data: insertedTxs, error: txsError } = await supabase
        .from('portfolio_transactions')
        .insert(transactionsToInsert)
        .select()

      if (txsError) throw txsError

      // Reconciliar os offsets de caixa vinculados no livro-razão para cada transação de compra inserida
      if (insertedTxs && insertedTxs.length > 0) {
        for (const tx of insertedTxs) {
          const context = await fetchPortfolioCashContext(portfolio.id)
          const def = context.definitions.find(d => d.ticker.toUpperCase() === tx.ticker.toUpperCase())
          const assetPricingMode = def?.pricing_mode || 'market'

          await reconcileCashOffsetOnTransactionSave({
            portfolioId: portfolio.id,
            transactionId: tx.id,
            amount: Number(tx.quantity) * Number(tx.price),
            date: tx.date,
            assetPricingMode,
            operationType: 'buy',
            transactions: context.transactions,
            definitions: context.definitions,
          })
        }
      }

      // Sincronizar portfolios.cash_balance com a soma do saldo em caixa do livro-razão
      const updatedContext = await fetchPortfolioCashContext(portfolio.id)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)

      const { error: updatePortError } = await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolio.id)

      if (updatePortError) throw updatePortError

      setSuccess(true)
      setContributionAmount('')
      setSimulatedRows([])
      onContributionExecuted()
    } catch (err) {
      console.error('Erro ao executar aporte em lote:', err)
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao salvar o aporte.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="p-5 lg:p-6 bg-gradient-to-br from-card to-background border border-border/80 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-income/10 text-income rounded-lg">
          <ArrowUpRight size={22} />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-primary">Simulador de Aportes Inteligente</h3>
          <p className="text-sm text-secondary">Direcionamento automático para ativos abaixo da meta de alocação</p>
        </div>
      </div>
 
      <form onSubmit={handleSimulate} className="flex flex-col sm:flex-row gap-3 mb-6 items-end">
        <div className="flex-1 w-full text-left">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Aporte Mensal (R$)</span>
            {currentCash > 0 && (
              <button
                type="button"
                onClick={() => setContributionAmount(formatMoneyInput(currentCash))}
                className="text-xs font-bold text-balance hover:text-balance/80 transition-colors flex items-center gap-1 font-mono"
                title="Clique para preencher com o saldo em caixa disponível"
              >
                Usar Caixa: {formatCurrency(currentCash)}
              </button>
            )}
          </div>
          <Input
            label=""
            type="number"
            step="0.01"
            required
            placeholder="0,00"
            value={contributionAmount}
            onChange={e => setContributionAmount(e.target.value)}
          />
        </div>
        <div className="flex items-end shrink-0 w-full sm:w-auto">
          <Button
            type="submit"
            disabled={isSimulating || isSaving}
            variant="primary"
            className="w-full sm:w-auto px-6 font-semibold shadow-md"
          >
            {isSimulating ? 'Calculando...' : 'Calcular Alocação'}
          </Button>
        </div>
      </form>
 
      {error && (
        <div className="p-3 mb-4 bg-expense/10 border border-expense/20 rounded-lg flex items-center gap-2.5 text-expense text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
 
      {success && (
        <div className="p-3.5 mb-4 bg-income/10 border border-income/20 rounded-lg flex items-center gap-2.5 text-income text-sm font-semibold animate-pulse">
          <Check size={18} className="p-0.5 bg-income/20 rounded-full" />
          <span>Aporte executado e ordens gravadas com sucesso no livro-razão!</span>
        </div>
      )}
 
      {simulatedRows.length > 0 && (
        <div className="space-y-5 animate-page-enter">
          <div className="overflow-x-auto border border-border/40 rounded-xl bg-background/50">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="p-3.5 font-semibold text-secondary">Ticker</th>
                  <th className="p-3.5 font-semibold text-secondary text-center">% Atual</th>
                  <th className="p-3.5 font-semibold text-secondary text-center">% Alvo</th>
                  <th className="p-3.5 font-semibold text-secondary text-right">Déficit (Gap)</th>
                  <th className="p-3.5 font-semibold text-secondary text-right">Valor Sugerido</th>
                  <th className="p-3.5 font-semibold text-secondary text-center">Operação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {simulatedRows.map(row => (
                  <tr
                    key={row.ticker}
                    className={`hover:bg-muted/10 transition-colors ${
                      row.operation === 'Comprar' ? 'bg-income/[0.015]' : ''
                    }`}
                  >
                    <td className="p-3.5 font-bold text-primary">{row.ticker}</td>
                    <td className="p-3.5 text-center text-secondary font-medium">{row.currentPercentage}%</td>
                    <td className="p-3.5 text-center text-income font-bold">{row.targetPercentage}%</td>
                    <td className={`p-3.5 text-right font-semibold ${row.gap > 0 ? 'text-expense/90' : 'text-income'}`}>
                      {row.gap > 0 ? formatCurrency(row.gap) : 'Zerar/Excedente'}
                    </td>
                    <td className="p-3.5 text-right font-extrabold text-primary">
                      {row.suggestedValue > 0 ? formatCurrency(row.suggestedValue) : formatCurrency(0)}
                      {row.sharesToBuy > 0 && (
                        <span className="block text-[10px] text-secondary font-normal mt-0.5">
                          ~ {formatQuantityBR(row.sharesToBuy)} cotas
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${
                          row.operation === 'Comprar'
                            ? 'bg-income/10 text-income border border-income/20'
                            : 'bg-muted text-secondary border border-border/40'
                        }`}
                      >
                        {row.operation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border/40 rounded-xl bg-muted/10">
            <div className="text-sm text-secondary">
              O saldo sugerido será debitado do novo aporte de{' '}
              <strong className="text-primary">
                {formatCurrency(parseFloat(contributionAmount) || 0)}
              </strong>{' '}
              e distribuído automaticamente.
            </div>
            <Button
              onClick={handleExecuteContribution}
              disabled={isSaving}
              variant="primary"
              className="w-full sm:w-auto font-bold px-6 shadow-md flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Gravando Lançamentos...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Confirmar e Executar Aporte
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
