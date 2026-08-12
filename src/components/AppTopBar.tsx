import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationsContext'
import { cn } from '@/lib/utils'
import { searchAll } from '@/utils/searchEngine'
import { useSearchData } from '@/hooks/useSearchData'
import { getPageTitle } from '@/utils/pageTitles'
import type { SearchResult } from '@/utils/searchEngine'
import SearchOverlay from '@/components/topbar/SearchOverlay'
import NotificationsOverlay from '@/components/topbar/NotificationsOverlay'

export default function AppTopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const {
    combinedAlerts,
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
  const isDashboard = location.pathname === '/'

  return (
    <>
      <header className="w-full lg:max-w-7xl lg:mx-auto px-4 lg:px-6 mb-4 lg:mb-6">
        <div className="flex items-center justify-between py-2.5 sm:py-3 px-4 gap-3 rounded-2xl border border-glass bg-[var(--glass-surface-strong)] backdrop-blur-[var(--glass-blur-strong)]"
          style={{ boxShadow: 'var(--glass-shadow-panel), var(--glass-inset-highlight)' }}>
          {/* ── Esquerda: Nome do App + Título da Página ── */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary/60">
                Finanças
              </span>
              <h1 className="text-sm font-bold text-primary truncate">
                {isDashboard ? 'Visão Geral' : pageTitle}
              </h1>
            </div>
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

            {/* Botão de notificação unificado para mobile e desktop */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className={cn(
                'relative flex h-[44px] w-[44px] items-center justify-center rounded-xl cursor-pointer',
                'transition-all',
                'text-secondary hover:text-primary hover:bg-secondary/10',
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

      {/* Notifications Overlay (unificado — mobile e desktop) */}
      <NotificationsOverlay
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </>
  )
}
