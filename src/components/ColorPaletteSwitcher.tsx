import { usePaletteColors } from '@/hooks/usePaletteColors'
import type { ColorPalette } from '@/contexts/ThemeContext'
import Card from './Card'
import Button from './Button'
import { cn } from '@/lib/utils'

export default function ColorPaletteSwitcher() {
  const { colorPalette, setColorPalette, colorPalettes } = usePaletteColors()

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-primary mb-1">Dados financeiros</h3>
          <p className="text-secondary text-sm">
            Cores de renda, despesa e saldo em gráficos e listagens
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.entries(colorPalettes) as Array<[ColorPalette, (typeof colorPalettes)[ColorPalette]]>).map(([key, palette]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              onClick={() => setColorPalette(key)}
              className={cn(
                'h-auto w-full flex-col items-stretch p-3 text-left',
                colorPalette === key ? 'nav-item-active' : 'border-glass text-secondary hover:text-primary'
              )}
            >
              <div className="flex gap-2 mb-2">
                {palette.colors.map((color: string, idx: number) => (
                  <div
                    key={idx}
                    className="w-5 h-5 rounded-md"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-primary">{palette.name}</p>
                {colorPalette === key && <span className="text-xs text-secondary">Ativa</span>}
              </div>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}
