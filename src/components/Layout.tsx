import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, TrendingDown, TrendingUp, BarChart3, PiggyBank, Settings, ChevronRight, Menu, X } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDesktopMenuExpanded, setIsDesktopMenuExpanded] = useState(false)
  const mobileMenuRef = useRef<HTMLElement | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const desktopMenuRef = useRef<HTMLElement | null>(null)
  const desktopMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const activeItemClasses = 'bg-tertiary accent-primary'
  const inactiveItemClasses = 'text-primary hover:bg-tertiary'

  const navItems = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/expenses', icon: TrendingDown, label: 'Despesas' },
    { path: '/incomes', icon: TrendingUp, label: 'Rendas' },
    { path: '/investments', icon: PiggyBank, label: 'Investimentos' },
    { path: '/reports', icon: BarChart3, label: 'Relatórios' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ]

  const categoryItems = [
    { path: '/categories', icon: TrendingDown, label: 'Categorias' },
  ]

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
        <header className="fixed top-0 inset-x-0 z-40 bg-secondary border-b border-primary safe-area-top">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-14 flex items-center gap-3">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                onClick={() => setIsMobileMenuOpen((currentValue) => !currentValue)}
                aria-label={isMobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
                aria-expanded={isMobileMenuOpen}
                className="p-2 rounded-lg text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
              <h1 className="text-lg font-bold text-primary">Finanças</h1>
            </div>
          </div>
        </header>

        {isMobileMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              className="fixed inset-0 z-40 bg-[var(--color-bg-secondary)]/75 animate-fade-in motion-standard"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <aside ref={mobileMenuRef} className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-[340px] bg-secondary border-r border-primary safe-area-top safe-area-bottom overflow-y-auto animate-slide-in-left motion-emphasis">
              <div className="p-4 border-b border-primary flex items-center justify-between">
                <h2 className="text-base font-semibold text-primary">Menu</h2>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Fechar menu de navegação"
                  className="p-2 rounded-lg text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="p-4">
                <div className="space-y-2">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg motion-standard hover-lift-subtle ${
                          isActive
                            ? activeItemClasses
                            : inactiveItemClasses
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={18} />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {isActive && <ChevronRight size={16} />}
                      </Link>
                    )
                  })}
                </div>

                <div className="my-4 border-t border-primary"></div>

                <div className="space-y-2">
                  <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Categorias</p>
                  {categoryItems.map((item) => {
                    const isActive = location.pathname === item.path

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm motion-standard hover-lift-subtle ${
                          isActive
                            ? activeItemClasses
                            : inactiveItemClasses
                        }`}
                      >
                        <span className="font-medium">{item.label}</span>
                        {isActive && <ChevronRight size={16} />}
                      </Link>
                    )
                  })}
                </div>
              </nav>
            </aside>
          </>
        )}

        <main className="safe-area-bottom pt-[calc(3.5rem+env(safe-area-inset-top))]">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-6">
            <section key={location.pathname} className="animate-page-enter">
              {children}
            </section>
          </div>
        </main>
      </div>

      <div className="hidden lg:grid min-h-screen grid-cols-[auto_1fr]">
        <aside
          ref={desktopMenuRef}
          className={`sticky top-0 h-screen bg-secondary border-r border-primary overflow-y-auto motion-emphasis ${
            isDesktopMenuExpanded ? 'w-72' : 'w-20'
          }`}
        >
          <div className={`h-16 px-3 border-b border-primary flex items-center ${isDesktopMenuExpanded ? 'justify-between' : 'justify-center'}`}>
            {isDesktopMenuExpanded && <h2 className="text-lg font-bold text-primary">Finanças</h2>}
            <button
              ref={desktopMenuButtonRef}
              type="button"
              onClick={() => setIsDesktopMenuExpanded((currentValue) => !currentValue)}
              aria-label={isDesktopMenuExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
              aria-expanded={isDesktopMenuExpanded}
              className="p-2 rounded-lg text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            >
              {isDesktopMenuExpanded ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="p-3">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={`flex items-center rounded-lg motion-standard hover-lift-subtle ${
                      isDesktopMenuExpanded
                        ? 'justify-between px-4 py-3'
                        : 'justify-center p-3'
                    } ${
                      isActive
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
                )
              })}
            </div>

            <div className="my-4 border-t border-primary"></div>

            <div className="space-y-2">
              {isDesktopMenuExpanded && (
                <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Categorias</p>
              )}
              {categoryItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={`flex items-center rounded-lg motion-standard hover-lift-subtle ${
                      isDesktopMenuExpanded
                        ? 'justify-between px-4 py-3'
                        : 'justify-center p-3'
                    } ${
                      isActive
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
                )
              })}
            </div>
          </nav>
        </aside>

        <main className="safe-area-bottom">
          <div className="w-full max-w-7xl mx-auto px-6 xl:px-8 pb-8">
            <section key={location.pathname} className="animate-page-enter">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

