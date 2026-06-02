import Card from '@/components/Card'
import Button from '@/components/Button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import type { AccentTone } from '@/contexts/ThemeContext'

const ACCENT_OPTIONS: Array<{
  id: AccentTone
  name: string
  description: string
  swatchVar: string
}> = [
  {
    id: 'white',
    name: 'Neutro',
    description: 'Preto no Glass Claro · branco no escuro',
    swatchVar: '--accent-tone-preview-black',
  },
  {
    id: 'violet',
    name: 'Violeta',
    description: 'Destaque roxo para navegação e CTAs',
    swatchVar: '--accent-tone-preview-violet',
  },
  {
    id: 'blue',
    name: 'Azul',
    description: 'Destaque azul suave',
    swatchVar: '--accent-tone-preview-blue',
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    description: 'Destaque verde discreto',
    swatchVar: '--accent-tone-preview-emerald',
  },
]

export default function AccentToneSwitcher() {
  const { accentTone, setAccentTone } = useTheme()

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="mb-1 text-lg font-semibold text-primary">Cor de destaque</h3>
          <p className="text-sm text-secondary">
            Define a cor de navegação, botões principais e foco. Os valores financeiros (renda, despesa) não mudam.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACCENT_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              onClick={() => setAccentTone(option.id)}
              className={cn(
                'h-auto flex-col items-stretch p-3 text-left',
                accentTone === option.id ? 'nav-item-active' : 'border-glass text-secondary hover:text-primary'
              )}
            >
              {option.id === 'white' ? (
                <div className="mb-2 flex h-6 w-10 gap-0.5 overflow-hidden rounded-full border border-glass" aria-hidden>
                  <span className="h-full flex-1" style={{ backgroundColor: 'var(--accent-tone-preview-black)' }} />
                  <span className="h-full flex-1" style={{ backgroundColor: 'var(--accent-tone-preview-white)' }} />
                </div>
              ) : (
                <div
                  className="mb-2 h-6 w-6 rounded-full border border-glass"
                  style={{ backgroundColor: `var(${option.swatchVar})` }}
                  aria-hidden
                />
              )}
              <p className="text-sm font-medium text-primary">{option.name}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-secondary">{option.description}</p>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}
