import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { motion, AnimatePresence } from 'framer-motion'
import { BeautifulMarkdown } from '@/components/dashboard/BeautifulMarkdown'
import Button from '@/components/Button'
import { Input } from '@/components/ui/input'
import { Send, Pin, RefreshCw } from 'lucide-react'
import { resolveIcon } from '@/services/aiIcons'
import type { RawSuggestion } from '@/services/aiSuggestions'
import type { PinnedAnalysisData } from '@/hooks/useDashboardAI'
import type { FormEvent } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface InsightsCardHandlers {
  chatInput: string
  setChatInput: (v: string) => void
  chatInputFocused: boolean
  setChatInputFocused: (v: boolean) => void
  activeQueryText: string
  setActiveQueryText: (v: string) => void
  activeReportText: string
  setActiveReportText: (v: string) => void
  setActiveChartData: (v: unknown[] | undefined) => void
  isAiTyping: boolean
  isUpdatingPinned: boolean
  pinnedAnalysis: PinnedAnalysisData | null
  dynamicAiSuggestions: RawSuggestion[]
  hasNewDataForPinned: boolean
  handleSendChat: (e?: FormEvent, customText?: string) => void
  handlePin: () => Promise<void>
  handleUnpin: () => Promise<void>
  handleUpdatePinnedAnalysis: () => Promise<void>
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function InsightsCard(props: InsightsCardHandlers) {
  const {
    chatInput,
    setChatInput,
    chatInputFocused,
    setChatInputFocused,
    activeQueryText,
    activeReportText,
    setActiveReportText,
    setActiveChartData,
    isAiTyping,
    isUpdatingPinned,
    pinnedAnalysis,
    dynamicAiSuggestions,
    hasNewDataForPinned,
    handleSendChat,
    handlePin,
    handleUnpin,
    handleUpdatePinnedAnalysis,
  } = props

  const isPinnedActive =
    pinnedAnalysis && pinnedAnalysis.queryText === activeQueryText

  return (
    <Card
      className={cn(CARD_BASE, CARD_PADDING_LARGE, 'space-y-4 relative overflow-hidden')}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-glass/40 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            {activeQueryText
              ? `Análise: "${activeQueryText}"`
              : 'Insights Financeiros'}
          </span>
        </div>

        {activeQueryText && (
          <div className="flex items-center gap-2">
            {isPinnedActive && hasNewDataForPinned && (
              <Button
                onClick={handleUpdatePinnedAnalysis}
                disabled={isUpdatingPinned}
                variant="outline"
                size="xs"
                className="text-[10px] font-bold uppercase tracking-wider"
                title="Novos lançamentos detectados! Toque para atualizar a análise."
              >
                <RefreshCw
                  className={`w-2.5 h-2.5 ${isUpdatingPinned ? 'animate-spin' : ''}`}
                />
                <span>Atualizar</span>
              </Button>
            )}
            <Button
              onClick={() => {
                if (isPinnedActive) {
                  void handleUnpin()
                } else {
                  void handlePin()
                }
              }}
              variant="ghost"
              size="icon"
              className="rounded-lg"
              title={
                isPinnedActive
                  ? 'Desafixar esta análise'
                  : 'Fixar esta análise'
              }
            >
              <Pin
                className={`w-3.5 h-3.5 ${
                  isPinnedActive ? 'text-primary fill-primary/10' : ''
                }`}
              />
            </Button>
          </div>
        )}
      </div>

      {/* ── Carrossel de Insights ── */}
      {dynamicAiSuggestions.length > 0 ? (
        <div className="relative">
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 pr-2 scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {dynamicAiSuggestions.map((suggestion) => (
              <Button
                key={suggestion.id}
                onClick={() => handleSendChat(undefined, suggestion.query)}
                disabled={isAiTyping}
                variant="outline"
                size="xs"
                className="shrink-0 surface-glass-strong flex items-center gap-1.5 text-left group disabled:opacity-50"
              >
                <span className="p-0.5 rounded-md bg-secondary/10 text-primary shrink-0 group-hover:bg-primary/10 transition-colors">
                  {resolveIcon(suggestion.iconId)}
                </span>
                <div className="min-w-0">
                  <span className="text-[9px] font-semibold text-primary leading-tight block truncate max-w-[130px]">
                    {suggestion.text}
                  </span>
                </div>
              </Button>
            ))}
          </div>
          {/* Fade sutil nas bordas */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-[var(--glass-surface-strong)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-[var(--glass-surface-strong)] to-transparent" />
        </div>
      ) : !activeQueryText ? (
        <p className="text-[10px] text-secondary/60 text-center py-1 italic">
          Nenhum insight disponível no momento. Comece adicionando receitas e
          despesas.
        </p>
      ) : null}

      {/* ── Caixa de Entrada ── */}
      <form
        onSubmit={(e) => handleSendChat(e)}
        className={cn(
          'flex items-center gap-1.5 rounded-2xl',
          'topbar-search-bar',
          chatInputFocused && 'topbar-search-bar--focused',
        )}
      >
        <Input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onFocus={() => setChatInputFocused(true)}
          onBlur={() => setChatInputFocused(false)}
          placeholder="Digite um tema para análise..."
          className="flex-1 bg-transparent text-xs text-primary placeholder-muted outline-none min-w-0 font-medium font-sans ml-3"
        />
        <Button
          type="submit"
          disabled={isAiTyping}
          variant="primary"
          size="icon"
          className="h-7 w-7 mr-1.5 rounded-lg shrink-0"
          aria-label="Enviar"
        >
          <Send className="w-3 h-3" />
        </Button>
      </form>

      {/* ── Workspace de Resposta ── */}
      {activeQueryText && (
        <div className="pt-3 border-t border-glass/40">
          <AnimatePresence mode="wait">
            {isAiTyping ? (
              <motion.div
                key="ai-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2.5 py-1.5 animate-pulse"
              >
                <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span>Gerando análise dos dados...</span>
                </div>
                <div className="h-2.5 bg-secondary/15 rounded w-full" />
                <div className="h-2.5 bg-secondary/15 rounded w-11/12" />
                <div className="h-2.5 bg-secondary/15 rounded w-4/5" />
              </motion.div>
            ) : (
              <motion.div
                key="ai-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <BeautifulMarkdown text={activeReportText} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Pinned analysis pill inline ── */}
      {pinnedAnalysis && pinnedAnalysis.queryText !== activeQueryText && (
        <div className="flex items-center gap-2 border border-dashed border-glass/60 rounded-xl px-3 py-2 surface-glass-strong">
          <Pin className="w-3 h-3 text-primary shrink-0 fill-primary/10" />
          <span className="text-[10px] text-secondary truncate flex-1 min-w-0">
            Análise: {pinnedAnalysis.queryText}
          </span>
          <Button
            onClick={() => {
              setActiveReportText(pinnedAnalysis.text)
              setActiveChartData(pinnedAnalysis.chartData)
              props.setActiveQueryText(pinnedAnalysis.queryText)
            }}
            variant="outline"
            size="xs"
            className="text-[9px] font-bold uppercase tracking-wider shrink-0"
          >
            Abrir
          </Button>
          {hasNewDataForPinned && (
            <Button
              onClick={handleUpdatePinnedAnalysis}
              disabled={isUpdatingPinned}
              variant="outline"
              size="xs"
              className="text-[9px] font-bold uppercase tracking-wider shrink-0"
            >
              <RefreshCw
                className={`w-2 h-2 ${isUpdatingPinned ? 'animate-spin' : ''}`}
              />
            </Button>
          )}
          <Button
            onClick={handleUnpin}
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md shrink-0"
          >
            <Pin className="w-3 h-3" />
          </Button>
        </div>
      )}
    </Card>
  )
}
