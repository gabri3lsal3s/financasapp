import { useMemo, useState } from 'react'
import Modal from '@/components/Modal'
import { useScuttlebutt } from '@/hooks/useScuttlebutt'
import { calculateScuttlebuttScore } from '@/utils/quantamentalEngine'
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Pencil, Trash2, Plus } from 'lucide-react'

interface ScuttlebuttEvaluationModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  ticker: string
}

export default function ScuttlebuttEvaluationModal({
  isOpen,
  onClose,
  portfolioId,
  ticker
}: ScuttlebuttEvaluationModalProps) {
  const {
    loading,
    pillars,
    questions,
    answers,
    saveAnswer,
    addQuestion,
    updateQuestion,
    deleteQuestion
  } = useScuttlebutt(portfolioId, ticker)
  const [addingToPillarId, setAddingToPillarId] = useState<string | null>(null)
  const [newQuestionText, setNewQuestionText] = useState('')
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editingQuestionText, setEditingQuestionText] = useState('')
  // Calcular score local em tempo real
  const currentScore = useMemo(() => {
    if (loading || pillars.length === 0) return 100
    const res = calculateScuttlebuttScore(answers, pillars, questions)
    return res.score
  }, [answers, pillars, questions, loading])

  // Agrupar perguntas por pilar
  const groupedQuestions = useMemo(() => {
    const map: Record<string, typeof questions> = {}
    for (const q of questions) {
      if (!map[q.pillar_id]) {
        map[q.pillar_id] = []
      }
      map[q.pillar_id].push(q)
    }
    return map
  }, [questions])

  // Progresso de preenchimento
  const completionStats = useMemo(() => {
    if (questions.length === 0) return { answered: 0, total: 0, pct: 0 }
    const answered = answers.filter(a => a.answer !== null).length
    const total = questions.length
    const pct = Math.round((answered / total) * 100)
    return { answered, total, pct }
  }, [answers, questions])

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Avaliação Qualitativa (Scuttlebutt) • ${ticker.toUpperCase()}`}
      size="lg"
    >
      <div className="space-y-5 text-left">
        
        {/* Header Resumo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-glass/5 p-4 rounded-3xl border border-glass/25">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-secondary uppercase tracking-widest">Score Qualitativo Atual</h4>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-primary font-mono">{currentScore.toFixed(1)}</span>
              <span className="text-xs text-secondary font-bold">/ 100</span>
            </div>
          </div>
          
          <div className="sm:text-right space-y-1.5 flex-1 max-w-[240px]">
            <div className="flex justify-between items-center text-[10px] font-bold text-secondary">
              <span>Progresso da Avaliação</span>
              <span>{completionStats.answered} de {completionStats.total} ({completionStats.pct}%)</span>
            </div>
            <div className="w-full h-2 bg-glass/20 rounded-full overflow-hidden border border-glass/20">
              <div 
                className="h-full bg-brand rounded-full transition-all duration-300"
                style={{ width: `${completionStats.pct}%` }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-secondary font-bold text-xs animate-pulse">
            Carregando questionário de avaliação...
          </div>
        ) : (
          <div className="space-y-6">
            {pillars.map((pillar) => {
              const questionsInPillar = groupedQuestions[pillar.id] || []

              return (
                <div key={pillar.id} className="space-y-3 bg-glass/2 p-3.5 rounded-3xl border border-glass/10">
                  {/* Cabeçalho do Pilar */}
                  <div className="flex items-center justify-between border-b border-glass/20 pb-1.5">
                    <span className="text-xs font-black text-primary uppercase tracking-wider">
                      {pillar.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-glass/10 text-secondary text-[8px] font-black uppercase tracking-wider font-mono">
                      Peso: {pillar.weight_percentage}%
                    </span>
                  </div>

                  {/* Lista de Perguntas */}
                  {questionsInPillar.length === 0 ? (
                    <p className="text-[10px] text-secondary italic py-1">Nenhuma pergunta cadastrada para este pilar.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {questionsInPillar.map((question) => {
                        const currentAnswer = answers.find(a => a.question_id === question.id)?.answer

                        return (
                          <div 
                            key={question.id}
                            className="p-3 bg-glass/5 rounded-2xl border border-glass/15 hover:border-glass/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            {/* Texto da Pergunta */}
                            <div className="flex-1 space-y-1">
                              {editingQuestionId === question.id ? (
                                <form
                                  onSubmit={async (e) => {
                                    e.preventDefault()
                                    if (!editingQuestionText.trim()) return
                                    await updateQuestion(question.id, editingQuestionText.trim())
                                    setEditingQuestionId(null)
                                    setEditingQuestionText('')
                                  }}
                                  className="flex items-center gap-2 w-full"
                                >
                                  <input
                                    type="text"
                                    value={editingQuestionText}
                                    onChange={(e) => setEditingQuestionText(e.target.value)}
                                    className="flex-1 h-8 text-xs px-2.5 rounded-lg bg-glass/10 border border-glass/20 text-primary focus:outline-none focus:border-brand font-semibold"
                                    autoFocus
                                    required
                                  />
                                  <button
                                    type="submit"
                                    className="h-8 px-2.5 rounded-lg bg-brand text-black text-[9px] font-black uppercase tracking-wider"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingQuestionId(null)
                                      setEditingQuestionText('')
                                    }}
                                    className="h-8 px-2.5 rounded-lg bg-glass/10 text-secondary text-[9px] font-bold"
                                  >
                                    Cancelar
                                  </button>
                                </form>
                              ) : (
                                <div className="flex items-center gap-2 group/q">
                                  <p className="text-xs font-bold text-primary leading-relaxed">
                                    {question.question_text}
                                  </p>
                                  {question.portfolio_id && (
                                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover/q:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingQuestionId(question.id)
                                          setEditingQuestionText(question.question_text)
                                        }}
                                        className="p-1 rounded hover:bg-glass/15 text-secondary hover:text-primary transition-colors"
                                        title="Editar pergunta"
                                      >
                                        <Pencil size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (confirm('Tem certeza que deseja excluir esta pergunta?')) {
                                            await deleteQuestion(question.id)
                                          }
                                        }}
                                        className="p-1 rounded hover:bg-expense/10 text-secondary hover:text-expense transition-colors"
                                        title="Excluir pergunta"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Seletor de Respostas de 3 Estados */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* SIM */}
                              <button
                                type="button"
                                onClick={() => saveAnswer(question.id, 'yes')}
                                className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                                  currentAnswer === 'yes'
                                    ? 'bg-income text-[#0c2417] shadow-lg shadow-income/10 scale-105'
                                    : 'bg-glass/10 text-secondary hover:bg-glass/20 hover:text-primary'
                                }`}
                              >
                                <CheckCircle2 size={12} />
                                <span>Sim</span>
                              </button>

                              {/* NÃO */}
                              <button
                                type="button"
                                onClick={() => saveAnswer(question.id, 'no')}
                                className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                                  currentAnswer === 'no'
                                    ? 'bg-expense text-[#3a0808] shadow-lg shadow-expense/10 scale-105'
                                    : 'bg-glass/10 text-secondary hover:bg-glass/20 hover:text-primary'
                                }`}
                              >
                                <XCircle size={12} />
                                <span>Não</span>
                              </button>

                              {/* N/A */}
                              <button
                                type="button"
                                onClick={() => saveAnswer(question.id, 'na')}
                                className={`h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                                  currentAnswer === 'na'
                                    ? 'bg-glass/35 text-secondary border border-glass/50 font-bold scale-105'
                                    : 'bg-glass/10 text-secondary hover:bg-glass/20 hover:text-primary'
                                }`}
                              >
                                <HelpCircle size={12} />
                                <span>N/A</span>
                              </button>
                            </div>

                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Campo para Adicionar Nova Pergunta */}
                  {addingToPillarId === pillar.id ? (
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!newQuestionText.trim()) return
                        await addQuestion(pillar.id, newQuestionText.trim())
                        setNewQuestionText('')
                        setAddingToPillarId(null)
                      }}
                      className="mt-2.5 flex items-center gap-2 animate-fade-in"
                    >
                      <input
                        type="text"
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        placeholder="Escreva a nova pergunta qualitativa..."
                        className="flex-1 h-8 text-[11px] px-3 rounded-lg bg-glass/10 border border-glass/25 text-primary placeholder-secondary focus:outline-none focus:border-brand font-semibold"
                        autoFocus
                        required
                      />
                      <button
                        type="submit"
                        disabled={!newQuestionText.trim()}
                        className="h-8 px-3 rounded-lg bg-brand text-black text-[10px] font-black uppercase tracking-wider hover:bg-brand/80 disabled:opacity-50 transition-colors"
                      >
                        Adicionar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingToPillarId(null)
                          setNewQuestionText('')
                        }}
                        className="h-8 px-2.5 rounded-lg bg-glass/10 text-secondary text-[10px] font-bold hover:bg-glass/20 transition-colors"
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <div className="pt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setAddingToPillarId(pillar.id)}
                        className="text-[9px] font-black uppercase tracking-wider text-brand hover:text-brand-strong transition-colors flex items-center gap-1 bg-brand/10 px-2.5 py-1 rounded-lg"
                      >
                        <Plus size={10} />
                        <span>Adicionar Pergunta Personalizada</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center gap-1.5 text-[9px] text-muted leading-relaxed justify-center pt-2">
          <AlertCircle size={11} className="shrink-0 text-secondary" />
          <span>Respostas "N/A" (Não Aplicável) não penalizam a nota; seus pesos são redistribuídos entre os outros fatores.</span>
        </div>

      </div>
    </Modal>
  )
}
