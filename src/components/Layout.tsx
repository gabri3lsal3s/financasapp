import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, TrendingDown, TrendingUp, BarChart3, PiggyBank, Settings, ChevronRight, Menu, X, Tags, LogOut, Receipt, WifiOff, ArrowLeft } from 'lucide-react'
import FloatingCalculator from '@/components/FloatingCalculator'
import FloatingSideStack from '@/components/FloatingSideStack'
import FloatingActionHub from '@/components/FloatingActionHub'
import PageActionButtonHub from '@/components/PageActionButtonHub'
import AppTopBar from '@/components/AppTopBar'
import { FloatingActionsProvider } from '@/contexts/FloatingActionsContext'
import Button from '@/components/Button'
import { isCalculatorElement } from '@/utils/calculator'
import { Z_INDEX } from '@/constants/zIndex'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

import { useAuth } from '@/contexts/AuthContext'
import { useBackgroundCache } from '@/hooks/useBackgroundCache'
import { useNavigate } from 'react-router-dom'

import { logger } from '@/utils/logger'

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

function LayoutInner({ children }: LayoutProps) {
  const { settings: { floatingCalculatorEnabled } } = useAppSettings()
  const { signOut, profile } = useAuth()
  useBackgroundCache()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDesktopMenuExpanded, setIsDesktopMenuExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('sidebar-expanded')
    return stored === 'true'
  })
  const isSettingsPage = location.pathname === '/settings'
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileMenuContentRef = useRef<HTMLDivElement | null>(null)
  const desktopMenuRef = useRef<HTMLElement | null>(null)
  const desktopMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const activeItemClasses = 'nav-item-active'
  const inactiveItemClasses = 'text-secondary hover:bg-accent/50 border border-transparent hover:text-primary'

  // Otimisticamente todas as páginas exceto Configurações possuem ações flutuantes
  const hasPageActions = !isSettingsPage

  const mobileTabClass = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center w-14 h-12 overflow-visible rounded-xl motion-standard ${
      isActive ? 'nav-item-active font-semibold' : 'font-medium text-secondary hover:text-primary'
    }`

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      logger.error('Error logging out:', error)
    }
  }

  const { isOnline } = useNetworkStatus()

  const navItems = (() => {
    const items = [
      { path: '/', icon: Home, label: 'Início', onlineOnly: false },
      { path: '/expenses', icon: TrendingDown, label: 'Despesas', onlineOnly: false },
      { path: '/incomes', icon: TrendingUp, label: 'Rendas', onlineOnly: false },
      { path: '/contas', icon: Receipt, label: 'Contas', onlineOnly: true },
      { path: '/investments', icon: PiggyBank, label: 'Investimentos', onlineOnly: false },
    ]



    items.push(
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
        localStorage.setItem('sidebar-expanded', 'false')
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
        const clickedInsideMobileMenu = mobileMenuContentRef.current?.contains(target)
        if (!clickedMobileToggle && !clickedInsideMobileMenu) {
          setIsMobileMenuOpen(false)
        }
      }

      if (isDesktopMenuExpanded) {
        const clickedDesktopMenu = desktopMenuRef.current?.contains(target)
        const clickedDesktopToggle = desktopMenuButtonRef.current?.contains(target)
        if (!clickedDesktopMenu && !clickedDesktopToggle) {
          setIsDesktopMenuExpanded(false)
          localStorage.setItem('sidebar-expanded', 'false')
        }
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
    }
  }, [isMobileMenuOpen, isDesktopMenuExpanded])

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <div
      className="min-h-screen bg-secondary relative app-layout-root"
      style={{
        '--sidebar-offset': isDesktopMenuExpanded ? '328px' : '120px'
      } as React.CSSProperties}
    >
      <FloatingActionHub />
      <PageActionButtonHub />
      <FloatingSideStack />
      <div className={`relative ${Z_INDEX.CONTENT}`}>
        
        {/* Elementos mobile fixos (Sheet e Nav) que não entram no fluxo de grid */}
        <div className="lg:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetContent
              ref={mobileMenuContentRef}
              side="bottom"
              showCloseButton={false}
              onPointerDownOutside={(e) => {
                if (isCalculatorElement(e.target)) {
                  e.preventDefault()
                }
              }}
              onInteractOutside={(e) => {
                if (isCalculatorElement(e.target)) {
                  e.preventDefault()
                }
              }}
              className="modal-sheet-bottom max-h-[85vh] rounded-t-3xl safe-area-bottom gap-0 p-0"
            >
              <div className="modal-drag-handle shrink-0" />
              <SheetHeader className="modal-glass-header text-left">
                <SheetTitle className="text-base font-bold uppercase tracking-wide text-primary">Mais Opções</SheetTitle>
              </SheetHeader>
              <div className="p-5 overflow-y-auto max-h-[calc(85vh-5.5rem)]">
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/investments"
                    className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                  >
                    <PiggyBank size={20} className="text-secondary mb-2" />
                    <span className="text-xs font-bold text-primary">Investimentos</span>
                  </Link>
                  {!(!isOnline) && (
                    <Link
                      to="/reports"
                      className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                    >
                      <BarChart3 size={20} className="text-secondary mb-2" />
                      <span className="text-xs font-bold text-primary">Relatórios</span>
                    </Link>
                  )}
                  {!(!isOnline) && (
                    <Link
                      to="/categories"
                      className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                    >
                      <Tags size={20} className="text-secondary mb-2" />
                      <span className="text-xs font-bold text-primary">Categorias</span>
                    </Link>
                  )}
                  <Link
                    to="/settings"
                    className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
                  >
                    <Settings size={20} className="text-secondary mb-2" />
                    <span className="text-xs font-bold text-primary">Ajustes</span>
                  </Link>

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

          <nav className={`glass-bottom-nav fixed bottom-0 inset-x-0 ${Z_INDEX.NAVIGATION} safe-area-bottom flex items-center justify-around shadow-lg px-2 ${hasPageActions ? 'has-page-actions' : ''} ${isSettingsPage ? 'no-transition' : ''}`}>
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

            {/* Contas Tab */}
            <Link to="/contas" className={mobileTabClass(location.pathname === '/contas')}>
              <Receipt size={18} aria-hidden />
              <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Contas</span>
            </Link>

            {/* "Mais" Menu Tab Button */}
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className={mobileTabClass(
                isMobileMenuOpen || !['/', '/expenses', '/incomes', '/contas'].includes(location.pathname)
              )}
            >
              <Menu size={18} aria-hidden />
              <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Mais</span>
            </button>
          </nav>
        </div>

        {/* Layout Principal responsivo:
            Mobile: layout vertical de 1 coluna
            Desktop: grid de 2 colunas [auto_1fr] com gap-5 e p-5 */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] min-h-screen lg:p-5 lg:gap-5">
          {/* Desktop Sidebar: ocultada no mobile */}
          <aside
            ref={desktopMenuRef}
            className={`glass-sidebar sticky top-5 h-[calc(100vh-2.5rem)] overflow-y-auto motion-emphasis hidden lg:block ${
              isDesktopMenuExpanded ? 'w-72' : 'w-20'
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
                onClick={() => {
                  setIsDesktopMenuExpanded((currentValue) => {
                    const next = !currentValue
                    localStorage.setItem('sidebar-expanded', String(next))
                    return next
                  })
                }}
                aria-label={isDesktopMenuExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
                className="p-2 rounded-lg text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none"
              >
                {isDesktopMenuExpanded ? <X size={20} className="nav-chrome-icon" /> : <Menu size={20} className="nav-chrome-icon" />}
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

          {/* Área de Conteúdo Principal (Única!) */}
          <main className="relative pt-[calc(0.5rem+env(safe-area-inset-top))] glass-main-padding lg:pt-0 lg:safe-area-bottom min-h-screen">
            <AppTopBar />
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-0 lg:px-6 lg:xl:px-8 lg:pb-[74px]">
              <section key={location.pathname} className="relative animate-page-enter">
                {shouldShowOfflinePlaceholder ? <OfflinePlaceholder /> : children}
              </section>
            </div>
          </main>
        </div>

        {floatingCalculatorEnabled && !isSettingsPage && <FloatingCalculator />}
      </div>
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  return (
    <FloatingActionsProvider>
      <LayoutInner>{children}</LayoutInner>
    </FloatingActionsProvider>
  )
}

