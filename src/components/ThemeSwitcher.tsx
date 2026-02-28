import { useTheme, type Theme } from '@/hooks/useTheme'
import { Palette } from 'lucide-react'
import Card from './Card'

const themes: Array<{ id: Theme; name: string; description: string }> = [
  { id: 'mono-light', name: 'Monocromático Claro', description: 'Tons de cinza com contraste' },
  { id: 'mono-dark', name: 'Monocromático Escuro', description: 'Escala de cinza profunda' },
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-3 rounded-lg border-2 motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] text-left ${
                theme === t.id
                  ? 'border-[var(--color-primary)] bg-tertiary'
                  : 'border-primary bg-secondary hover:border-[var(--color-focus)]'
              }`}
            >
              <div className="mb-3 h-14 rounded-md flex gap-1 overflow-hidden">
                {t.id === 'mono-light' && (
                  <>
                    <div className="flex-1" style={{ backgroundColor: '#ffffff', border: '1px solid #d0d0d0' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#f8f8f8' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#808080' }}></div>
                  </>
                )}
                {t.id === 'mono-dark' && (
                  <>
                    <div className="flex-1" style={{ backgroundColor: '#101010', border: '1px solid #3b3b3b' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#181818' }}></div>
                    <div className="flex-1" style={{ backgroundColor: '#b3b3b3' }}></div>
                  </>
                )}
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-primary">{t.name}</p>
                  <p className="text-xs text-secondary mt-1">{t.description}</p>
                </div>
                {theme === t.id && <span className="text-xs text-secondary">Ativo</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
