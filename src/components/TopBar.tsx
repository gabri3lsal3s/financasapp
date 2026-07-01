import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Bell, TrendingDown, TrendingUp, Home, PiggyBank, BarChart3, Tags, Receipt } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotifications } from '@/contexts/NotificationsContext'
import { cn } from '@/lib/utils'

const NAV_PAGES = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/expenses', label: 'Despesas', icon: TrendingDown },
  { path: '/incomes', label: 'Rendas', icon: TrendingUp },
  { path: '/investments', label: 'Investimentos', icon: PiggyBank },
  { path: '/reports', label: 'Relatórios', icon: BarChart3 },
  { path: '/categories', label: 'Categorias', icon: Tags },
  { path: '/contas', label: 'Contas', icon: Receipt },
] as const

export default function TopBar() {
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const {
    combinedAlerts,
    isDesktopAlertsOpen,
    setIsDesktopAlertsOpen,
    isMobileAlertsOpen,
    setIsMobileAlertsOpen,
  } = useNotifications()

  const hasNotifications = combinedAlerts.length > 0

  // Close search on outside click
  useEffect(() => {
    if (!isSearchFocused) return
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isSearchFocused])

  // Filter pages by query
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return NAV_PAGES.filter((p) => p.label.toLowerCase().includes(q))
  }, [searchQuery])

  const handleNavigate = (path: string) => {
    setSearchQuery('')
    setIsSearchFocused(false)
    navigate(path)
  }

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 gap-3">
      {/* Left spacer to balance the bell on desktop */}
      <div className="w-[52px] hidden lg:block shrink-0" />

      {/* Search Bar */}
      <div ref={searchRef} className="relative flex-1 flex justify-center">
        <div className="w-full max-w-full sm:max-w-sm md:max-w-md lg:max-w-5xl">
        <div
          className={cn(
            'flex items-center gap-2 rounded-3xl sm:rounded-2xl border motion-standard hover-lift-subtle topbar-search-bar h-[60px] sm:h-[52px]',
            isSearchFocused ? 'topbar-search-bar--focused' : ''
          )}
        >
          <Search size={15} className="ml-3 sm:ml-3.5 text-secondary shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Pesquisar páginas..."
            className="flex-1 bg-transparent text-xs sm:text-[13px] text-primary placeholder-muted outline-none py-1.5 pr-2.5 min-w-0 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setIsSearchFocused(false) }}
              className="mr-2 p-0.5 rounded-md text-secondary hover:text-primary hover:bg-secondary/10 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown — animated with framer-motion */}
        <AnimatePresence>
          {isSearchFocused && searchQuery.trim() && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-glass surface-glass-strong shadow-lg overflow-hidden z-[150]"
            >
              {filteredPages.length > 0 ? (
                <div className="py-1 animate-stagger">
                  {filteredPages.map((page, i) => {
                    const Icon = page.icon
                    return (
                      <motion.button
                        key={page.path}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.15 }}
                        onClick={() => handleNavigate(page.path)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs text-primary hover:bg-secondary/10 transition-colors text-left"
                      >
                        <Icon size={15} className="text-secondary shrink-0" />
                        <span className="font-medium">{page.label}</span>
                      </motion.button>
                    )
                  })}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 }}
                  className="px-3.5 py-4 text-center text-xs text-secondary"
                >
                  Nenhuma página encontrada para &quot;{searchQuery}&quot;
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      {/* Notification Bell — always visible */}
      <div className="shrink-0">
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setIsMobileAlertsOpen(!isMobileAlertsOpen)
            } else {
              setIsDesktopAlertsOpen(!isDesktopAlertsOpen)
            }
          }}
          className={cn(
            'relative flex h-[60px] w-[60px] sm:h-[52px] sm:w-[52px] items-center justify-center rounded-3xl sm:rounded-2xl border motion-standard hover-lift-subtle topbar-notification-btn',
            (isDesktopAlertsOpen || isMobileAlertsOpen)
              ? 'topbar-notification-btn--active text-primary'
              : 'text-secondary hover:text-primary'
          )}
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell size={18} className={hasNotifications ? 'animate-bell-ring' : ''} />
          {hasNotifications && (
            <span className="absolute -top-1 -right-1 flex h-[15px] w-[15px] sm:h-[16px] sm:w-[16px] items-center justify-center rounded-full bg-expense text-[6px] sm:text-[7px] font-black text-white border border-secondary shadow-sm">
              {combinedAlerts.length > 9 ? '9+' : combinedAlerts.length}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
