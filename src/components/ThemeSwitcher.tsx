import { useTheme, type Theme } from '@/hooks/useTheme'
import { Palette } from 'lucide-react'
import Card from './Card'

export default function ThemeSwitcher() {
  const { theme, setTheme, visualStyle } = useTheme()

  const themes: Array<{ id: Theme; name: string; description: string }> = [
    {
      id: 'light',
      name: visualStyle === 'cyberpunk' ? 'Claro Cyber-Glass' : 'Modo Claro',
      description: visualStyle === 'cyberpunk' ? 'Atmosfera clara com vidro translúcido' : 'Interface clássica clara',
    },
    {
      id: 'dark',
      name: visualStyle === 'cyberpunk' ? 'Deep Space Dark' : 'Modo Escuro',
      description: visualStyle === 'cyberpunk' ? 'Espaço profundo com acentos neon' : 'Interface escura premium',
    },
    {
      id: 'midnight',
      name: visualStyle === 'cyberpunk' ? 'Deep Space OLED' : 'Preto Absoluto',
      description: visualStyle === 'cyberpunk' ? 'Contraste máximo com fundo preto absoluto' : 'Contraste máximo (OLED)',
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
                {t.id === 'light' && (
                  visualStyle === 'cyberpunk' ? (
                    <div className="flex-1 flex gap-1 relative p-1" style={{ backgroundColor: '#f4f6fa' }}>
                      <div className="flex-1 rounded-sm border border-black/5" style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)' }}></div>
                      <div className="absolute top-2 left-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
                      <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#EF4444' }}></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1" style={{ backgroundColor: '#ffffff' }}></div>
                      <div className="flex-1" style={{ backgroundColor: '#f8f8f8' }}></div>
                      <div className="flex-1" style={{ backgroundColor: '#101010' }}></div>
                    </>
                  )
                )}
                {t.id === 'dark' && (
                  visualStyle === 'cyberpunk' ? (
                    <div className="flex-1 flex gap-1 relative p-1" style={{ backgroundColor: '#080911' }}>
                      <div className="flex-1 rounded-sm border border-white/5" style={{ backgroundColor: 'rgba(18, 20, 32, 0.6)' }}></div>
                      <div className="absolute top-2 left-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#00FF88' }}></div>
                      <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#FF3366' }}></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1" style={{ backgroundColor: '#09090b' }}></div>
                      <div className="flex-1" style={{ backgroundColor: '#18181b' }}></div>
                      <div className="flex-1" style={{ backgroundColor: '#fafafa' }}></div>
                    </>
                  )
                )}
                {t.id === 'midnight' && (
                  visualStyle === 'cyberpunk' ? (
                    <div className="flex-1 flex gap-1 relative p-1" style={{ backgroundColor: '#000000' }}>
                      <div className="flex-1 rounded-sm border border-white/5" style={{ backgroundColor: 'rgba(10, 10, 15, 0.7)' }}></div>
                      <div className="absolute top-2 left-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#00FF88' }}></div>
                      <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#FF3366' }}></div>
                    </div>
                  ) : (
                    <div className="flex-1 bg-black flex gap-1">
                      <div className="flex-1 border-r border-white/5" style={{ backgroundColor: '#000000' }}></div>
                      <div className="flex-1" style={{ backgroundColor: '#ffffff' }}></div>
                    </div>
                  )
                )}
                {t.id === 'system' && (
                  visualStyle === 'cyberpunk' ? (
                    <div className="flex-1 flex relative p-1" style={{ backgroundColor: '#f4f6fa' }}>
                      <div className="flex-1 rounded-sm border border-black/5" style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)' }}></div>
                      <div className="absolute inset-y-0 right-0 left-1/2 flex p-1" style={{ backgroundColor: '#080911', borderLeft: '1px solid #27272a' }}>
                        <div className="flex-1 rounded-sm border border-white/5" style={{ backgroundColor: 'rgba(18, 20, 32, 0.6)' }}></div>
                      </div>
                      <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
                      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FF3366' }}></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1" style={{ backgroundColor: '#ffffff' }}></div>
                      <div className="absolute inset-y-0 right-0 left-1/2 flex">
                        <div className="flex-1" style={{ backgroundColor: '#000000', borderLeft: '1px solid #27272a' }}></div>
                      </div>
                    </>
                  )
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

