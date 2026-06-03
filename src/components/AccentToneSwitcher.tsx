import { Check } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { useTheme } from '@/hooks/useTheme'
import type { AccentTone } from '@/contexts/ThemeContext'
import { appearanceChoiceClass } from '@/components/appearanceChoice'

const ACCENT_OPTIONS: Array<{
  id: AccentTone
  name: string
  description: string
}> = [
  {
    id: 'none',
    name: 'Sem destaque',
    description: 'Neutro do tema ativo',
  },
  {
    id: 'white',
    name: 'Neutro',
    description: 'Preto no claro · branco no escuro',
  },
  {
    id: 'violet',
    name: 'Violeta',
    description: 'Roxo para navegação e CTAs',
  },
  {
    id: 'blue',
    name: 'Azul',
    description: 'Azul com bom contraste no escuro',
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    description: 'Verde discreto e legível',
  },
  {
    id: 'red',
    name: 'Vermelho',
    description: 'Vermelho de destaque vibrante',
  },
]

function AccentSwatch({ toneId }: { toneId: AccentTone }) {
  if (toneId === 'none') {
    return (
      <div className="appearance-accent-swatch" data-accent-swatch="none" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.35" />
          <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        </svg>
      </div>
    )
  }

  if (toneId === 'white') {
    return (
      <div className="appearance-accent-swatch" data-accent-swatch="white" aria-hidden>
        <span data-tone="dark" />
        <span data-tone="light" />
      </div>
    )
  }

  return <div className="appearance-accent-swatch" data-accent-swatch={toneId} aria-hidden />
}

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

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ACCENT_OPTIONS.map((option) => {
            const selected = accentTone === option.id
            return (
              <Button
                key={option.id}
                type="button"
                variant="outline"
                onClick={() => setAccentTone(option.id)}
                className={appearanceChoiceClass(selected)}
                aria-pressed={selected}
              >
                {selected && (
                  <span className="appearance-choice__check" aria-hidden>
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <AccentSwatch toneId={option.id} />
                <p className="w-full min-w-0 text-sm font-medium text-primary">{option.name}</p>
                <p className="mt-0.5 w-full min-w-0 text-[10px] leading-snug text-secondary">{option.description}</p>
              </Button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
