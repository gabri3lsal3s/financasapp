import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, TrendingDown, TrendingUp, BarChart3, PiggyBank, Settings, ChevronRight, Menu, X, Tags, CreditCard, LogOut, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import FloatingCalculator from '@/components/FloatingCalculator'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

import { useAuth } from '@/contexts/AuthContext'
import { useAdvisoryPortfolioLink } from '@/hooks/useAdvisoryPortfolioLink'
import { useBackgroundCache } from '@/hooks/useBackgroundCache'
import { useNavigate } from 'react-router-dom'

import { WifiOff, ArrowLeft } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

function OfflinePlaceholder() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-in fade-in zoom-in duration-300">
      <div className="bg-tertiary p-6 rounded-full mb-6">
        <WifiOff size={48} className="text-secondary" />
      </div>
      <h2 className="text-2xl font-bold text-primary mb-3">Página Indisponível Offline</h2>
      <p className="text-secondary max-w-md mb-8">
        Esta funcionalidade requer uma conexão com a internet para carregar os dados mais recentes.
        Por favor, conecte-se para acessar esta página.
      </p>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:opacity-90 transition-all active:scale-95"
      >
        <ArrowLeft size={20} />
        Voltar para o Início
      </button>
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  const { floatingCalculatorEnabled } = useAppSettings()
  const { signOut, profile } = useAuth()
  const { hasAdvisoryLink } = useAdvisoryPortfolioLink()
  useBackgroundCache()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDesktopMenuExpanded, setIsDesktopMenuExpanded] = useState(false)
  const isSettingsPage = location.pathname === '/settings'
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const desktopMenuRef = useRef<HTMLElement | null>(null)
  const desktopMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const activeItemClasses = 'bg-tertiary accent-primary'
  const inactiveItemClasses = 'text-primary hover:bg-tertiary'

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const { isOnline } = useNetworkStatus()

  const navItems = (() => {
    const items = [
      { path: '/', icon: Home, label: 'Início', onlineOnly: false },
      { path: '/expenses', icon: TrendingDown, label: 'Despesas', onlineOnly: false },
      { path: '/incomes', icon: TrendingUp, label: 'Rendas', onlineOnly: false },
      { path: '/investments', icon: PiggyBank, label: 'Investimentos', onlineOnly: false },
    ]

    if (hasAdvisoryLink) {
      items.push({ path: '/my-consulting', icon: Users, label: 'Minha Consultoria', onlineOnly: false })
    }

    if (profile?.role === 'consultant') {
      items.push({ path: '/consulting', icon: Users, label: 'Consultoria', onlineOnly: false })
    }

    items.push(
      { path: '/credit-cards', icon: CreditCard, label: 'Cartões', onlineOnly: true },
      { path: '/reports', icon: BarChart3, label: 'Relatórios', onlineOnly: true },
      { path: '/categories', icon: Tags, label: 'Categorias', onlineOnly: true },
      { path: '/settings', icon: Settings, label: 'Configurações do App', onlineOnly: false }
    )

    return items
  })()

  const totalMainItems = navItems.length - 1
  const mainItemsList = navItems.slice(0, totalMainItems)
  const settingsItemsList = navItems.slice(totalMainItems)

  const isCurrentPathOnlineOnly = navItems.find(item => item.path === location.pathname)?.onlineOnly || false
  const shouldShowOfflinePlaceholder = !isOnline && isCurrentPathOnlineOnly

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobileMenuOpen && !isDesktopMenuExpanded) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
        setIsDesktopMenuExpanded(false)
      }
    }

    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMobileMenuOpen, isDesktopMenuExpanded])

  useEffect(() => {
    if (!isMobileMenuOpen && !isDesktopMenuExpanded) {
      return
    }

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (isMobileMenuOpen) {
        const clickedMobileMenu = mobileMenuRef.current?.contains(target)
        const clickedMobileToggle = mobileMenuButtonRef.current?.contains(target)
        if (!clickedMobileMenu && !clickedMobileToggle) {
          setIsMobileMenuOpen(false)
        }
      }

      if (isDesktopMenuExpanded) {
        const clickedDesktopMenu = desktopMenuRef.current?.contains(target)
        const clickedDesktopToggle = desktopMenuButtonRef.current?.contains(target)
        if (!clickedDesktopMenu && !clickedDesktopToggle) {
          setIsDesktopMenuExpanded(false)
        }
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('touchstart', closeOnOutsideClick)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('touchstart', closeOnOutsideClick)
    }
  }, [isMobileMenuOpen, isDesktopMenuExpanded])

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <div className="min-h-screen bg-secondary">
      <div className="lg:hidden">
        {/* Sleek Top Header with Settings shortcut on mobile */}
        <header className="absolute top-0 inset-x-0 z-[100] bg-secondary/95 backdrop-blur-md border-b border-primary safe-area-top">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-14 flex items-center justify-between relative">
              <span className="w-10"></span> {/* Spacer */}
              <h1 className="text-sm font-black text-primary text-center uppercase tracking-wider">Finanças</h1>
              <Link
                to="/settings"
                aria-label="Configurações"
                className="p-2 rounded-lg text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                <Settings size={20} />
              </Link>
            </div>
          </div>
        </header>

        {/* Dynamic Bottom Sheet Menu via AnimatePresence */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Blur backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-[2px]"
                onClick={() => setIsMobileMenuOpen(false)}
              />

              {/* Bottom Sheet Menu Container */}
              <motion.div
                ref={mobileMenuRef}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 220 }}
                className="fixed bottom-0 left-0 right-0 mx-auto max-w-md w-full z-[120] bg-secondary border-t border-primary rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] safe-area-bottom"
              >
                {/* Visual drag indicator */}
                <div className="w-12 h-1.5 bg-primary/20 rounded-full mx-auto my-3 shrink-0" />
                
                <div className="px-5 pb-3.5 pt-1 border-b border-primary flex items-center justify-between shrink-0">
                  <h2 className="text-sm font-black text-primary uppercase tracking-widest">Mais Opções</h2>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 rounded-full border border-primary bg-secondary text-secondary hover:text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto max-h-[calc(85vh-5.5rem)]">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cartões */}
                    {!(!isOnline) && (
                      <Link
                        to="/credit-cards"
                        className="flex flex-col items-center justify-center p-4 bg-primary border border-primary/60 hover:border-indigo-500/40 rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                      >
                        <CreditCard size={20} className="text-secondary mb-2" />
                        <span className="text-xs font-bold text-primary">Cartões</span>
                      </Link>
                    )}

                    {/* Relatórios */}
                    {!(!isOnline) && (
                      <Link
                        to="/reports"
                        className="flex flex-col items-center justify-center p-4 bg-primary border border-primary/60 hover:border-indigo-500/40 rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                      >
                        <BarChart3 size={20} className="text-secondary mb-2" />
                        <span className="text-xs font-bold text-primary">Relatórios</span>
                      </Link>
                    )}

                    {/* Categorias */}
                    {!(!isOnline) && (
                      <Link
                        to="/categories"
                        className="flex flex-col items-center justify-center p-4 bg-primary border border-primary/60 hover:border-indigo-500/40 rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                      >
                        <Tags size={20} className="text-secondary mb-2" />
                        <span className="text-xs font-bold text-primary">Categorias</span>
                      </Link>
                    )}

                    {/* Configurações */}
                    <Link
                      to="/settings"
                      className="flex flex-col items-center justify-center p-4 bg-primary border border-primary/60 hover:border-indigo-500/40 rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                    >
                      <Settings size={20} className="text-secondary mb-2" />
                      <span className="text-xs font-bold text-primary">Ajustes</span>
                    </Link>

                    {/* Minha Consultoria (se aplicável) */}
                    {hasAdvisoryLink && (
                      <Link
                        to="/my-consulting"
                        className="flex flex-col items-center justify-center p-4 bg-primary border border-primary/60 hover:border-indigo-500/40 rounded-2xl motion-standard hover-lift-subtle press-subtle select-none col-span-2"
                      >
                        <Users size={20} className="text-secondary mb-2" />
                        <span className="text-xs font-bold text-primary">Minha Consultoria</span>
                      </Link>
                    )}

                    {/* Consultoria do Assessor (se aplicável) */}
                    {profile?.role === 'consultant' && (
                      <Link
                        to="/consulting"
                        className="flex flex-col items-center justify-center p-4 bg-primary border border-primary/60 hover:border-indigo-500/40 rounded-2xl motion-standard hover-lift-subtle press-subtle select-none col-span-2"
                      >
                        <Users size={20} className="text-secondary mb-2" />
                        <span className="text-xs font-bold text-primary">Consultoria</span>
                      </Link>
                    )}

                    {/* Botão Sair */}
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        void handleLogout()
                      }}
                      className="col-span-2 w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 rounded-2xl motion-standard hover-lift-subtle press-subtle font-extrabold text-red-500 text-xs uppercase tracking-wider mt-2"
                    >
                      <LogOut size={16} />
                      <span>Sair do App</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Fixed Premium Bottom Tab Bar */}
        <nav className="fixed bottom-0 inset-x-0 z-[100] bg-secondary/95 backdrop-blur-md border-t border-primary safe-area-bottom flex items-center justify-around h-16 shadow-lg px-2">
          {/* Home Tab */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 ${
              location.pathname === '/'
                ? 'text-accent-primary accent-primary scale-105 font-extrabold'
                : 'text-primary opacity-65 hover:opacity-100 font-semibold'
            }`}
          >
            <Home size={18} className={location.pathname === '/' ? 'text-[var(--color-primary)]' : ''} />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Início</span>
          </Link>

          {/* Expenses Tab */}
          <Link
            to="/expenses"
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 ${
              location.pathname === '/expenses'
                ? 'text-accent-primary accent-primary scale-105 font-extrabold'
                : 'text-primary opacity-65 hover:opacity-100 font-semibold'
            }`}
          >
            <TrendingDown size={18} className={location.pathname === '/expenses' ? 'text-[var(--color-primary)]' : ''} />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Despesas</span>
          </Link>

          {/* Incomes Tab */}
          <Link
            to="/incomes"
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 ${
              location.pathname === '/incomes'
                ? 'text-accent-primary accent-primary scale-105 font-extrabold'
                : 'text-primary opacity-65 hover:opacity-100 font-semibold'
            }`}
          >
            <TrendingUp size={18} className={location.pathname === '/incomes' ? 'text-[var(--color-primary)]' : ''} />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Rendas</span>
          </Link>

          {/* Investments Tab */}
          <Link
            to="/investments"
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 ${
              location.pathname === '/investments'
                ? 'text-accent-primary accent-primary scale-105 font-extrabold'
                : 'text-primary opacity-65 hover:opacity-100 font-semibold'
            }`}
          >
            <PiggyBank size={18} className={location.pathname === '/investments' ? 'text-[var(--color-primary)]' : ''} />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Carteira</span>
          </Link>

          {/* "Mais" Menu Tab Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-200 ${
              isMobileMenuOpen || !['/', '/expenses', '/incomes', '/investments'].includes(location.pathname)
                ? 'text-accent-primary accent-primary scale-105 font-extrabold'
                : 'text-primary opacity-65 hover:opacity-100 font-semibold'
            }`}
          >
            <Menu size={18} className={isMobileMenuOpen || !['/', '/expenses', '/incomes', '/investments'].includes(location.pathname) ? 'text-[var(--color-primary)]' : ''} />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Mais</span>
          </button>
        </nav>

        {/* Main Content Area with Bottom Padding to avoid navigation overlay */}
        <main className="relative pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-h-screen">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-6">
            <section key={location.pathname} className="animate-page-enter">
              {children}
            </section>
          </div>
        </main>
      </div>

      <div className="hidden lg:grid min-h-screen grid-cols-[auto_1fr]">
        <aside
          ref={desktopMenuRef}
          className={`sticky top-0 h-screen bg-secondary border-r border-primary overflow-y-auto motion-emphasis ${isDesktopMenuExpanded ? 'w-72' : 'w-20'
            }`}
        >
          <div className={`h-16 px-3 border-b border-primary flex items-center ${isDesktopMenuExpanded ? 'justify-between' : 'justify-center'}`}>
            {isDesktopMenuExpanded && <h2 className="text-lg font-bold text-primary">Finanças</h2>}
            <button
              ref={desktopMenuButtonRef}
              type="button"
              onClick={() => setIsDesktopMenuExpanded((currentValue) => !currentValue)}
              aria-label={isDesktopMenuExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
              className="p-2 rounded-lg text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            >
              {isDesktopMenuExpanded ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="p-3">
            <div className="space-y-2">
              {isDesktopMenuExpanded && (
                <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Páginas principais</p>
              )}
              {mainItemsList.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                const isConcealed = item.onlineOnly && !isOnline

                return (
                  <div key={item.path} className={`transition-conceal-container ${isConcealed ? 'is-concealed' : ''}`}>
                    <div className="transition-conceal-content">
                      <Link
                        to={item.path}
                        title={item.label}
                        className={`flex items-center rounded-lg motion-standard hover-lift-subtle ${isDesktopMenuExpanded
                          ? 'justify-between px-4 py-3'
                          : 'justify-center p-3'
                          } ${isActive
                            ? activeItemClasses
                            : inactiveItemClasses
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon size={20} className="flex-shrink-0" />
                          {isDesktopMenuExpanded && <span className="font-medium truncate">{item.label}</span>}
                        </div>
                        {isDesktopMenuExpanded && isActive && <ChevronRight size={16} className="flex-shrink-0" />}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="my-4 border-t border-primary"></div>

            <div className="space-y-2">
              {isDesktopMenuExpanded && (
                <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Configurações</p>
              )}
              {settingsItemsList.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                const isConcealed = item.onlineOnly && !isOnline

                return (
                  <div key={item.path} className={`transition-conceal-container ${isConcealed ? 'is-concealed' : ''}`}>
                    <div className="transition-conceal-content">
                      <Link
                        to={item.path}
                        title={item.label}
                        className={`flex items-center rounded-lg motion-standard hover-lift-subtle ${isDesktopMenuExpanded
                          ? 'justify-between px-4 py-3'
                          : 'justify-center p-3'
                          } ${isActive
                            ? activeItemClasses
                            : inactiveItemClasses
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon size={20} className="flex-shrink-0" />
                          {isDesktopMenuExpanded && <span className="font-medium text-sm truncate">{item.label}</span>}
                        </div>
                        {isDesktopMenuExpanded && isActive && <ChevronRight size={16} className="flex-shrink-0" />}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="my-4 border-t border-primary"></div>

            <button
              onClick={handleLogout}
              title="Sair"
              className={`w-full flex items-center rounded-lg motion-standard hover-lift-subtle text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 ${isDesktopMenuExpanded
                ? 'justify-start px-4 py-3'
                : 'justify-center p-3'
                }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <LogOut size={20} className="flex-shrink-0" />
                {isDesktopMenuExpanded && <span className="font-medium text-sm truncate">Sair</span>}
              </div>
            </button>
          </nav>
        </aside>

        <main className="relative safe-area-bottom">
          <div className="w-full max-w-7xl mx-auto px-6 xl:px-8 pb-8">
            <section key={location.pathname} className="animate-page-enter">
              {shouldShowOfflinePlaceholder ? <OfflinePlaceholder /> : children}
            </section>
          </div>
        </main>
      </div>

      {floatingCalculatorEnabled && !isSettingsPage && <FloatingCalculator isHidden={isMobileMenuOpen} />}
    </div>
  )
}

