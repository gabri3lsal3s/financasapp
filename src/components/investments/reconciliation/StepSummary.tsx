import { FileCheck, Layers, AlertCircle, ChevronDown } from 'lucide-react'
import B3ReconciliationKpiGrid from '@/components/investments/B3ReconciliationKpiGrid'
import { formatQuantityBR } from '@/utils/format'
import type { InvestmentReconciliationResult, B3ParseDedupeStats } from '@/utils/investmentExcelReconciliation'
import type { ConflictDraft, MissingDraft } from '@/hooks/useReconciliationState'

interface StepSummaryProps {
  reconciliation: InvestmentReconciliationResult
  conflictDrafts: ConflictDraft[]
  missingDrafts: MissingDraft[]
  positionPreviewRows: Array<{ ticker: string; b3: number; system: number }>
  detectedManualAssets: Array<{ ticker: string; product_name: string; type: 'fixed_income' | 'treasury' }>
  excludedCount: {
    fixedIncome: number
    treasury: number
    ignoredByMovement: number
    subscriptionRights: number
    dedupe: B3ParseDedupeStats
  }
}

export default function StepSummary({
  reconciliation,
  conflictDrafts,
  missingDrafts,
  positionPreviewRows,
  detectedManualAssets,
  excludedCount,
}: StepSummaryProps) {
  const totalItems =
    reconciliation.matched.length + conflictDrafts.filter((c) => !c.applied).length + missingDrafts.length
  const matchRate = totalItems > 0 ? Math.round((reconciliation.matched.length / totalItems) * 100) : 100

  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (matchRate / 100) * circumference

  return (
    <div className="space-y-4 animate-page-enter text-left">
      <div className="flex items-center gap-3 border-b modal-section-divider pb-3">
        <div className="w-10 h-10 rounded-xl bg-income/10 flex items-center justify-center text-income shrink-0">
          <FileCheck size={20} />
        </div>
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-tight">Diagnóstico Eletrônico</h4>
          <p className="text-[11px] text-secondary">cruzamento de lançamentos e históricos finalizado.</p>
        </div>
      </div>

      {/* Glassmorphic Match Rate Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center modal-panel-glass p-4">
        <div className="md:col-span-4 flex flex-col items-center justify-center py-2 border-b md:border-b-0 md:border-r modal-section-divider">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={radius} className="stroke-border/20 fill-none" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-income fill-none transition-all duration-1000 ease-out"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-2xl font-black font-mono tracking-tighter text-income tabular-nums">{matchRate}%</p>
              <p className="text-[8px] font-black uppercase text-secondary opacity-60 tracking-wider">Alinhados</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-8 space-y-1.5 px-2">
          <h5 className="text-xs font-black text-primary uppercase tracking-tight">Nível de Coincidência da Carteira</h5>
          <p className="text-[11px] text-secondary leading-relaxed">
            {matchRate === 100 ? (
              <span className="text-income font-semibold">
                Conciliação perfeita encontrada! Todos os lançamentos da B3 já estão catalogados e corretos no livro-razão.
              </span>
            ) : matchRate >= 80 ? (
              <span>
                Sua carteira está altamente integrada com o sistema. Há apenas algumas{' '}
                <strong className="text-warning">{conflictDrafts.filter((c) => !c.applied).length} divergências</strong> e{' '}
                <strong className="text-expense">{missingDrafts.length} transações faltantes</strong> a regularizar.
              </span>
            ) : (
              <span>
                Auditoria iniciada. Detectamos desvios significativos no histórico. Recomendamos aplicar as correções e
                importações recomendadas para restabelecer a precisão da carteira.
              </span>
            )}
          </p>
          <p className="text-[10px] text-secondary opacity-70">
            O sistema processou{' '}
            <strong className="text-primary font-bold">{totalItems} transações</strong> no extrato de negociações da B3.
          </p>
        </div>
      </div>

      <B3ReconciliationKpiGrid
        items={[
          {
            label: 'OK',
            value: reconciliation.matched.length,
            hint: 'Lançamentos em perfeita conformidade',
            tone: 'ok',
          },
          {
            label: 'Divergentes',
            value: conflictDrafts.filter((c) => !c.applied).length,
            hint: 'Corrigir no passo seguinte',
            tone: 'warn',
          },
          {
            label: 'Faltando',
            value: missingDrafts.length,
            hint: 'Importar no sistema em lote',
            tone: 'error',
          },
          {
            label: 'Alertas',
            value: reconciliation.existingOnly.length,
            hint: 'Existentes apenas no livro-razão',
            tone: 'muted',
          },
        ]}
      />

      {positionPreviewRows.length > 0 && (
        <div className="modal-panel-glass w-full p-4 space-y-3">
          <p className="text-xs font-black text-primary flex items-center gap-1.5 uppercase tracking-tight">
            <Layers size={14} className="text-balance" />
            Auditoria Preliminar de Cotas de Custódia
          </p>
          <div className="divide-y divide-glass/10 border border-glass/20 rounded-2xl overflow-y-auto max-h-72 bg-glass/5 pr-1 scrollbar-thin">
            {positionPreviewRows.map((row) => {
              const delta = row.b3 - row.system
              const diff = Math.abs(delta) > 0.0001
              return (
                <div
                  key={row.ticker}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 text-xs transition-colors hover:bg-glass/10 ${
                    diff ? 'bg-warning/[0.01]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-[120px]">
                    <span className="font-extrabold text-primary font-mono text-[13px] tracking-wide">{row.ticker}</span>
                    <span
                      className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md tracking-wider whitespace-nowrap ${
                        diff ? 'bg-warning/10 text-warning' : 'bg-income/10 text-income'
                      }`}
                    >
                      {diff ? 'Ajustar' : 'Sinc.'}
                    </span>
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-3 text-right font-mono text-[11px]">
                    <div>
                      <span className="text-secondary opacity-50 text-[7.5px] uppercase block font-bold">Extrato B3</span>
                      <span className="text-primary font-bold">{formatQuantityBR(row.b3)}</span>
                    </div>
                    <div>
                      <span className="text-secondary opacity-50 text-[7.5px] uppercase block font-bold">Sistema</span>
                      <span className="text-primary font-bold">{formatQuantityBR(row.system)}</span>
                    </div>
                    <div>
                      <span className="text-secondary opacity-50 text-[7.5px] uppercase block font-bold">Desvio</span>
                      <span
                        className={`font-black ${
                          diff ? (delta > 0 ? 'text-income' : 'text-expense') : 'text-secondary opacity-40'
                        }`}
                      >
                        {diff ? `${delta > 0 ? '+' : ''}${formatQuantityBR(delta)}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Renda Fixa / Tesouro Manual Alert */}
      {detectedManualAssets.length > 0 && (
        <div className="w-full bg-warning/[0.03] border border-warning/15 rounded-2xl p-3.5 text-left flex gap-2.5 items-start animate-page-enter">
          <AlertCircle size={15} className="text-warning shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1.5 w-full">
            <p className="text-xs font-bold text-warning uppercase tracking-tight">
              Ativos de Renda Fixa e Tesouro Detectados
            </p>
            <p className="text-[10px] text-secondary leading-relaxed">
              Esses ativos não são conciliados de forma automática. Adicione-os manualmente no Livro-Razão se necessário:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {detectedManualAssets.map((asset) => (
                <div
                  key={asset.ticker}
                  className="bg-primary/5 border border-glass/30 rounded-xl px-2.5 py-1.5 flex flex-col justify-center"
                >
                  <span className="text-[10px] font-black text-primary font-mono">{asset.ticker}</span>
                  {asset.product_name && (
                    <span className="text-[8px] text-secondary truncate" title={asset.product_name}>
                      {asset.product_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Excluded items banner */}
      {(excludedCount.ignoredByMovement > 0 ||
        excludedCount.subscriptionRights > 0 ||
        excludedCount.dedupe.ignoredInternal > 0 ||
        excludedCount.dedupe.ignoredCorporate > 0 ||
        excludedCount.dedupe.dedupedTrades > 0) && (
        <details className="w-full bg-glass/5 border border-glass/20 rounded-2xl p-3 text-left transition-all duration-300 group">
          <summary className="text-[10px] font-bold text-secondary cursor-pointer select-none flex items-center justify-between outline-none">
            <span className="flex items-center gap-2">
              <AlertCircle size={13} className="text-secondary opacity-70" />
              Visualizar linhas desconsideradas do parser B3 (
              {excludedCount.ignoredByMovement +
                excludedCount.subscriptionRights +
                excludedCount.dedupe.ignoredInternal +
                excludedCount.dedupe.ignoredCorporate +
                excludedCount.dedupe.dedupedTrades}
              )
            </span>
            <ChevronDown size={13} className="text-secondary transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="text-[9.5px] text-secondary opacity-80 leading-relaxed mt-2 pl-5 space-y-1">
            <p>
              A conciliação automatizada considera apenas <strong>negociações, proventos e eventos corporativos</strong> de
              renda variável.
            </p>
            <p className="list-disc pl-3">
              {excludedCount.ignoredByMovement > 0 && (
                <span>
                  • <strong>{excludedCount.ignoredByMovement}</strong> linha
                  {excludedCount.ignoredByMovement > 1 ? 's' : ''} ignorada
                  {excludedCount.ignoredByMovement > 1 ? 's' : ''} no parse (transferências internas, empréstimos,
                  etc).<br />
                </span>
              )}
              {excludedCount.dedupe.ignoredInternal > 0 && (
                <span>
                  • <strong>{excludedCount.dedupe.ignoredInternal}</strong> espelho
                  {excludedCount.dedupe.ignoredInternal > 1 ? 's' : ''} de transferência Crédito/Débito removido
                  {excludedCount.dedupe.ignoredInternal > 2 ? 's' : ''}.<br />
                </span>
              )}
              {excludedCount.dedupe.ignoredCorporate > 0 && (
                <span>
                  • <strong>{excludedCount.dedupe.ignoredCorporate}</strong> cessão
                  {excludedCount.dedupe.ignoredCorporate > 1 ? 'ões' : 'ão'} de direitos removida
                  {excludedCount.dedupe.ignoredCorporate > 1 ? 's' : ''}.<br />
                </span>
              )}
              {excludedCount.dedupe.dedupedTrades > 0 && (
                <span>
                  • <strong>{excludedCount.dedupe.dedupedTrades}</strong> compra/venda redundante
                  {excludedCount.dedupe.dedupedTrades > 1 ? 's' : ''} (já coberta pela liquidação).<br />
                </span>
              )}
              {excludedCount.subscriptionRights > 0 && (
                <span>
                  • <strong>{excludedCount.subscriptionRights}</strong> direito
                  {excludedCount.subscriptionRights > 1 ? 's' : ''} de subscrição (ticker temporário).
                </span>
              )}
            </p>
          </div>
        </details>
      )}
    </div>
  )
}
