import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, TrendingDown, TrendingUp, BarChart3, PiggyBank, Settings, ChevronRight, Menu, X, Tags, CreditCard, LogOut, Users } from 'lucide-react'
import FloatingCalculator from '@/components/FloatingCalculator'
import Button from '@/components/Button'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium motion-standard hover-lift-subtle press-subtle bg-primary text-primary-foreground"
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
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const desktopMenuRef = useRef<HTMLElement | null>(null)
  const desktopMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const activeItemClasses = 'nav-item-active'
  const inactiveItemClasses = 'text-secondary hover:bg-accent/50 border border-transparent hover:text-primary'
  const mobileTabClass = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center w-14 h-12 overflow-visible rounded-xl motion-standard ${
      isActive ? 'nav-item-active font-semibold' : 'font-medium text-secondary hover:text-primary'
    }`

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
        const clickedMobileToggle = mobileMenuButtonRef.current?.contains(target)
        if (!clickedMobileToggle) {
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
    <div className="min-h-screen bg-secondary relative">
      <div id="page-actions-portal-root" className="fixed inset-0 pointer-events-none z-40" />
      <div className="app-shell-glow" aria-hidden="true" />
      <div className="relative z-10">
      <div className="lg:hidden">


        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="modal-sheet-bottom max-h-[85vh] rounded-t-3xl safe-area-bottom gap-0 p-0">
            <div className="modal-drag-handle shrink-0" />
            <SheetHeader className="modal-glass-header text-left">
              <SheetTitle className="text-base font-bold uppercase tracking-wide text-primary">Mais Opções</SheetTitle>
            </SheetHeader>
            <div className="p-5 overflow-y-auto max-h-[calc(85vh-5.5rem)]">
              <div className="grid grid-cols-2 gap-3">
                {!(!isOnline) && (
                  <Link
                    to="/credit-cards"
                    className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none glass-glow-card"
                  >
                    <CreditCard size={20} className="text-secondary mb-2" />
                    <span className="text-xs font-bold text-primary">Cartões</span>
                  </Link>
                )}
                {!(!isOnline) && (
                  <Link
                    to="/reports"
                    className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none glass-glow-card"
                  >
                    <BarChart3 size={20} className="text-secondary mb-2" />
                    <span className="text-xs font-bold text-primary">Relatórios</span>
                  </Link>
                )}
                {!(!isOnline) && (
                  <Link
                    to="/categories"
                    className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none glass-glow-card"
                  >
                    <Tags size={20} className="text-secondary mb-2" />
                    <span className="text-xs font-bold text-primary">Categorias</span>
                  </Link>
                )}
                <Link
                  to="/settings"
                  className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none glass-glow-card"
                >
                  <Settings size={20} className="text-secondary mb-2" />
                  <span className="text-xs font-bold text-primary">Ajustes</span>
                </Link>
                {hasAdvisoryLink && (
                  <Link
                    to="/my-consulting"
                    className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none col-span-2 glass-glow-card"
                  >
                    <Users size={20} className="text-secondary mb-2" />
                    <span className="text-xs font-bold text-primary">Minha Consultoria</span>
                  </Link>
                )}
                {profile?.role === 'consultant' && (
                  <Link
                    to="/consulting"
                    className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none col-span-2 glass-glow-card"
                  >
                    <Users size={20} className="text-secondary mb-2" />
                    <span className="text-xs font-bold text-primary">Consultoria</span>
                  </Link>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    void handleLogout()
                  }}
                  className="col-span-2 mt-2 uppercase tracking-wider text-xs"
                >
                  <LogOut size={16} />
                  Sair do App
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <nav className="glass-bottom-nav fixed bottom-0 inset-x-0 z-[100] safe-area-bottom flex items-center justify-around shadow-lg px-2">
          {/* Home Tab */}
          <Link to="/" className={mobileTabClass(location.pathname === '/')}>
            <Home size={18} aria-hidden />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Início</span>
          </Link>

          {/* Expenses Tab */}
          <Link to="/expenses" className={mobileTabClass(location.pathname === '/expenses')}>
            <TrendingDown size={18} aria-hidden />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Despesas</span>
          </Link>

          {/* Incomes Tab */}
          <Link to="/incomes" className={mobileTabClass(location.pathname === '/incomes')}>
            <TrendingUp size={18} aria-hidden />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Rendas</span>
          </Link>

          {/* Investments Tab */}
          <Link to="/investments" className={mobileTabClass(location.pathname === '/investments')}>
            <PiggyBank size={18} aria-hidden />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Carteira</span>
          </Link>

          {/* "Mais" Menu Tab Button */}
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={mobileTabClass(
              isMobileMenuOpen || !['/', '/expenses', '/incomes', '/investments'].includes(location.pathname)
            )}
          >
            <Menu size={18} aria-hidden />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Mais</span>
          </button>
        </nav>

        {/* Main Content Area with Bottom Padding to avoid navigation overlay */}
        <main className="relative pt-[calc(1rem+env(safe-area-inset-top))] glass-main-padding min-h-screen">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-6">
            <section key={location.pathname} className="relative animate-page-enter">
              {children}
            </section>
          </div>
        </main>
      </div>

      <div className="hidden lg:grid min-h-screen grid-cols-[auto_1fr] p-5 gap-5">
        <aside
          ref={desktopMenuRef}
          className={`glass-sidebar sticky top-5 h-[calc(100vh-2.5rem)] overflow-y-auto motion-emphasis ${isDesktopMenuExpanded ? 'w-72' : 'w-20'
            }`}
        >
          <div className={`px-3 py-4 border-b border-glass flex items-center ${isDesktopMenuExpanded ? 'justify-between' : 'justify-center'}`}>
            {isDesktopMenuExpanded && (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-secondary">Bem-vindo</p>
                <h2 className="text-lg font-bold text-primary truncate">Finanças</h2>
                {profile?.email && (
                  <p className="text-xs text-secondary truncate">{profile.email}</p>
                )}
              </div>
            )}
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
                <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Visão geral</p>
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
                        className={`flex items-center rounded-xl motion-standard hover-lift-subtle ${isDesktopMenuExpanded
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
                <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Outros</p>
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
                        className={`flex items-center rounded-xl motion-standard hover-lift-subtle ${isDesktopMenuExpanded
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
            <section key={location.pathname} className="relative animate-page-enter">
              {shouldShowOfflinePlaceholder ? <OfflinePlaceholder /> : children}
            </section>
          </div>
        </main>
      </div>

      {floatingCalculatorEnabled && !isSettingsPage && <FloatingCalculator isHidden={isMobileMenuOpen} />}
      </div>
    </div>
  )
}

