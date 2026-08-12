import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import FloatingCalculator from '@/components/FloatingCalculator'
import FloatingSideStack from '@/components/FloatingSideStack'
import FloatingActionHub from '@/components/FloatingActionHub'
import PageActionButtonHub from '@/components/PageActionButtonHub'
import AppTopBar from '@/components/AppTopBar'
import PullToRefresh from '@/components/PullToRefresh'
import OfflinePlaceholder from '@/components/layout/OfflinePlaceholder'
import MobileMenuSheet from '@/components/layout/MobileMenuSheet'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import DesktopSidebar from '@/components/layout/DesktopSidebar'
import { FloatingActionsProvider } from '@/contexts/FloatingActionsContext'
import { Z_INDEX } from '@/constants/zIndex'
import { NAV_ITEMS } from '@/constants/navigation'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useBackgroundCache } from '@/hooks/useBackgroundCache'
import { useLayoutNavigation } from '@/hooks/useLayoutNavigation'

interface LayoutProps {
  children: ReactNode
}

function LayoutInner({ children }: LayoutProps) {
  const { settings: { floatingCalculatorEnabled } } = useAppSettings()
  useBackgroundCache()
  const location = useLocation()
  const { isOnline } = useNetworkStatus()
  const {
    profile,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isDesktopMenuExpanded,
    toggleDesktopMenu,
    mobileMenuButtonRef,
    mobileMenuContentRef,
    desktopMenuRef,
    desktopMenuButtonRef,
    handleLogout,
  } = useLayoutNavigation()

  const isSettingsPage = location.pathname === '/settings'

  // Otimisticamente todas as páginas exceto Configurações possuem ações flutuantes
  const hasPageActions = !isSettingsPage

  const isCurrentPathOnlineOnly = NAV_ITEMS.find(item => item.path === location.pathname)?.onlineOnly || false
  const shouldShowOfflinePlaceholder = !isOnline && isCurrentPathOnlineOnly

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
          <MobileMenuSheet
            isOpen={isMobileMenuOpen}
            onOpenChange={setIsMobileMenuOpen}
            contentRef={mobileMenuContentRef}
            isOnline={isOnline}
            onLogout={() => {
              setIsMobileMenuOpen(false)
              void handleLogout()
            }}
          />
          <MobileBottomNav
            pathname={location.pathname}
            isMobileMenuOpen={isMobileMenuOpen}
            onOpenMenu={() => setIsMobileMenuOpen(true)}
            menuButtonRef={mobileMenuButtonRef}
            hasPageActions={hasPageActions}
            isSettingsPage={isSettingsPage}
          />
        </div>

        {/* Layout Principal responsivo:
            Mobile: layout vertical de 1 coluna
            Desktop: grid de 2 colunas [auto_1fr] com gap-5 e p-5 */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] min-h-screen lg:p-5 lg:gap-5">
          {/* Desktop Sidebar: ocultada no mobile */}
          <DesktopSidebar
            isExpanded={isDesktopMenuExpanded}
            onToggle={toggleDesktopMenu}
            sidebarRef={desktopMenuRef}
            toggleButtonRef={desktopMenuButtonRef}
            profileEmail={profile?.email}
            pathname={location.pathname}
            isOnline={isOnline}
            onLogout={handleLogout}
          />

          {/* Área de Conteúdo Principal (Única!) */}
          <main className="relative pt-[calc(0.5rem+env(safe-area-inset-top))] glass-main-padding lg:pt-0 lg:safe-area-bottom min-h-screen">
            <AppTopBar />
            <div className="w-full max-w-7xl mx-auto px-4 lg:px-6 pb-0 lg:pb-[74px]">
              <PullToRefresh>
                <section key={location.pathname} className="relative animate-page-enter">
                  {shouldShowOfflinePlaceholder ? <OfflinePlaceholder /> : children}
                </section>
              </PullToRefresh>
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
