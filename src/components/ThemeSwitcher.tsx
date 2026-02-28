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
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Palette size={24} className="accent-primary" />
          <h2 className="text-xl font-semibold text-primary">Aparência</h2>
        </div>
        <p className="text-secondary text-sm mb-6">Escolha um tema para personalizar a aparência do app</p>
      </div>

      {/* Grid de temas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {themes.map((t) => (
          <Card
            key={t.id}
            className={`cursor-pointer transition-all ${
              theme === t.id
                ? 'ring-2 ring-[var(--color-primary)] bg-tertiary shadow-lg'
                : 'hover:shadow-md'
            }`}
            onClick={() => setTheme(t.id)}
          >
            {/* Preview de cor */}
            <div className="mb-4 h-24 rounded-lg flex gap-1 overflow-hidden">
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

            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-primary">{t.name}</h3>
                <p className="text-sm text-secondary mt-1">{t.description}</p>
              </div>
              {theme === t.id && (
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-[var(--color-button-text)] rounded-full"></div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

    </div>
  )
}
