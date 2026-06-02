import { useEffect, useRef, useState } from 'react'
import { AssetPosition } from '@/services/investmentEngine'
import Card from '@/components/Card'
import Button from '@/components/Button'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Download,
  Edit3,
  FileText,
  Info,
  Percent,
  RotateCcw,
  Save,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

interface QualitativeAnalysisProps {
  // Teses
  positions: AssetPosition[]
  assetTheses: Record<string, string>
  editingThesisTicker: string
  setEditingThesisTicker: (ticker: string) => void
  thesisText: string
  setThesisText: (text: string) => void
  savingThesis: boolean
  onSaveThesis: () => void
  onDeleteThesis: (ticker: string) => void

  // Relatório
  executiveSummary: string
  setExecutiveSummary: (text: string) => void
  nextMonthPlan: string
  setNextMonthPlan: (text: string) => void
  savingReport: boolean
  onSaveReport: () => void

  // PDF Export
  portfolioValue: number
  billingFeeRate: number
  setBillingFeeRate: (rate: number) => void
  onExportPDF: () => void
}

function wordCount(text: string) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

function charCount(text: string) {
  return text.length
}

export default function QualitativeAnalysis({
  positions,
  assetTheses,
  editingThesisTicker,
  setEditingThesisTicker,
  thesisText,
  setThesisText,
  savingThesis,
  onSaveThesis,
  onDeleteThesis,
  executiveSummary,
  setExecutiveSummary,
  nextMonthPlan,
  setNextMonthPlan,
  savingReport,
  onSaveReport,
  portfolioValue,
  billingFeeRate,
  setBillingFeeRate,
  onExportPDF,
}: QualitativeAnalysisProps) {
  const [deleteConfirmTicker, setDeleteConfirmTicker] = useState<string>('')
  const thesisTextareaRef = useRef<HTMLTextAreaElement>(null)

  const activePositions = positions.filter(
    p => !p.ticker.startsWith('__')
  )
  const activeThesesKeys = Object.keys(assetTheses).filter(
    t => !t.startsWith('__') && assetTheses[t]?.trim()
  )
  const thesesFilledCount = activePositions.filter(p =>
    assetTheses[p.ticker.toUpperCase()]?.trim()
  ).length
  const totalPositions = activePositions.length

  const hasSummary = executiveSummary.trim().length > 0
  const hasPlan = nextMonthPlan.trim().length > 0

  const progressPct =
    totalPositions === 0
      ? 0
      : Math.round((thesesFilledCount / totalPositions) * 100)

  const monthlyFeeAmount = portfolioValue * (billingFeeRate / 100)
  const annualFeeRate = billingFeeRate * 12

  // Foco automático ao abrir editor de tese
  useEffect(() => {
    if (editingThesisTicker && thesisTextareaRef.current) {
      thesisTextareaRef.current.focus()
    }
  }, [editingThesisTicker])

  const handleSelectTicker = (ticker: string) => {
    if (editingThesisTicker === ticker) {
      setEditingThesisTicker('')
      setThesisText('')
    } else {
      setEditingThesisTicker(ticker)
      setThesisText(assetTheses[ticker.toUpperCase()] || '')
    }
    setDeleteConfirmTicker('')
  }

  const handleCancelEdit = () => {
    setEditingThesisTicker('')
    setThesisText('')
    setDeleteConfirmTicker('')
  }

  return (
    <div className="space-y-6">

      {/* ─── SEÇÃO A: Cabeçalho com Progresso ─────────────────────────── */}
      <Card className="p-5 lg:p-6 border border-border/40 shadow-sm text-left">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Ícone + Título */}
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 bg-balance/10 text-balance rounded-xl shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-primary leading-tight">
                Análise Qualitativa &amp; Relatório
              </h3>
              <p className="text-[11px] text-secondary font-sans mt-0.5">
                Teses por ativo · Sumário executivo · Planejamento mensal · Exportação PDF
              </p>
            </div>
          </div>

          {/* Métricas de Preenchimento */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Progress Ring */}
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28" cy="28" r="22"
                  fill="none" stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/30"
                />
                <circle
                  cx="28" cy="28" r="22"
                  fill="none" stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - progressPct / 100)}`}
                  className="text-balance transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-black text-primary">{progressPct}%</span>
              </div>
            </div>

            {/* Status chips */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold font-sans">
                {thesesFilledCount === totalPositions && totalPositions > 0 ? (
                  <CheckCircle2 size={12} className="text-income" />
                ) : (
                  <Circle size={12} className="text-muted" />
                )}
                <span className="text-secondary">
                  Teses: <span className="text-primary font-bold">{thesesFilledCount}/{totalPositions}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold font-sans">
                {hasSummary ? (
                  <CheckCircle2 size={12} className="text-income" />
                ) : (
                  <Circle size={12} className="text-muted" />
                )}
                <span className={hasSummary ? 'text-income font-bold' : 'text-secondary'}>
                  Sumário {hasSummary ? '✓' : '∅'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold font-sans">
                {hasPlan ? (
                  <CheckCircle2 size={12} className="text-income" />
                ) : (
                  <Circle size={12} className="text-muted" />
                )}
                <span className={hasPlan ? 'text-income font-bold' : 'text-secondary'}>
                  Planejamento {hasPlan ? '✓' : '∅'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── SEÇÃO B: Teses por Ativo ─────────────────────────────────── */}
      <Card className="p-5 lg:p-6 border border-border/40 shadow-sm text-left">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-balance" />
            <h4 className="font-black text-sm text-primary">Teses Fundamentalistas por Ativo</h4>
          </div>
          {editingThesisTicker && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex items-center gap-1 text-[10px] font-bold text-secondary hover:text-primary transition-colors"
            >
              <X size={11} /> Cancelar edição
            </button>
          )}
        </div>

        {activePositions.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-muted/10 rounded-xl border border-dashed border-border/40 text-secondary text-xs font-sans">
            <Info size={14} className="shrink-0 text-muted" />
            Nenhum ativo em carteira. Adicione transações para habilitar as teses.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Lista de ativos */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-extrabold tracking-wider text-secondary mb-2 font-sans">
                Clique em um ativo para editar sua tese
              </p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                {activePositions.map(pos => {
                  const ticker = pos.ticker.toUpperCase()
                  const hasThesis = !!assetTheses[ticker]?.trim()
                  const isEditing = editingThesisTicker === ticker
                  const isConfirmDelete = deleteConfirmTicker === ticker

                  return (
                    <div
                      key={ticker}
                      className={`group relative rounded-xl border transition-all duration-200 ${
                        isEditing
                          ? 'border-balance/50 bg-balance/5 shadow-sm'
                          : hasThesis
                          ? 'border-income/20 bg-income/[0.03] hover:border-income/40'
                          : 'border-border/30 bg-muted/5 hover:border-balance/20 hover:bg-balance/3'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectTicker(ticker)}
                        className="w-full p-3 text-left flex items-center gap-3"
                      >
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                          hasThesis ? 'bg-income' : 'bg-muted/50 group-hover:bg-balance'
                        }`} />

                        {/* Ticker + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-primary font-mono">{ticker}</span>
                            {hasThesis && (
                              <span className="text-[9px] font-bold text-income bg-income/10 px-1.5 py-0.5 rounded-full">
                                ✓ com tese
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-secondary truncate font-sans mt-0.5">
                            {hasThesis
                              ? assetTheses[ticker].slice(0, 60) + (assetTheses[ticker].length > 60 ? '…' : '')
                              : `Alvo: ${pos.target_percentage}% · Atual: ${pos.current_percentage}%`}
                          </p>
                        </div>

                        {/* Edit indicator */}
                        <Edit3
                          size={12}
                          className={`shrink-0 transition-colors ${
                            isEditing ? 'text-balance' : 'text-muted group-hover:text-balance'
                          }`}
                        />
                      </button>

                      {/* Confirm delete inline */}
                      {hasThesis && isEditing && !isConfirmDelete && (
                        <div className="px-3 pb-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTicker(ticker)}
                            className="text-[10px] font-bold text-red-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={10} /> Excluir tese
                          </button>
                        </div>
                      )}
                      {isConfirmDelete && (
                        <div className="px-3 pb-3 flex items-center gap-2 bg-red-500/5 rounded-b-xl border-t border-red-500/10 mt-1 pt-2">
                          <span className="text-[10px] text-red-500 font-semibold flex-1 font-sans">
                            Confirmar exclusão da tese de {ticker}?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteThesis(ticker)
                              setDeleteConfirmTicker('')
                            }}
                            className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors px-2 py-0.5 bg-red-500/10 rounded-lg"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTicker('')}
                            className="text-[10px] font-bold text-secondary hover:text-primary transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Teses de ativos NÃO em carteira (orfãos) */}
              {activeThesesKeys.filter(t => !activePositions.some(p => p.ticker.toUpperCase() === t)).length > 0 && (
                <div className="pt-2 border-t border-border/20">
                  <p className="text-[10px] uppercase font-extrabold tracking-wider text-muted mb-1.5 font-sans">
                    Teses de ativos fora da carteira
                  </p>
                  {activeThesesKeys
                    .filter(t => !activePositions.some(p => p.ticker.toUpperCase() === t))
                    .map(ticker => (
                      <div key={ticker} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border/20 mb-1">
                        <span className="text-xs font-bold text-secondary font-mono">{ticker}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteThesis(ticker)}
                          className="text-[10px] text-red-400 hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={10} /> Remover
                        </button>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Editor de tese */}
            <div className="space-y-3">
              {editingThesisTicker ? (
                <div className="animate-page-enter space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
                      Editando tese de{' '}
                      <span className="text-balance font-mono">{editingThesisTicker}</span>
                    </p>
                    <span className="text-[10px] text-secondary font-mono font-semibold">
                      {charCount(thesisText)} chars
                    </span>
                  </div>
                  <textarea
                    ref={thesisTextareaRef}
                    rows={10}
                    value={thesisText}
                    onChange={e => setThesisText(e.target.value)}
                    placeholder={`Escreva a análise fundamentalista de ${editingThesisTicker}: tese de investimento, catalisadores, riscos e horizonte de alocação. Este texto será incluído no relatório PDF do cliente.`}
                    className="w-full p-3 border rounded-xl bg-primary text-primary placeholder-[var(--color-text-secondary)] hover:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all border-[var(--color-border)] text-xs resize-none font-sans leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={onSaveThesis}
                      disabled={savingThesis || !thesisText.trim()}
                      variant="secondary"
                      className="text-xs font-black flex-1 py-2 flex items-center justify-center gap-1.5"
                    >
                      <Save size={13} />
                      {savingThesis ? 'Salvando…' : `Salvar Tese de ${editingThesisTicker}`}
                    </Button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-2 text-xs font-bold text-secondary hover:text-primary border border-border/40 rounded-xl transition-all hover:bg-muted/10"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-balance/10 flex items-center justify-center mb-3">
                    <Edit3 size={22} className="text-balance" />
                  </div>
                  <p className="text-sm font-bold text-primary mb-1">Selecione um ativo</p>
                  <p className="text-[11px] text-secondary font-sans max-w-[200px]">
                    Clique em qualquer ativo na lista ao lado para escrever ou editar sua tese fundamentalista.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ─── SEÇÃO C: Relatório do Período ────────────────────────────── */}
      <Card className="p-5 lg:p-6 border border-border/40 shadow-sm text-left">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-balance" />
            <h4 className="font-black text-sm text-primary">Relatório do Período</h4>
          </div>
          <Button
            size="sm"
            onClick={onSaveReport}
            disabled={savingReport}
            variant="secondary"
            className="text-xs font-black py-1.5 px-4 flex items-center gap-1.5"
          >
            <Save size={13} />
            {savingReport ? 'Salvando…' : 'Salvar Relatório'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sumário Executivo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
                Sumário Executivo
              </label>
              <div className="flex items-center gap-2">
                {hasSummary && (
                  <span className="text-[9px] font-bold text-income bg-income/10 px-1.5 py-0.5 rounded-full">
                    ✓ preenchido
                  </span>
                )}
                <span className="text-[10px] text-secondary font-mono font-semibold">
                  {wordCount(executiveSummary)} palavras
                </span>
              </div>
            </div>
            <textarea
              rows={10}
              value={executiveSummary}
              onChange={e => setExecutiveSummary(e.target.value)}
              onBlur={onSaveReport}
              placeholder="Descreva o desempenho da carteira no período, principais movimentos realizados, contexto macroeconômico relevante e destaques positivos e negativos. Este texto aparecerá na capa do relatório PDF."
              className="w-full p-3 border rounded-xl bg-primary text-primary placeholder-[var(--color-text-secondary)] hover:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all border-[var(--color-border)] text-xs resize-none font-sans leading-relaxed"
            />
            <p className="text-[10px] text-muted font-sans">
              💡 Auto-salvo ao sair do campo. Aparece na capa do PDF.
            </p>
          </div>

          {/* Planejamento Próximo Mês */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
                Planejamento para o Próximo Mês
              </label>
              <div className="flex items-center gap-2">
                {hasPlan && (
                  <span className="text-[9px] font-bold text-income bg-income/10 px-1.5 py-0.5 rounded-full">
                    ✓ preenchido
                  </span>
                )}
                <span className="text-[10px] text-secondary font-mono font-semibold">
                  {wordCount(nextMonthPlan)} palavras
                </span>
              </div>
            </div>
            <textarea
              rows={10}
              value={nextMonthPlan}
              onChange={e => setNextMonthPlan(e.target.value)}
              onBlur={onSaveReport}
              placeholder="Descreva os aportes previstos, rebalanceamentos planejados, ativos em observação, estratégia setorial e objetivos para o próximo ciclo mensal."
              className="w-full p-3 border rounded-xl bg-primary text-primary placeholder-[var(--color-text-secondary)] hover:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all border-[var(--color-border)] text-xs resize-none font-sans leading-relaxed"
            />
            <p className="text-[10px] text-muted font-sans">
              💡 Auto-salvo ao sair do campo. Incluído na seção qualitativa do PDF.
            </p>
          </div>
        </div>
      </Card>

      {/* ─── SEÇÃO D: Exportação PDF ────────────────────────────────────── */}
      <Card className="p-5 lg:p-6 border border-border/40 shadow-sm text-left relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-balance/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-5">
          <Download size={16} className="text-balance" />
          <h4 className="font-black text-sm text-primary">Exportar Relatório Institucional</h4>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview Checklist */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
              O que será gerado no PDF
            </p>
            <div className="space-y-2">
              {[
                {
                  label: 'Capa institucional',
                  ok: true,
                },
                {
                  label: `Composição patrimonial (${positions.length} ativo${positions.length !== 1 ? 's' : ''})`,
                  ok: positions.length > 0,
                },
                {
                  label: `Análise de alocação por classe e setor`,
                  ok: positions.length > 0,
                },
                {
                  label: hasSummary
                    ? `Sumário executivo (${wordCount(executiveSummary)} palavras)`
                    : 'Sumário executivo (não preenchido)',
                  ok: hasSummary,
                },
                {
                  label: hasPlan
                    ? `Planejamento próximo mês (${wordCount(nextMonthPlan)} palavras)`
                    : 'Planejamento próximo mês (não preenchido)',
                  ok: hasPlan,
                },
                {
                  label:
                    thesesFilledCount > 0
                      ? `Teses fundamentalistas (${thesesFilledCount}/${totalPositions} ativos)`
                      : 'Teses fundamentalistas (nenhuma cadastrada)',
                  ok: thesesFilledCount > 0,
                },
                {
                  label: `Demonstrativo de fee (${formatCurrency(monthlyFeeAmount)}/mês)`,
                  ok: portfolioValue > 0,
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs font-sans">
                  {item.ok ? (
                    <CheckCircle2 size={14} className="text-income shrink-0" />
                  ) : (
                    <Circle size={14} className="text-muted shrink-0" />
                  )}
                  <span className={item.ok ? 'text-primary font-semibold' : 'text-secondary'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fee + Export */}
          <div className="space-y-4">
            {/* Fee slider */}
            <div className="p-4 bg-muted/20 rounded-xl border border-border/40">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-secondary flex items-center gap-1 font-sans">
                  <Percent size={11} className="text-balance" />
                  Taxa de Gestão Mensal
                </label>
                <span className="text-sm font-black text-balance font-mono">
                  {formatNumberBR(billingFeeRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.01"
                value={billingFeeRate}
                onChange={e => setBillingFeeRate(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-balance transition-all hover:bg-muted/80 focus:outline-none mb-1"
              />
              <div className="flex justify-between text-[9px] text-secondary font-medium font-sans mb-3">
                <span>0.05%</span>
                <span>0.50%</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-primary rounded-lg border border-border/30 text-center">
                  <p className="text-[9px] text-secondary uppercase font-semibold font-sans">Mensal</p>
                  <p className="text-sm font-black text-primary font-mono">
                    {formatCurrency(monthlyFeeAmount)}
                  </p>
                </div>
                <div className="p-2.5 bg-primary rounded-lg border border-border/30 text-center">
                  <p className="text-[9px] text-secondary uppercase font-semibold font-sans">Anual ({formatNumberBR(annualFeeRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</p>
                  <p className="text-sm font-black text-primary font-mono">
                    {formatCurrency(monthlyFeeAmount * 12)}
                  </p>
                </div>
              </div>
            </div>

            {/* Export button */}
            <Button
              onClick={onExportPDF}
              variant="primary"
              fullWidth
              className="font-black shadow-md shadow-balance/20 flex items-center justify-center gap-2 py-3 transition-all text-sm"
            >
              <Download size={18} />
              Gerar Relatório PDF
            </Button>

            <div className="flex gap-2 p-3 bg-balance/5 rounded-xl border border-balance/10 text-[10px] text-secondary font-sans leading-relaxed">
              <Info size={13} className="text-balance shrink-0 mt-0.5" />
              <span>
                O relatório é gerado localmente em alta resolução vetorial, incluindo todos os dados preenchidos acima.
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
