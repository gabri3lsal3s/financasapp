import React from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { FileText, Download, Percent, CheckCircle2, Circle, ShieldCheck, Save } from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface ReportAndBillingProps {
  // Notas da Assessoria (Uso Interno)
  clientNotes: string
  setClientNotes: (notes: string) => void
  onSaveNotes: (e: React.FormEvent) => void
  savingNotes: boolean

  // Relatório do Período
  executiveSummary: string
  setExecutiveSummary: (text: string) => void
  nextMonthPlan: string
  setNextMonthPlan: (text: string) => void
  savingReport: boolean
  onSaveReport: () => void

  // Faturamento e PDF
  portfolioValue: number
  billingFeeRate: number
  setBillingFeeRate: (rate: number) => void
  positionsCount: number
  thesesCount: number
  totalPositions: number
  onExportPDF: () => void
}

function wordCount(text: string) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function ReportAndBilling({
  clientNotes,
  setClientNotes,
  onSaveNotes,
  savingNotes,
  executiveSummary,
  setExecutiveSummary,
  nextMonthPlan,
  setNextMonthPlan,
  savingReport,
  onSaveReport,
  portfolioValue,
  billingFeeRate,
  setBillingFeeRate,
  positionsCount,
  thesesCount,
  totalPositions,
  onExportPDF,
}: ReportAndBillingProps) {
  const hasSummary = executiveSummary.trim().length > 0
  const hasPlan = nextMonthPlan.trim().length > 0
  const monthlyFeeAmount = portfolioValue * (billingFeeRate / 100)
  const annualFeeRate = billingFeeRate * 12

  // Lista do conteúdo a ser gerado no PDF
  const checklistItems = [
    { label: 'Capa institucional', ok: true },
    { label: 'Composição (' + positionsCount + ' ativos)', ok: positionsCount > 0 },
    { label: 'Análise de alocação (Classes e Setores)', ok: positionsCount > 0 },
    { label: 'Sumário executivo', ok: hasSummary },
    { label: 'Planejamento mensal', ok: hasPlan },
    { label: 'Teses fundamentalistas (' + thesesCount + '/' + totalPositions + ')', ok: thesesCount > 0 },
    { label: 'Taxa e demonstrativo de fee', ok: portfolioValue > 0 },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Coluna da Esquerda: Relatórios e Notas (8 de 12 colunas) */}
      <div className="lg:col-span-8 space-y-6">
        {/* Bloco 1: Relatório do Período */}
        <Card className="p-5 lg:p-6 text-left relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-balance/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4.5 pb-2 border-b border-primary/5">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-balance animate-pulse" />
              <h4 className="font-black text-sm text-primary">Relatório Periódico do Cliente</h4>
            </div>
            <Button
              size="xs"
              onClick={onSaveReport}
              disabled={savingReport}
              variant="secondary"
              className="text-[10px] font-black uppercase tracking-wider py-1.5 px-3 flex items-center gap-1.5"
            >
              <Save size={12} />
              {savingReport ? 'Salvando...' : 'Salvar Relatório'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sumário Executivo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
                  Sumário Executivo
                </label>
                <span className="text-[9px] text-secondary font-mono font-semibold">
                  {wordCount(executiveSummary)} p.
                </span>
              </div>
              <textarea
                rows={7}
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                onBlur={onSaveReport}
                placeholder="Descreva o desempenho geral, contexto econômico e destaques de rentabilidade. Ficará destacado na capa do PDF."
                className="w-full bg-primary text-primary text-xs rounded-xl border border-primary p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] font-sans leading-relaxed resize-none"
              ></textarea>
            </div>

            {/* Planejamento Próximo Mês */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
                  Planejamento Próximo Mês
                </label>
                <span className="text-[9px] text-secondary font-mono font-semibold">
                  {wordCount(nextMonthPlan)} p.
                </span>
              </div>
              <textarea
                rows={7}
                value={nextMonthPlan}
                onChange={(e) => setNextMonthPlan(e.target.value)}
                onBlur={onSaveReport}
                placeholder="Indique a estratégia de novos aportes, ativos sob observação ou rebalanceamentos planejados no ciclo seguinte."
                className="w-full bg-primary text-primary text-xs rounded-xl border border-primary p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] font-sans leading-relaxed resize-none"
              ></textarea>
            </div>
          </div>
          <p className="text-[9px] text-secondary italic mt-2 opacity-75">
            * O relatório qualitativo é salvo automaticamente ao clicar fora dos campos.
          </p>
        </Card>

        {/* Bloco 2: Notas Internas da Assessoria */}
        <Card className="p-5 lg:p-6 text-left relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-balance/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-balance" />
              <h4 className="font-black text-sm text-primary">Notas da Assessoria (Uso Interno)</h4>
            </div>
            <Button
              size="xs"
              onClick={onSaveNotes}
              disabled={savingNotes}
              variant="primary"
              className="text-[10px] font-black uppercase tracking-wider py-1.5 px-3 flex items-center gap-1.5"
            >
              <Save size={12} />
              {savingNotes ? 'Salvando...' : 'Salvar Notas'}
            </Button>
          </div>

          <form onSubmit={onSaveNotes} className="space-y-3">
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Notas internas sobre metas de vida do cliente, resumos de reuniões privadas e estratégias personalizadas..."
              rows={4}
              className="w-full bg-primary text-primary text-xs rounded-xl border border-primary p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] font-sans leading-relaxed resize-none"
            ></textarea>
            <p className="text-[9px] text-secondary italic opacity-75">
              * Estas anotações são confidenciais e NÃO são impressas no PDF enviado ao cliente.
            </p>
          </form>
        </Card>
      </div>

      {/* Coluna da Direita: PDF e Faturamento (4 de 12 colunas) */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="p-5 lg:p-6 text-left relative overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 bg-balance/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-primary/5">
            <Download size={16} className="text-balance" />
            <h4 className="font-black text-sm text-primary">Exportar Relatório PDF</h4>
          </div>

          {/* Checklist do Conteúdo */}
          <div className="space-y-2 mb-5">
            <p className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
              Conteúdo do Documento
            </p>
            <div className="space-y-1.5">
              {checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-sans">
                  {item.ok ? (
                    <CheckCircle2 size={13} className="text-income shrink-0" />
                  ) : (
                    <Circle size={13} className="text-secondary/40 shrink-0" />
                  )}
                  <span className={item.ok ? 'text-primary font-semibold' : 'text-secondary opacity-70'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Faturamento e Slider de Fee */}
          <div className="p-4 bg-muted/20 border border-glass rounded-2xl space-y-3.5 mb-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-secondary flex items-center gap-1 font-sans">
                <Percent size={11} className="text-balance" />
                Taxa de Gestão Mensal
              </label>
              <span className="text-xs font-black text-balance font-mono">
                {formatNumberBR(billingFeeRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.50"
              step="0.01"
              value={billingFeeRate}
              onChange={(e) => setBillingFeeRate(parseFloat(e.target.value))}
              className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-balance transition-all hover:bg-muted/80 focus:outline-none"
            />
            <div className="flex justify-between text-[8px] text-secondary font-medium font-sans">
              <span>0.05%</span>
              <span>0.50%</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1.5">
              <div className="p-2 bg-primary rounded-xl border border-glass text-center">
                <p className="text-[9px] text-secondary uppercase font-semibold font-sans">Mensal</p>
                <p className="text-xs font-black text-primary font-mono mt-0.5">
                  {formatCurrency(monthlyFeeAmount)}
                </p>
              </div>
              <div className="p-2 bg-primary rounded-xl border border-glass text-center">
                <p className="text-[9px] text-secondary uppercase font-semibold font-sans">Anual ({formatNumberBR(annualFeeRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</p>
                <p className="text-xs font-black text-primary font-mono mt-0.5">
                  {formatCurrency(monthlyFeeAmount * 12)}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={onExportPDF}
            variant="primary"
            fullWidth
            className="font-black flex items-center justify-center gap-2 py-3.5 transition-all text-xs uppercase tracking-wider h-11 rounded-xl"
          >
            <Download size={14} />
            Gerar Relatório PDF
          </Button>
        </Card>
      </div>
    </div>
  )
}
