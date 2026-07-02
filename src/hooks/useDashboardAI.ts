import { useState, useCallback, useMemo, useEffect, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'
import { formatNumberWithTwoDecimalsBR } from '@/utils/format'
import {
  type AnalysisInput,
  type RawSuggestion,
  generateDynamicSuggestions,
  buildLocalAnalysis as buildLocalAnalysisService,
} from '@/services/aiSuggestions'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/* Suggestion now uses RawSuggestion from aiSuggestions (iconId as string) */
export type Suggestion = RawSuggestion

export interface PinnedAnalysisData {
  text: string
  chartData?: unknown[]
  queryText: string
  dataHash: string
}

export function useDashboardAI(input: AnalysisInput) {
  /* ── State ── */
  const [chatInput, setChatInput] = useState('')
  const [chatInputFocused, setChatInputFocused] = useState(false)
  const [activeQueryText, setActiveQueryText] = useState('')
  const [activeReportText, setActiveReportText] = useState(
    'Selecione um dos insights acima ou digite um tema para analisar seus dados financeiros.'
  )
  const [activeChartData, setActiveChartData] = useState<unknown[] | undefined>(undefined)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [pinnedAnalysis, setPinnedAnalysis] = useState<PinnedAnalysisData | null>(null)
  const [isUpdatingPinned, setIsUpdatingPinned] = useState(false)

  /* Icon resolution is handled by services/aiIcons.ts — no JSX here */

  /* ── Computed ── */
  const currentHash = useMemo(() => {
    const { totalIncomes, totalExpenses, expensesCount, incomesCount } = input
    const expHash = `${expensesCount}_${formatNumberWithTwoDecimalsBR(totalExpenses)}`
    const incHash = `${incomesCount}_${formatNumberWithTwoDecimalsBR(totalIncomes)}`
    return `exp:${expHash}|inc:${incHash}`
  }, [
    input.expensesCount,
    input.incomesCount,
    input.totalExpenses,
    input.totalIncomes,
  ])

  const hasNewDataForPinned = useMemo(() => {
    return pinnedAnalysis && pinnedAnalysis.dataHash !== currentHash
  }, [pinnedAnalysis, currentHash])

  /* ── Dynamic Insights (raw, no JSX — Dashboard resolves icons via resolveIcon) ── */
  const dynamicAiSuggestions: RawSuggestion[] = useMemo(() => {
    return generateDynamicSuggestions(input)
  }, [input])

  /* ── buildLocalAnalysis (wraps service) ── */
  const buildLocalAnalysis = useCallback(
    (_context?: string): string => {
      return buildLocalAnalysisService(input, _context)
    },
    [input]
  )

  /* ── Chat handler ── */
  const handleSendChat = useCallback(
    (e?: FormEvent, customText?: string) => {
      if (e) e.preventDefault()
      const textToSend = customText || chatInput
      if (!textToSend.trim()) return

      setChatInput('')
      setActiveQueryText(textToSend)
      setIsAiTyping(true)

      setTimeout(() => {
        if (customText) {
          const matched = dynamicAiSuggestions.find((s) => s.query === customText)
          if (matched) {
            const detail =
              `💡 **${matched.text}**\n\n` +
              `**Dica:** ${matched.tip}\n\n` +
              `---\n\n` +
              buildLocalAnalysis(customText)
            setActiveReportText(detail)
          } else {
            setActiveReportText(buildLocalAnalysis(customText))
          }
        } else {
          setActiveReportText(buildLocalAnalysis(textToSend))
        }
        setActiveChartData(undefined)
        setIsAiTyping(false)
      }, 350)
    },
    [chatInput, dynamicAiSuggestions, buildLocalAnalysis]
  )

  /* ── Pinned analysis CRUD ── */
  const loadPinnedAnalysis = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('pinned_ai_analyses')
        .select('pinned_analysis')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      if (data?.pinned_analysis) {
        const pa = data.pinned_analysis as PinnedAnalysisData
        setPinnedAnalysis(pa)
        setActiveReportText(pa.text)
        setActiveChartData(pa.chartData)
        setActiveQueryText(pa.queryText)
      }
    } catch (err) {
      logger.error('Erro ao carregar análise fixada:', err)
    }
  }, [])

  useEffect(() => {
    void loadPinnedAnalysis()
  }, [loadPinnedAnalysis])

  const handlePin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const newPinned: PinnedAnalysisData = {
        text: activeReportText,
        chartData: activeChartData,
        queryText: activeQueryText || 'Relatório Consolidado',
        dataHash: currentHash,
      }

      const { error } = await supabase
        .from('pinned_ai_analyses')
        .upsert({
          user_id: user.id,
          pinned_analysis: newPinned,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      setPinnedAnalysis(newPinned)
    } catch (err) {
      logger.error('Erro ao fixar análise:', err)
    }
  }, [activeReportText, activeChartData, activeQueryText, currentHash])

  const handleUnpin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('pinned_ai_analyses')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error
      setPinnedAnalysis(null)
    } catch (err) {
      logger.error('Erro ao desafixar análise:', err)
    }
  }, [])

  const handleUpdatePinnedAnalysis = useCallback(async () => {
    if (!pinnedAnalysis) return
    setIsUpdatingPinned(true)
    try {
      const query = pinnedAnalysis.queryText || 'Acompanhamento'
      const localText = buildLocalAnalysis(query)

      const updatedPinned: PinnedAnalysisData = {
        text: localText,
        chartData: undefined,
        queryText: query,
        dataHash: currentHash,
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('pinned_ai_analyses')
          .upsert({
            user_id: user.id,
            pinned_analysis: updatedPinned,
            updated_at: new Date().toISOString(),
          })
      }

      setPinnedAnalysis(updatedPinned)
      if (activeQueryText === query) {
        setActiveReportText(localText)
        setActiveChartData(undefined)
      }
    } catch (err) {
      logger.error('Erro ao atualizar análise fixada:', err)
    } finally {
      setIsUpdatingPinned(false)
    }
  }, [pinnedAnalysis, activeQueryText, buildLocalAnalysis, currentHash])

  return {
    // State (exposed — Dashboard uses setActiveQueryText, setActiveReportText, setActiveChartData for pinned "Abrir")
    chatInput,
    setChatInput,
    chatInputFocused,
    setChatInputFocused,
    activeQueryText,
    setActiveQueryText,
    activeReportText,
    setActiveReportText,
    activeChartData,
    setActiveChartData,
    isAiTyping,
    isUpdatingPinned,
    pinnedAnalysis,
    // Computed
    dynamicAiSuggestions,
    hasNewDataForPinned,
    // Handlers
    handleSendChat,
    handlePin,
    handleUnpin,
    handleUpdatePinnedAnalysis,
  }
}
