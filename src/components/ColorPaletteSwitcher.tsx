import { usePaletteColors } from '@/hooks/usePaletteColors'
import Card from './Card'

export default function ColorPaletteSwitcher() {
  const { colorPalette, setColorPalette, colorPalettes } = usePaletteColors()

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-primary mb-1">Paleta de Cores</h3>
          <p className="text-secondary text-sm">
            Escolha a paleta de cores para elementos da interface
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(Object.entries(colorPalettes) as Array<[string, any]>).map(([key, palette]) => (
            <button
              key={key}
              onClick={() => setColorPalette(key as any)}
              className={`p-4 rounded-lg border-2 motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
                colorPalette === key
                  ? 'border-[var(--color-primary)] bg-tertiary'
                  : 'border-primary bg-secondary hover:border-[var(--color-focus)]'
              }`}
            >
              <div className="flex gap-2 mb-2">
                {palette.colors.map((color: string, idx: number) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-md"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="text-sm font-medium text-primary">{palette.name}</p>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
