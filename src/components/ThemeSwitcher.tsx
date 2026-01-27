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
          <Palette size={24} className="text-[var(--color-primary)]" />
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Aparência</h2>
        </div>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6">Escolha um tema para personalizar a aparência do app</p>
      </div>

      {/* Grid de temas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {themes.map((t) => (
          <Card
            key={t.id}
            className={`cursor-pointer transition-all ${
              theme === t.id
                ? 'ring-2 ring-[var(--color-primary)] shadow-lg'
                : 'hover:shadow-md'
            }`}
            onClick={() => setTheme(t.id)}
          >
            {/* Preview de cor */}
            <div className="mb-4 h-24 rounded-lg flex gap-1 overflow-hidden">
              {t.id === 'mono-light' && (
                <>
                  <div className="flex-1 bg-white border border-gray-300"></div>
                  <div className="flex-1 bg-gray-100"></div>
                  <div className="flex-1 bg-gray-500"></div>
                </>
              )}
              {t.id === 'mono-dark' && (
                <>
                  <div className="flex-1 bg-gray-950 border border-gray-700"></div>
                  <div className="flex-1 bg-gray-800"></div>
                  <div className="flex-1 bg-gray-400"></div>
                </>
              )}
            </div>

            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)]">{t.name}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t.description}</p>
              </div>
              {theme === t.id && (
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
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
