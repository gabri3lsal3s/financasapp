import { useTheme, type Theme } from '@/hooks/useTheme'
import { Palette } from 'lucide-react'
import Card from './Card'

const themes: Array<{ id: Theme; name: string; description: string }> = [
  { id: 'light', name: 'Modo Claro', description: 'Interface clássica clara' },
  { id: 'dark', name: 'Modo Escuro', description: 'Interface escura premium' },
  { id: 'midnight', name: 'Preto Absoluto', description: 'Contraste máximo (OLED)' },
  { id: 'system', name: 'Sistema', description: 'Acompanha o dispositivo' },
]

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette size={18} className="accent-primary" />
            <h3 className="text-lg font-semibold text-primary">Tema</h3>
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
                {t.id === 'light' && (
                  <>
                    <div className="flex-1" style={{ backgroundColor: '#ffffff' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#f8f8f8' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#101010' }}></div>
                  </>
                )}
                {t.id === 'dark' && (
                  <>
                    <div className="flex-1" style={{ backgroundColor: '#09090b' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#18181b' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#fafafa' }}></div>
                  </>
                )}
                {t.id === 'midnight' && (
                  <div className="flex-1 bg-black flex gap-1">
                    <div className="flex-1 border-r border-white/5" style={{ backgroundColor: '#000000' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#ffffff' }}></div>
                  </div>
                )}
                {t.id === 'system' && (
                  <>
                    <div className="flex-1" style={{ backgroundColor: '#ffffff' }}></div>
                    <div className="absolute inset-y-0 right-0 left-1/2 flex">
                      <div className="flex-1" style={{ backgroundColor: '#000000', borderLeft: '1px solid #27272a' }}></div>
                    </div>
                  </>
                )}
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
