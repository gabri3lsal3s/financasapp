import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { MOBILE_MAIN_PATHS, NAV_ITEMS } from '@/constants/navigation'
import { Z_INDEX } from '@/constants/zIndex'

interface MobileBottomNavProps {
  pathname: string
  isMobileMenuOpen: boolean
  onOpenMenu: () => void
  menuButtonRef: Ref<HTMLButtonElement>
  hasPageActions: boolean
  isSettingsPage: boolean
}

/** As 4 abas fixas da bottom nav (o restante fica no menu "Mais"). */
const MOBILE_TABS = NAV_ITEMS.slice(0, 4)

export default function MobileBottomNav({
  pathname,
  isMobileMenuOpen,
  onOpenMenu,
  menuButtonRef,
  hasPageActions,
  isSettingsPage,
}: MobileBottomNavProps) {
  const mobileTabClass = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center w-14 h-12 overflow-visible rounded-xl motion-standard ${
      isActive ? 'nav-item-active font-semibold' : 'font-medium text-secondary hover:text-primary'
    }`

  const isMoreActive = isMobileMenuOpen || !MOBILE_MAIN_PATHS.includes(pathname)

  return (
    <nav
      className={`glass-bottom-nav fixed bottom-0 inset-x-0 ${Z_INDEX.NAVIGATION} safe-area-bottom flex items-center justify-around px-2 ${hasPageActions ? 'has-page-actions' : ''} ${isSettingsPage ? 'no-transition' : ''}`}
    >
      {MOBILE_TABS.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.path

        return (
          <Link key={item.path} to={item.path} className={mobileTabClass(isActive)}>
            <Icon size={18} aria-hidden />
            <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">{item.label}</span>
          </Link>
        )
      })}

      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenMenu}
        className={mobileTabClass(isMoreActive)}
      >
        <Menu size={18} aria-hidden />
        <span className="text-[9px] mt-0.5 tracking-tight truncate w-full text-center">Mais</span>
      </button>
    </nav>
  )
}
