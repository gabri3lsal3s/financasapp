import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, LogOut, Menu, X } from 'lucide-react'
import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEMS, type NavItem } from '@/constants/navigation'

interface DesktopSidebarProps {
  isExpanded: boolean
  onToggle: () => void
  sidebarRef: Ref<HTMLElement>
  toggleButtonRef: Ref<HTMLButtonElement>
  profileEmail?: string
  pathname: string
  isOnline: boolean
  onLogout: () => void
}

const ACTIVE_ITEM_CLASSES = 'nav-item-active'
const INACTIVE_ITEM_CLASSES = 'text-secondary hover:bg-accent/50 border border-transparent hover:text-primary'

function SidebarLink({
  item,
  isExpanded,
  pathname,
  isOnline,
  labelClassName,
}: {
  item: NavItem
  isExpanded: boolean
  pathname: string
  isOnline: boolean
  labelClassName: string
}) {
  const Icon = item.icon
  const isActive = pathname === item.path
  const isConcealed = item.onlineOnly && !isOnline

  return (
    <div className={`transition-conceal-container ${isConcealed ? 'is-concealed' : ''}`}>
      <div className="transition-conceal-content">
        <Link
          to={item.path}
          title={item.label}
          className={`flex items-center rounded-xl motion-standard hover-lift-subtle ${isExpanded
            ? 'justify-between px-4 py-3'
            : 'justify-center p-3'
            } ${isActive
              ? ACTIVE_ITEM_CLASSES
              : INACTIVE_ITEM_CLASSES
            }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Icon size={20} className="flex-shrink-0" />
            {isExpanded && <span className={labelClassName}>{item.label}</span>}
          </div>
          {isExpanded && isActive && <ChevronRight size={16} className="flex-shrink-0" />}
        </Link>
      </div>
    </div>
  )
}

export default function DesktopSidebar({
  isExpanded,
  onToggle,
  sidebarRef,
  toggleButtonRef,
  profileEmail,
  pathname,
  isOnline,
  onLogout,
}: DesktopSidebarProps) {
  return (
    <aside
      ref={sidebarRef}
      className={`glass-sidebar sticky top-5 h-[calc(100dvh-2.5rem)] overflow-y-auto motion-emphasis hidden lg:block ${
        isExpanded ? 'w-72' : 'w-20'
      }`}
    >
      <div className={`px-3 py-4 border-b border-glass flex items-center ${isExpanded ? 'justify-between' : 'justify-center'}`}>
        {isExpanded && (
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-secondary">Bem-vindo</p>
            <h2 className="text-lg font-bold text-primary truncate">Finanças</h2>
            {profileEmail && (
              <p className="text-xs text-secondary truncate">{profileEmail}</p>
            )}
          </div>
        )}
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
          className="p-2 rounded-lg text-primary hover:bg-tertiary motion-standard hover-lift-subtle press-subtle focus:outline-none"
        >
          {isExpanded ? <X size={20} className="nav-chrome-icon" /> : <Menu size={20} className="nav-chrome-icon" />}
        </button>
      </div>

      <nav className="p-3">
        <div className="space-y-2">
          {isExpanded && (
            <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Visão geral</p>
          )}
          {MAIN_NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.path}
              item={item}
              isExpanded={isExpanded}
              pathname={pathname}
              isOnline={isOnline}
              labelClassName="font-medium truncate"
            />
          ))}
        </div>

        <div className="my-4 border-t border-primary"></div>

        <div className="space-y-2">
          {isExpanded && (
            <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Outros</p>
          )}
          {SETTINGS_NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.path}
              item={item}
              isExpanded={isExpanded}
              pathname={pathname}
              isOnline={isOnline}
              labelClassName="font-medium text-sm truncate"
            />
          ))}
        </div>

        <div className="my-4 border-t border-primary"></div>

        <button
          onClick={onLogout}
          title="Sair"
          className={`w-full flex items-center rounded-lg motion-standard hover-lift-subtle text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 ${isExpanded
            ? 'justify-start px-4 py-3'
            : 'justify-center p-3'
            }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <LogOut size={20} className="flex-shrink-0" />
            {isExpanded && <span className="font-medium text-sm truncate">Sair</span>}
          </div>
        </button>
      </nav>
    </aside>
  )
}
