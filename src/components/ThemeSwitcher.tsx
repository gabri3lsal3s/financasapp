import { useTheme, type Theme } from '@/hooks/useTheme'
import { Palette } from 'lucide-react'
import Card from './Card'

function ThemePreview({ themeId, isCyber }: { themeId: Theme; isCyber: boolean }) {
  if (themeId === 'light') {
    return isCyber ? (
      <div className="flex-1 flex gap-1 relative p-1 theme-preview-cyber-bg-light">
        <div className="flex-1 rounded-sm border border-black/5 theme-preview-light-classic-a" />
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full theme-preview-dot-income" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full theme-preview-dot-expense" />
      </div>
    ) : (
      <div className="flex-1 flex gap-1">
        <div className="flex-1 theme-preview-light-classic-a" />
        <div className="flex-1 theme-preview-light-classic-b" />
        <div className="flex-1 theme-preview-light-classic-c" />
      </div>
    )
  }

  if (themeId === 'dark') {
    return isCyber ? (
      <div className="flex-1 flex gap-1 relative p-1 theme-preview-cyber-bg-dark">
        <div className="flex-1 rounded-sm border border-white/5 theme-preview-dark-classic-b" />
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full theme-preview-dot-income" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full theme-preview-dot-expense" />
      </div>
    ) : (
      <div className="flex-1 flex gap-1">
        <div className="flex-1 theme-preview-dark-classic-a" />
        <div className="flex-1 theme-preview-dark-classic-b" />
        <div className="flex-1 theme-preview-dark-classic-c" />
      </div>
    )
  }

  if (themeId === 'midnight') {
    return isCyber ? (
      <div className="flex-1 flex gap-1 relative p-1 bg-black">
        <div className="flex-1 rounded-sm border border-white/5 theme-preview-midnight-classic-a" />
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full theme-preview-dot-income" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full theme-preview-dot-expense" />
      </div>
    ) : (
      <div className="flex-1 bg-black flex gap-1">
        <div className="flex-1 border-r border-white/5 theme-preview-midnight-classic-a" />
        <div className="flex-1 theme-preview-midnight-classic-c" />
      </div>
    )
  }

  return isCyber ? (
    <div className="flex-1 flex relative p-1 theme-preview-cyber-bg-light">
      <div className="flex-1 rounded-sm border border-black/5 theme-preview-light-classic-a" />
      <div className="absolute inset-y-0 right-0 left-1/2 flex p-1 theme-preview-cyber-bg-dark theme-preview-system-split-border">
        <div className="flex-1 rounded-sm border border-white/5 theme-preview-dark-classic-b" />
      </div>
      <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full theme-preview-dot-income" />
      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full theme-preview-dot-expense" />
    </div>
  ) : (
    <div className="flex-1 relative flex">
      <div className="flex-1 theme-preview-light-classic-a" />
      <div className="absolute inset-y-0 right-0 left-1/2 flex theme-preview-system-split-border">
        <div className="flex-1 theme-preview-midnight-classic-a" />
      </div>
    </div>
  )
}

export default function ThemeSwitcher() {
  const { theme, setTheme, visualStyle } = useTheme()
  const isCyber = visualStyle === 'cyberpunk'

  const themes: Array<{ id: Theme; name: string; description: string }> = [
    {
      id: 'light',
      name: isCyber ? 'Claro Cyber-Glass' : 'Modo Claro',
      description: isCyber ? 'Atmosfera clara com vidro translúcido' : 'Interface clássica clara',
    },
    {
      id: 'dark',
      name: isCyber ? 'Deep Space Dark' : 'Modo Escuro',
      description: isCyber ? 'Espaço profundo com acentos neon' : 'Interface escura premium',
    },
    {
      id: 'midnight',
      name: isCyber ? 'Deep Space OLED' : 'Preto Absoluto',
      description: isCyber ? 'Contraste máximo com fundo preto absoluto' : 'Contraste máximo (OLED)',
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
          <p className="text-secondary text-sm">Escolha o modo de visualização do app</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`p-3 rounded-lg border motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] text-left ${theme === t.id
                ? 'border-primary bg-tertiary accent-primary'
                : 'border-primary bg-secondary text-secondary hover:text-primary hover:bg-tertiary'
                }`}
            >
              <div className="mb-3 h-14 rounded-md flex gap-1 overflow-hidden relative border border-primary/20">
                <ThemePreview themeId={t.id} isCyber={isCyber} />
              </div>

              <div className="flex flex-col gap-1">
                <p className="font-semibold text-[13px] text-primary leading-tight">{t.name}</p>
                <p className="text-[10px] leading-tight text-secondary line-clamp-2">{t.description}</p>
              </div>
              {theme === t.id && <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-secondary">Ativo</div>}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
