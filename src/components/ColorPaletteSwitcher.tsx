import { Check } from 'lucide-react'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import type { ColorPalette } from '@/contexts/ThemeContext'
import Card from './Card'
import Button from './Button'
import { appearanceChoiceClass } from '@/components/appearanceChoice'

const PALETTE_LABELS: Record<ColorPalette, { income: string; expense: string; balance: string }> = {
  vivid: { income: 'Renda', expense: 'Despesa', balance: 'Saldo' },
  monochrome: { income: 'Claro', expense: 'Médio', balance: 'Escuro' },
}

export default function ColorPaletteSwitcher() {
  const { colorPalette, setColorPalette, colorPalettes } = usePaletteColors()

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="mb-1 text-lg font-semibold text-primary">Dados financeiros</h3>
          <p className="text-sm text-secondary">
            Cores de renda, despesa e saldo em gráficos e listagens
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          {(Object.entries(colorPalettes) as Array<[ColorPalette, (typeof colorPalettes)[ColorPalette]]>).map(
            ([key, palette]) => {
              const selected = colorPalette === key
              const labels = PALETTE_LABELS[key]
              return (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  onClick={() => setColorPalette(key)}
                  className={appearanceChoiceClass(selected)}
                  aria-pressed={selected}
                >
                  {selected && (
                    <span className="appearance-choice__check" aria-hidden>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                  <div className="appearance-choice__preview mb-0 flex h-auto min-h-[3.5rem] flex-col gap-1 border-0 p-0">
                    <div className="appearance-palette-preview min-h-[2.75rem]" data-palette-preview={key}>
                      <span data-chip="0" aria-hidden />
                      <span data-chip="1" aria-hidden />
                      <span data-chip="2" aria-hidden />
                    </div>
                    <div className="flex gap-1.5 px-1 pb-0.5">
                      <span className="flex-1 truncate text-center text-[9px] font-medium uppercase tracking-wide text-secondary">
                        {labels.income}
                      </span>
                      <span className="flex-1 truncate text-center text-[9px] font-medium uppercase tracking-wide text-secondary">
                        {labels.expense}
                      </span>
                      <span className="flex-1 truncate text-center text-[9px] font-medium uppercase tracking-wide text-secondary">
                        {labels.balance}
                      </span>
                    </div>
                  </div>
                  <p className="w-full min-w-0 text-sm font-medium text-primary">{palette.name}</p>
                </Button>
              )
            },
          )}
        </div>
      </div>
    </Card>
  )
}
