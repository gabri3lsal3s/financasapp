import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import TopBarSearchResults from '@/components/TopBarSearchResults'
import { createPortal } from 'react-dom'
import type { SearchResult } from '@/utils/searchEngine'

interface SearchOverlayProps {
  isOpen: boolean
  query: string
  results: SearchResult[]
  onQueryChange: (q: string) => void
  onSelect: (r: SearchResult) => void
  onClose: () => void
}

/** Overlay global de busca (portal para document.body). */
export default function SearchOverlay({
  isOpen,
  query,
  results,
  onQueryChange,
  onSelect,
  onClose,
}: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [internalQuery, setInternalQuery] = useState(query)

  // Sincroniza o estado interno com a prop query quando o overlay abre
  useEffect(() => {
    if (isOpen) {
      setInternalQuery(query)
    }
  }, [isOpen, query])

  // Debounce da digitação
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(internalQuery), 150)
    return () => clearTimeout(timer)
  }, [internalQuery])

  // Auto-foco ao abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  const hasValidQuery = debouncedQuery.trim().length >= 2

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-center p-3 sm:p-6 md:p-10 pointer-events-none animate-fade-in">
      {/* Backdrop com blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      {/* Container da busca */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.96 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 28,
        }}
        className="relative w-full max-w-xl pointer-events-auto z-10"
      >
        <div className="p-3">
          {/* Barra de pesquisa */}
          <div className="relative flex items-center gap-2">
            {/* Botão voltar */}
            <button
              onClick={onClose}
              className="p-2 -ml-1 text-secondary hover:text-primary transition-colors cursor-pointer"
              aria-label="Fechar pesquisa"
            >
              <ArrowLeft size={20} />
            </button>

            <div
              className={cn(
                'flex-1 flex items-center gap-2 rounded-2xl border',
                'topbar-search-bar h-[52px]',
                'bg-[var(--glass-surface-strong)]',
                'backdrop-blur-[var(--glass-blur-strong)]',
              )}
            >
              <Search size={15} className="ml-3.5 text-secondary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={internalQuery}
                onChange={(e) => {
                  setInternalQuery(e.target.value)
                  onQueryChange(e.target.value)
                }}
                placeholder="Pesquisar despesas, rendas, dívidas…"
                className="flex-1 bg-transparent text-xs sm:text-[13px] text-primary placeholder-muted outline-none py-1.5 pr-2 min-w-0 font-medium font-sans"
              />
              {internalQuery && (
                <button
                  onClick={() => { setInternalQuery(''); onQueryChange('') }}
                  className="mr-2 p-0.5 rounded-md text-secondary hover:text-primary hover:bg-secondary/10 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown de resultados */}
          <AnimatePresence>
            {hasValidQuery && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{
                  type: 'spring',
                  stiffness: 340,
                  damping: 26,
                }}
                className="mt-2 rounded-2xl border border-glass surface-glass-strong shadow-lg overflow-hidden z-[150]"
              >
                <TopBarSearchResults
                  results={results}
                  query={debouncedQuery}
                  onSelect={(r) => {
                    onSelect(r)
                    onClose()
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
