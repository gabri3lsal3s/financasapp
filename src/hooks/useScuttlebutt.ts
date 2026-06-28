import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ScuttlebuttPillar, ScuttlebuttQuestion, ScuttlebuttAnswer } from '@/types'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

export function useScuttlebutt(portfolioId: string, ticker: string) {
  const [loading, setLoading] = useState(true)
  const [pillars, setPillars] = useState<ScuttlebuttPillar[]>([])
  const [questions, setQuestions] = useState<ScuttlebuttQuestion[]>([])
  const [answers, setAnswers] = useState<ScuttlebuttAnswer[]>([])

  const loadScuttlebuttData = useCallback(async () => {
    if (!portfolioId || !ticker) return
    setLoading(true)
    try {
      // 1. Carregar pilares (globais e do portfólio)
      const { data: pillarsData, error: pillarsError } = await supabase
        .from('scuttlebutt_pillars')
        .select('*')
        .or(`portfolio_id.is.null,portfolio_id.eq.${portfolioId}`)
        .order('weight_percentage', { ascending: false })

      if (pillarsError) throw pillarsError

      // 2. Obter ids dos pilares
      const pillarIds = (pillarsData || []).map(p => p.id)
      if (pillarIds.length === 0) {
        setPillars([])
        setQuestions([])
        setAnswers([])
        setLoading(false)
        return
      }

      // 3. Carregar perguntas destes pilares
      const { data: questionsData, error: questionsError } = await supabase
        .from('scuttlebutt_questions')
        .select('*')
        .in('pillar_id', pillarIds)

      if (questionsError) throw questionsError

      // 4. Carregar respostas existentes para o ativo
      const { data: answersData, error: answersError } = await supabase
        .from('scuttlebutt_answers')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .eq('ticker', ticker.toUpperCase())

      if (answersError) throw answersError

      setPillars(pillarsData as ScuttlebuttPillar[])
      setQuestions(questionsData as ScuttlebuttQuestion[])
      setAnswers((answersData || []) as ScuttlebuttAnswer[])
    } catch (err) {
      logger.error('[useScuttlebutt] Erro ao carregar dados do Scuttlebutt:', err)
      toast.error('Erro ao carregar dados de avaliação.')
    } finally {
      setLoading(false)
    }
  }, [portfolioId, ticker])

  useEffect(() => {
    void loadScuttlebuttData()
  }, [loadScuttlebuttData])

  const saveAnswer = async (questionId: string, answer: 'yes' | 'no' | 'na') => {
    if (!portfolioId || !ticker) return
    
    // Atualização otimista no estado local
    const now = new Date().toISOString()
    const updatedAnswers = [...answers]
    const existingIdx = updatedAnswers.findIndex(a => a.question_id === questionId)

    const newAnswer: ScuttlebuttAnswer = {
      portfolio_id: portfolioId,
      ticker: ticker.toUpperCase(),
      question_id: questionId,
      answer,
      updated_at: now
    }

    if (existingIdx >= 0) {
      updatedAnswers[existingIdx] = newAnswer
    } else {
      updatedAnswers.push(newAnswer)
    }
    setAnswers(updatedAnswers)

    // Salvar no Supabase
    try {
      const { error } = await supabase
        .from('scuttlebutt_answers')
        .upsert({
          portfolio_id: portfolioId,
          ticker: ticker.toUpperCase(),
          question_id: questionId,
          answer,
          updated_at: now
        }, {
          onConflict: 'portfolio_id,ticker,question_id'
        })

      if (error) throw error

      // Notificar outros ouvintes locais de alteração
      window.dispatchEvent(
        new CustomEvent('local-data-changed', {
          detail: { entity: 'scuttlebutt_answers' }
        })
      )
    } catch (err) {
      logger.error('[useScuttlebutt] Erro ao salvar resposta:', err)
      toast.error('Erro ao salvar resposta no servidor.')
      // Reverter estado local em caso de erro
      void loadScuttlebuttData()
    }
  }

  const addPillar = async (name: string, weightPercentage: number) => {
    if (!portfolioId) return
    try {
      const { data, error } = await supabase
        .from('scuttlebutt_pillars')
        .insert({
          portfolio_id: portfolioId,
          name,
          weight_percentage: weightPercentage
        })
        .select()
        .single()

      if (error) throw error
      setPillars(prev => [...prev, data as ScuttlebuttPillar])
      toast.success('Pilar qualitativo criado!')
    } catch (err) {
      logger.error('[useScuttlebutt] Erro ao adicionar pilar:', err)
      toast.error('Erro ao criar pilar.')
    }
  }

  const addQuestion = async (pillarId: string, questionText: string, weight = 1.0) => {
    try {
      const { data, error } = await supabase
        .from('scuttlebutt_questions')
        .insert({
          pillar_id: pillarId,
          portfolio_id: portfolioId,
          question_text: questionText,
          weight
        })
        .select()
        .single()

      if (error) throw error
      setQuestions(prev => [...prev, data as ScuttlebuttQuestion])
      toast.success('Pergunta qualitativa adicionada!')
    } catch (err) {
      logger.error('[useScuttlebutt] Erro ao adicionar pergunta:', err)
      toast.error('Erro ao criar pergunta.')
    }
  }

  const updateQuestion = async (questionId: string, questionText: string) => {
    try {
      const { data, error } = await supabase
        .from('scuttlebutt_questions')
        .update({ question_text: questionText })
        .eq('id', questionId)
        .eq('portfolio_id', portfolioId)
        .select()
        .single()

      if (error) throw error
      setQuestions(prev => prev.map(q => q.id === questionId ? (data as ScuttlebuttQuestion) : q))
      toast.success('Pergunta qualitativa atualizada!')
    } catch (err) {
      logger.error('[useScuttlebutt] Erro ao editar pergunta:', err)
      toast.error('Erro ao editar pergunta.')
    }
  }

  const deleteQuestion = async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('scuttlebutt_questions')
        .delete()
        .eq('id', questionId)
        .eq('portfolio_id', portfolioId)

      if (error) throw error
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      setAnswers(prev => prev.filter(a => a.question_id !== questionId))
      toast.success('Pergunta qualitativa removida!')
    } catch (err) {
      logger.error('[useScuttlebutt] Erro ao excluir pergunta:', err)
      toast.error('Erro ao excluir pergunta.')
    }
  }

  return {
    loading,
    pillars,
    questions,
    answers,
    saveAnswer,
    addPillar,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    refetch: loadScuttlebuttData
  }
}
