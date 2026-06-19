import { useEffect, useRef, useState } from 'react'
import { AssetPosition } from '@/services/investmentEngine'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { BookOpen, CheckCircle2, Circle, Edit3, Save, Trash2, Info, RotateCcw } from 'lucide-react'

interface AssetThesesEditorProps {
  positions: AssetPosition[]
  assetTheses: Record<string, string>
  editingThesisTicker: string
  setEditingThesisTicker: (ticker: string) => void
  thesisText: string
  setThesisText: (text: string) => void
  savingThesis: boolean
  onSaveThesis: () => void
  onDeleteThesis: (ticker: string) => void
}

export default function AssetThesesEditor({
  positions,
  assetTheses,
  editingThesisTicker,
  setEditingThesisTicker,
  thesisText,
  setThesisText,
  savingThesis,
  onSaveThesis,
  onDeleteThesis,
}: AssetThesesEditorProps) {
  const [deleteConfirmTicker, setDeleteConfirmTicker] = useState<string>('')
  const thesisTextareaRef = useRef<HTMLTextAreaElement>(null)

  const activePositions = positions.filter((p) => !p.ticker.startsWith('__'))
  const activeThesesKeys = Object.keys(assetTheses).filter(
    (t) => !t.startsWith('__') && assetTheses[t]?.trim()
  )
  const thesesFilledCount = activePositions.filter(
    (p) => assetTheses[p.ticker.toUpperCase()]?.trim()
  ).length
  const totalPositions = activePositions.length

  const progressPct =
    totalPositions === 0 ? 0 : Math.round((thesesFilledCount / totalPositions) * 100)

  // Focus editor textarea on select
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
      {/* Progresso & Resumo de Cobertura */}
      <Card className="p-5 lg:p-6 text-left relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-balance/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 bg-balance/10 text-balance rounded-xl shrink-0">
              <BookOpen size={18} className="text-balance" />
            </div>
            <div>
              <h4 className="font-black text-sm text-primary">Teses e Cobertura Fundamentalista</h4>
              <p className="text-[11px] text-secondary font-sans mt-0.5">
                Registre teses e acompanhamentos específicos para fundamentar o relatório final.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Radial Progress Ring */}
            <div className="relative w-12 h-12 shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="text-muted/30"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - progressPct / 100)}`}
                  className="text-balance transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-primary">{progressPct}%</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-semibold font-sans">
              {thesesFilledCount === totalPositions && totalPositions > 0 ? (
                <CheckCircle2 size={13} className="text-income shrink-0" />
              ) : (
                <Circle size={13} className="text-secondary/40 shrink-0" />
              )}
              <span className="text-secondary">
                Teses registradas:{' '}
                <span className="text-primary font-bold">
                  {thesesFilledCount}/{totalPositions}
                </span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Seletor e Editor em Duas Colunas */}
      <Card className="p-5 lg:p-6 text-left">
        {activePositions.length === 0 ? (
          <div className="flex items-center gap-3 p-5 modal-panel-glass border border-dashed border-glass text-secondary text-xs font-sans">
            <Info size={14} className="shrink-0 text-muted" />
            Adicione compras ou metas para liberar o cadastro de teses de investimentos.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista Lateral de Ativos (5 de 12 colunas) */}
            <div className="lg:col-span-5 space-y-2">
              <p className="text-[10px] uppercase font-extrabold tracking-wider text-secondary mb-1.5 font-sans">
                Selecione um ativo para analisar
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {activePositions.map((pos) => {
                  const ticker = pos.ticker.toUpperCase()
                  const hasThesis = !!assetTheses[ticker]?.trim()
                  const isEditing = editingThesisTicker === ticker
                  const isConfirmDelete = deleteConfirmTicker === ticker

                  return (
                    <div
                      key={ticker}
                      className={`group relative rounded-xl border transition-all duration-200 ${
                        isEditing
                          ? 'border-balance bg-balance/5 shadow-sm'
                          : hasThesis
                          ? 'border-income/20 bg-income/[0.02] hover:border-income/40'
                          : 'border-glass bg-muted/5 hover:border-balance/20 hover:bg-balance/3'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectTicker(ticker)}
                        className="w-full p-2.5 text-left flex items-center gap-2.5"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                            hasThesis ? 'bg-income' : 'bg-secondary/40 group-hover:bg-balance'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-primary font-mono">{ticker}</span>
                            {hasThesis && (
                              <span className="text-[8px] font-bold text-income bg-income/10 px-1.5 py-0.25 rounded-full uppercase tracking-wider">
                                Coberto
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-secondary truncate font-sans mt-0.5">
                            {hasThesis
                              ? assetTheses[ticker]
                              : `Objetivo: ${pos.target_percentage}% · Atual: ${pos.current_percentage}%`}
                          </p>
                        </div>
                        <Edit3
                          size={11}
                          className={`shrink-0 transition-colors ${
                            isEditing ? 'text-balance' : 'text-secondary/40 group-hover:text-balance'
                          }`}
                        />
                      </button>

                      {hasThesis && isEditing && !isConfirmDelete && (
                        <div className="px-2.5 pb-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTicker(ticker)}
                            className="text-[9px] font-bold text-expense hover:text-expense/80 flex items-center gap-1 transition-colors uppercase tracking-wider"
                          >
                            <Trash2 size={10} /> Excluir Tese
                          </button>
                        </div>
                      )}

                      {isConfirmDelete && (
                        <div className="px-2.5 pb-2.5 flex items-center gap-2 bg-expense/5 rounded-b-xl border-t border-expense/10 mt-1 pt-2">
                          <span className="text-[9px] text-expense font-semibold flex-1 font-sans">
                            Excluir tese de {ticker}?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteThesis(ticker)
                              setDeleteConfirmTicker('')
                            }}
                            className="text-[9px] font-black text-expense hover:bg-expense/10 transition-colors px-2 py-0.5 rounded-lg"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTicker('')}
                            className="text-[9px] font-bold text-secondary hover:text-primary transition-colors"
                          >
                            Não
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Orfãos */}
              {activeThesesKeys.filter(
                (t) => !activePositions.some((p) => p.ticker.toUpperCase() === t)
              ).length > 0 && (
                <div className="pt-2 border-t border-glass mt-2">
                  <p className="text-[9px] uppercase font-extrabold tracking-wider text-secondary mb-1.5 font-sans">
                    Teses de Ativos Removidos
                  </p>
                  {activeThesesKeys
                    .filter((t) => !activePositions.some((p) => p.ticker.toUpperCase() === t))
                    .map((ticker) => (
                      <div
                        key={ticker}
                        className="flex items-center justify-between p-2 rounded-xl modal-panel-glass border-glass mb-1"
                      >
                        <span className="text-[10px] font-bold text-secondary font-mono">{ticker}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteThesis(ticker)}
                          className="text-[9px] text-expense hover:text-expense/80 transition-colors flex items-center gap-1 font-sans uppercase font-bold"
                        >
                          <Trash2 size={10} /> Limpar
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Caixa do Editor (7 de 12 colunas) */}
            <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-glass pt-4 lg:pt-0 lg:pl-6">
              {editingThesisTicker ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-extrabold tracking-wider text-secondary font-sans">
                      Análise Fundamentalista de:{' '}
                      <span className="text-balance font-mono">{editingThesisTicker}</span>
                    </p>
                    <span className="text-[9px] text-secondary font-mono font-semibold">
                      {thesisText.length} caracteres
                    </span>
                  </div>
                  <textarea
                    ref={thesisTextareaRef}
                    rows={8}
                    value={thesisText}
                    onChange={(e) => setThesisText(e.target.value)}
                    placeholder={`Escreva a justificativa de peso, perspectivas econômicas ou catalisadores da tese de ${editingThesisTicker}...`}
                    className="w-full bg-primary text-primary text-xs rounded-xl border border-primary p-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] font-sans leading-relaxed resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={onSaveThesis}
                      disabled={savingThesis || !thesisText.trim()}
                      variant="secondary"
                      className="text-xs font-black flex-1 py-2 h-10 rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Save size={13} />
                      {savingThesis ? 'Salvando...' : 'Salvar Tese'}
                    </Button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-2 text-xs font-bold text-secondary hover:text-primary rounded-xl transition-all hover:bg-muted/10 border border-glass"
                      title="Descartar"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-11 h-11 rounded-2xl bg-balance/10 flex items-center justify-center mb-3">
                    <Edit3 size={18} className="text-balance" />
                  </div>
                  <p className="text-xs font-bold text-primary mb-1">Escrever Análise de Ativo</p>
                  <p className="text-[10px] text-secondary font-sans max-w-[220px] leading-relaxed">
                    Clique em qualquer ticker na lista lateral para cadastrar a tese fundamentalista que aparecerá no relatório PDF do cliente.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
