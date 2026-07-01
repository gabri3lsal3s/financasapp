import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, X, Bell, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotifications } from '@/contexts/NotificationsContext'
import { cn } from '@/lib/utils'
import { searchAll } from '@/utils/searchEngine'
import { useSearchData } from '@/hooks/useSearchData'
import { getPageTitle } from '@/utils/pageTitles'
import type { SearchResult } from '@/utils/searchEngine'
import TopBarSearchResults from '@/components/TopBarSearchResults'
import { formatCurrency } from '@/utils/format'
import { Z_INDEX } from '@/constants/zIndex'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { resolveProfileDisplayName } from '@/utils/profileDisplayName'

/* ------------------------------------------------------------------ */
/*  Search Overlay (Global)                                           */
/* ------------------------------------------------------------------ */

function SearchOverlay({
  isOpen,
  query,
  results,
  onQueryChange,
  onSelect,
  onClose,
}: {
  isOpen: boolean
  query: string
  results: SearchResult[]
  onQueryChange: (q: string) => void
  onSelect: (r: SearchResult) => void
  onClose: () => void
}) {
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

/* ------------------------------------------------------------------ */
/*  Desktop Notification Dropdown (top-to-bottom)                     */
/* ------------------------------------------------------------------ */

function NotificationDropdown() {
  const {
    combinedAlerts,
    isDesktopAlertsOpen,
    setIsDesktopAlertsOpen,
  } = useNotifications()
  const navigate = useNavigate()

  if (!isDesktopAlertsOpen) return null

  return createPortal(
    <div className={`hidden lg:block fixed inset-0 ${Z_INDEX.POPOVER}`}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/10"
        onClick={() => setIsDesktopAlertsOpen(false)}
      />
      {/* Card — animado do topo */}
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="absolute top-[calc(4.5rem+env(safe-area-inset-top))] right-4 w-[28rem] surface-glass-strong border border-glass rounded-2xl shadow-2xl p-5"
      >
        <div className="flex items-center justify-between border-b border-primary/10 pb-3 mb-4">
          <h4 className="text-sm font-bold text-primary flex items-center gap-2">
            <Bell size={16} className="text-expense shrink-0" />
            Lembretes de Vencimento
          </h4>
          <button
            onClick={() => setIsDesktopAlertsOpen(false)}
            className="text-secondary hover:text-primary transition-colors text-xs font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
        <div className="space-y-2.5 max-h-80 overflow-y-auto">
          {combinedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3.5 rounded-xl border transition-all duration-200 ${
                alert.isOverdue
                  ? 'border-expense/20 bg-expense/5'
                  : 'border-warning/20 bg-warning/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-primary truncate">{alert.title}</p>
                  <p className="text-[10px] text-secondary mt-0.5">
                    {alert.isOverdue ? 'Venceu em' : 'Vence em'}{' '}
                    <strong className="font-mono">{alert.dueDate}</strong>
                  </p>
                </div>
                <p className={`text-xs font-black font-mono ${
                  alert.debtType === 'receivable' ? 'text-income' : 'text-expense'
                }`}>
                  {formatCurrency(alert.amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-primary/10">
          <button
            onClick={() => {
              setIsDesktopAlertsOpen(false)
              navigate('/contas')
            }}
            className="w-full text-xs font-bold text-center py-2 rounded-xl border border-glass hover:bg-secondary/10 transition-colors cursor-pointer"
          >
            Gerenciar Contas
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/*  AppTopBar Principal                                               */
/* ------------------------------------------------------------------ */

export default function AppTopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const {
    combinedAlerts,
    isDesktopAlertsOpen,
    setIsDesktopAlertsOpen,
    isMobileAlertsOpen,
    setIsMobileAlertsOpen,
  } = useNotifications()

  const hasNotifications = combinedAlerts.length > 0

  // Debounce da digitação (150ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Dados pesquisáveis
  const searchableData = useSearchData()

  // Resultados da busca
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) return []
    return searchAll(debouncedQuery.trim(), searchableData)
  }, [debouncedQuery, searchableData])

  const handleSelect = (result: SearchResult) => {
    setSearchQuery('')
    setDebouncedQuery('')
    navigate(result.path)
  }

  const pageTitle = getPageTitle(location.pathname)

  // Contexto de saudação
  const { profile } = useAuth()
  const userName = profile ? resolveProfileDisplayName(profile) : ''
  
  const greetingName = useMemo(() => {
    if (!userName) return 'Usuário'
    const namePart = userName.includes('@') ? userName.split('@')[0] : userName
    const cleanName = namePart.replace(/[._-]/g, ' ').trim()
    return cleanName.split(' ')[0]
  }, [userName])

  const isDashboard = location.pathname === '/'

  // Cálculo temporal
  const temporalMessage = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const daysInMonth = new Date(currentYear, currentMonthNum, 0).getDate()
    const remainingDays = daysInMonth - today.getDate() + 1

    if (remainingDays === 1) {
      return 'Hoje é o último dia do mês! Hora de fechar as contas. 📊'
    }
    return `Faltam ${remainingDays} dias para o fim do mês.`
  }, [])

  return (
    <>
      <header className="w-full max-w-7xl mx-auto mb-4">
        <div className="flex items-center justify-between px-3 sm:px-6 lg:px-6 lg:xl:px-8 py-3 gap-3 rounded-[24px] border border-glass bg-[var(--glass-surface-strong)] backdrop-blur-[var(--glass-blur-strong)]"
          style={{ boxShadow: 'var(--glass-shadow-panel), var(--glass-inset-highlight)' }}>
          {/* ── Esquerda: Saudação / Nome do App + Título da Página ── */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            {isDashboard ? (
              <div className="flex flex-col leading-tight min-w-0">
                <h1 className="text-sm font-bold text-primary truncate">
                  Olá, {greetingName} 👋
                </h1>
                <span className="text-[10px] font-medium text-secondary mt-0.5">
                  {temporalMessage}
                </span>
              </div>
            ) : (
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary/60">
                  Finanças
                </span>
                <h1 className="text-sm font-bold text-primary truncate">
                  {pageTitle}
                </h1>
              </div>
            )}
          </div>

          {/* ── Direita: Busca + Notificação ── */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Botão de busca unificado para mobile e desktop */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className={cn(
                'relative flex h-[44px] w-[44px] items-center justify-center rounded-xl cursor-pointer',
                'text-secondary hover:text-primary hover:bg-secondary/10 transition-all',
              )}
              aria-label="Pesquisar"
              title="Pesquisar"
            >
              <Search size={18} />
            </button>

            {/* Botão de notificação */}
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsMobileAlertsOpen(!isMobileAlertsOpen)
                } else {
                  setIsDesktopAlertsOpen(!isDesktopAlertsOpen)
                }
              }}
              className={cn(
                'relative flex h-[44px] w-[44px] items-center justify-center rounded-xl cursor-pointer',
                'transition-all',
                isDesktopAlertsOpen || isMobileAlertsOpen
                  ? 'text-primary bg-secondary/10'
                  : 'text-secondary hover:text-primary hover:bg-secondary/10',
              )}
              title="Notificações"
              aria-label="Notificações"
            >
              <Bell size={18} className={hasNotifications ? 'animate-bell-ring' : ''} />
              {hasNotifications && (
                <span className="absolute -top-0.5 -right-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-expense text-[6px] font-black text-white border border-secondary shadow-sm">
                  {combinedAlerts.length > 9 ? '9+' : combinedAlerts.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Global Search Overlay (renderizado via portal) */}
      <SearchOverlay
        isOpen={isSearchOpen}
        query={searchQuery}
        results={searchResults}
        onQueryChange={(q) => setSearchQuery(q)}
        onSelect={handleSelect}
        onClose={() => {
          setIsSearchOpen(false)
          setSearchQuery('')
          setDebouncedQuery('')
        }}
      />

      {/* Desktop Notification Dropdown */}
      <NotificationDropdown />
    </>
  )
}
