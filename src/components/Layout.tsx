import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, TrendingDown, TrendingUp, BarChart3, PiggyBank, Settings, ChevronRight } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/expenses', icon: TrendingDown, label: 'Despesas' },
    { path: '/incomes', icon: TrendingUp, label: 'Rendas' },
    { path: '/investments', icon: PiggyBank, label: 'Investimentos' },
    { path: '/reports', icon: BarChart3, label: 'Relatórios' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ]

  const categoryItems = [
    { path: '/expense-categories', label: 'Categorias de Despesas' },
    { path: '/income-categories', label: 'Categorias de Rendas' },
  ]

  return (
    <div className="min-h-screen bg-primary transition-colors duration-300">
      {/* Mobile Layout - Bottom Navigation */}
      <div className="lg:hidden">
        <main className="pb-20 safe-area-bottom">
          <div className="max-w-md mx-auto">
            {children}
          </div>
        </main>
        
        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-primary border-t border-primary shadow-lg safe-area-bottom">
          <div className="max-w-md mx-auto">
            <div className="grid grid-cols-6 gap-0">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center justify-center py-3 px-1 transition-colors ${
                      isActive
                        ? 'text-primary bg-accent-primary'
                        : 'text-primary hover:bg-secondary'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-xs mt-1 text-center font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* Desktop Layout - Side Navigation */}
      <div className="hidden lg:grid grid-cols-[250px_1fr] min-h-screen gap-0">
        {/* Sidebar */}
        <aside className="bg-secondary border-r border-primary sticky top-0 h-screen overflow-y-auto">
          {/* Logo/Header */}
          <div className="p-6 border-b border-primary">
            <h1 className="text-2xl font-bold text-primary">Finanças</h1>
            <p className="text-sm text-secondary mt-1">Seu gestor financeiro</p>
          </div>

          {/* Navigation Links */}
          <nav className="p-4">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-accent-primary text-primary'
                        : 'text-primary hover:bg-tertiary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {isActive && <ChevronRight size={16} />}
                  </Link>
                )
              })}
            </div>
            
            {/* Divider */}
            <div className="my-4 border-t border-primary"></div>
            
            {/* Categories Section */}
            <div className="space-y-2">
              <p className="px-4 text-xs font-semibold text-secondary uppercase tracking-wide">Categorias</p>
              {categoryItems.map((item) => {
                const isActive = location.pathname === item.path
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors text-sm ${
                      isActive
                        ? 'bg-accent-primary text-primary'
                        : 'text-primary hover:bg-tertiary'
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

        {/* Main Content */}
        <main className="overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

