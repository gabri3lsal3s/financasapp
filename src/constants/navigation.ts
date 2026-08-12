import {
  Home,
  TrendingDown,
  TrendingUp,
  Receipt,
  PiggyBank,
  BarChart3,
  Tags,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  icon: LucideIcon
  label: string
  onlineOnly: boolean
}

/** Os 8 destinos de navegação do app (fonte única — Regra: MANTER 8 destinos). */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', icon: Home, label: 'Início', onlineOnly: false },
  { path: '/expenses', icon: TrendingDown, label: 'Despesas', onlineOnly: false },
  { path: '/incomes', icon: TrendingUp, label: 'Rendas', onlineOnly: false },
  { path: '/contas', icon: Receipt, label: 'Contas', onlineOnly: true },
  { path: '/investments', icon: PiggyBank, label: 'Investimentos', onlineOnly: false },
  { path: '/reports', icon: BarChart3, label: 'Relatórios', onlineOnly: true },
  { path: '/categories', icon: Tags, label: 'Categorias', onlineOnly: true },
  { path: '/settings', icon: Settings, label: 'Configurações do App', onlineOnly: false },
] as const

/** Itens principais da sidebar desktop (todos exceto Configurações). */
export const MAIN_NAV_ITEMS = NAV_ITEMS.slice(0, -1)

/** Item final da sidebar desktop (Configurações). */
export const SETTINGS_NAV_ITEMS = NAV_ITEMS.slice(-1)

/** Rotas das 4 abas fixas da bottom nav mobile (o restante fica no menu "Mais"). */
export const MOBILE_MAIN_PATHS: readonly string[] = ['/', '/expenses', '/incomes', '/contas']
