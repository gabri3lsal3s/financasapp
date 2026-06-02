import { useTheme, type Theme } from '@/hooks/useTheme'
import { Palette } from 'lucide-react'
import Card from './Card'
import Button from './Button'
import { cn } from '@/lib/utils'

function ThemePreview({ themeId }: { themeId: Theme }) {
  if (themeId === 'light') {
    return (
      <div className="flex-1 flex gap-1 relative p-1 theme-preview-cyber-bg-light">
        <div className="flex-1 rounded-sm border border-black/5 theme-preview-light-classic-a surface-glass" />
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full theme-preview-dot-income" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full theme-preview-dot-expense" />
      </div>
    )
  }

  if (themeId === 'dark') {
    return (
      <div className="flex-1 flex gap-1 relative p-1 theme-preview-cyber-bg-dark">
        <div className="flex-1 rounded-sm border border-white/5 theme-preview-dark-classic-b surface-glass" />
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full theme-preview-dot-income" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full theme-preview-dot-expense" />
      </div>
    )
  }

  if (themeId === 'midnight') {
    return (
      <div className="flex-1 flex gap-1 relative p-1 bg-black">
        <div className="flex-1 rounded-sm border border-white/5 theme-preview-midnight-classic-a surface-glass" />
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full theme-preview-dot-income" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full theme-preview-dot-expense" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex relative p-1 theme-preview-cyber-bg-light">
      <div className="flex-1 rounded-sm border border-black/5 theme-preview-light-classic-a surface-glass" />
      <div className="absolute inset-y-0 right-0 left-1/2 flex p-1 theme-preview-cyber-bg-dark theme-preview-system-split-border">
        <div className="flex-1 rounded-sm border border-white/5 theme-preview-dark-classic-b surface-glass" />
      </div>
      <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full theme-preview-dot-income" />
      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full theme-preview-dot-expense" />
    </div>
  )
}

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  const themes: Array<{ id: Theme; name: string; description: string }> = [
    {
      id: 'light',
      name: 'Glass Claro',
      description: 'Superfícies translúcidas com acentos suaves',
    },
    {
      id: 'dark',
      name: 'Glass Escuro',
      description: 'Fundo escuro com vidro e destaque neutro',
    },
    {
      id: 'midnight',
      name: 'Glass Midnight',
      description: 'Contraste OLED com vidro profundo',
    },
    {
      id: 'system',
      name: 'Sistema',
      description: 'Acompanha o dispositivo',
    },
  ]

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette size={18} className="accent-primary" />
            <h3 className="text-lg font-semibold text-primary">Tema de Cores</h3>
          </div>
          <p className="text-secondary text-sm">Escolha o modo de visualização glass do app</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {themes.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant="outline"
              onClick={() => setTheme(t.id)}
              className={cn(
                'h-auto w-full flex-col items-stretch p-3 text-left',
                theme === t.id ? 'nav-item-active' : 'border-glass text-secondary hover:text-primary'
              )}
            >
              <div className="mb-3 h-14 rounded-md flex gap-1 overflow-hidden relative border border-glass">
                <ThemePreview themeId={t.id} />
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-semibold text-[13px] text-primary leading-tight">{t.name}</p>
                <p className="text-[10px] leading-tight text-secondary line-clamp-2">{t.description}</p>
              </div>
              {theme === t.id && <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-secondary">Ativo</div>}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}
