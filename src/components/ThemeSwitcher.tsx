import { useTheme, type Theme } from '@/hooks/useTheme'
import { Check, Palette } from 'lucide-react'
import Card from './Card'
import Button from './Button'
import { appearanceChoiceClass } from '@/components/appearanceChoice'

const THEME_PREVIEW_LABELS = {
  bg: 'Fundo',
  surface: 'Superfície',
  accent: 'Destaque',
} as const

function ThemeModePreview({ themeId }: { themeId: Theme }) {
  if (themeId === 'system') {
    return (
      <div className="appearance-choice__preview" aria-hidden>
        <div className="appearance-theme-preview appearance-theme-preview--system" data-preview="system">
          <div className="appearance-theme-preview__half" data-half="light">
            <span data-chip="bg" title={THEME_PREVIEW_LABELS.bg} />
            <span data-chip="surface" title={THEME_PREVIEW_LABELS.surface} />
            <span data-chip="accent" title={THEME_PREVIEW_LABELS.accent} />
          </div>
          <div className="appearance-theme-preview__half" data-half="dark">
            <span data-chip="bg" title={THEME_PREVIEW_LABELS.bg} />
            <span data-chip="surface" title={THEME_PREVIEW_LABELS.surface} />
            <span data-chip="accent" title={THEME_PREVIEW_LABELS.accent} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="appearance-choice__preview" aria-hidden>
      <div className="appearance-theme-preview" data-preview={themeId}>
        <span data-chip="bg" title={THEME_PREVIEW_LABELS.bg} />
        <span data-chip="surface" title={THEME_PREVIEW_LABELS.surface} />
        <span data-chip="accent" title={THEME_PREVIEW_LABELS.accent} />
      </div>
    </div>
  )
}

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  const themes: Array<{ id: Theme; name: string; description: string }> = [
    {
      id: 'light',
      name: 'Claro',
      description: 'Superfícies translúcidas com acentos suaves',
    },
    {
      id: 'dark',
      name: 'Escuro',
      description: 'Fundo escuro com vidro e destaque neutro',
    },
    {
      id: 'midnight',
      name: 'Midnight',
      description: 'Contraste OLED com vidro profundo',
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
          <div className="mb-1 flex items-center gap-2">
            <Palette size={18} className="accent-primary shrink-0" />
            <h3 className="text-lg font-semibold text-primary">Tema de Cores</h3>
          </div>
          <p className="text-sm text-secondary">Escolha o modo de visualização do app</p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {themes.map((t) => {
            const selected = theme === t.id
            return (
              <Button
                key={t.id}
                type="button"
                variant="outline"
                onClick={() => setTheme(t.id)}
                className={appearanceChoiceClass(selected)}
                aria-pressed={selected}
              >
                {selected && (
                  <span className="appearance-choice__check" aria-hidden>
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <ThemeModePreview themeId={t.id} />
                <div className="flex w-full min-w-0 flex-col gap-0.5">
                  <p className="text-[13px] font-semibold leading-tight text-primary">{t.name}</p>
                  <p className="line-clamp-2 text-[10px] leading-snug text-secondary">{t.description}</p>
                </div>
              </Button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
