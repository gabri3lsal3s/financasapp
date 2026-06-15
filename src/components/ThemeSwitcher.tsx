import { useState } from 'react'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { Check, Palette, MapPin, Loader2, Sun, Moon } from 'lucide-react'
import Card from './Card'
import Button from './Button'
import { appearanceChoiceClass } from '@/components/appearanceChoice'
import { calculateSunriseSunset, formatCoordinate } from '@/utils/solar'

const THEME_PREVIEW_LABELS = {
  bg: 'Fundo',
  surface: 'Superfície',
  accent: 'Destaque',
} as const

function ThemeModePreview({ themeId }: { themeId: Theme }) {
  if (themeId === 'system' || themeId === 'auto') {
    return (
      <div className="appearance-choice__preview" aria-hidden>
        <div className="appearance-theme-preview appearance-theme-preview--system" data-preview={themeId}>
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
  const {
    theme,
    setTheme,
    autoDarkPreference,
    setAutoDarkPreference,
    latitude,
    longitude,
    setLocation,
  } = useTheme()

  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocalização não é suportada pelo seu navegador.')
      return
    }

    setLocLoading(true)
    setLocError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords.latitude, position.coords.longitude)
        setLocLoading(false)
      },
      (error) => {
        console.error('Error getting location:', error)
        let msg = 'Não foi possível obter sua localização.'
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permissão de localização negada pelo navegador.'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Informações de localização indisponíveis.'
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tempo limite esgotado ao obter localização.'
        }
        setLocError(msg)
        setLocLoading(false)
      },
      { timeout: 10000 }
    )
  }

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
    {
      id: 'auto',
      name: 'Automático',
      description: 'Transição baseada no sol da sua região',
    },
  ]

  let sunriseStr = '--:--'
  let sunsetStr = '--:--'
  if (latitude !== null && longitude !== null) {
    const { sunrise, sunset } = calculateSunriseSunset(latitude, longitude, new Date())
    if (sunrise && sunset) {
      sunriseStr = sunrise.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      sunsetStr = sunset.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    }
  }

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

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
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

        {theme === 'auto' && (
          <div className="mt-4 pt-4 border-t border-primary space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <h4 className="text-sm font-semibold text-primary">Configuração do Tema Automático</h4>
              <p className="text-xs text-secondary mt-0.5">
                Escolha o tema noturno e ative a localização para calcular o pôr do sol local.
              </p>
            </div>

            {/* Preferência do Tema Noturno */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <span className="text-[13px] font-medium text-primary flex items-center gap-1.5">
                  <Moon size={14} className="text-secondary" /> Tema Noturno
                </span>
                <p className="text-[11px] text-secondary">
                  Tema aplicado entre o pôr e o nascer do sol.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={autoDarkPreference === 'dark' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setAutoDarkPreference('dark')}
                  className="px-3"
                >
                  Escuro (Dark)
                </Button>
                <Button
                  type="button"
                  variant={autoDarkPreference === 'midnight' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setAutoDarkPreference('midnight')}
                  className="px-3"
                >
                  Midnight
                </Button>
              </div>
            </div>

            {/* Localização / Sol */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2 border-t border-primary/50">
              <div className="space-y-1">
                <span className="text-[13px] font-medium text-primary flex items-center gap-1.5">
                  <MapPin size={14} className="text-secondary" /> Localização & Sol
                </span>
                {latitude !== null && longitude !== null ? (
                  <div className="text-xs space-y-1">
                    <p className="text-primary font-medium">
                      Coordenadas: {formatCoordinate(latitude)}° N/S, {formatCoordinate(longitude)}° E/O
                    </p>
                    <div className="flex gap-4 mt-1 text-secondary">
                      <span className="flex items-center gap-1"><Sun size={12} className="text-[var(--color-warning)]" /> Nascer: <strong className="text-primary">{sunriseStr}</strong></span>
                      <span className="flex items-center gap-1"><Moon size={12} className="text-[var(--color-primary)]" /> Pôr: <strong className="text-primary">{sunsetStr}</strong></span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-secondary">
                    Localização pendente. Usando horário de fallback padrão (06:00 às 18:00).
                  </p>
                )}
                {locError && <p className="text-xs text-expense font-medium">{locError}</p>}
              </div>

              <div className="flex gap-2 self-end sm:self-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDetectLocation}
                  disabled={locLoading}
                  className="gap-1.5"
                >
                  {locLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <MapPin size={12} />
                  )}
                  {latitude !== null && longitude !== null ? 'Atualizar Localização' : 'Detectar Localização'}
                </Button>

                {latitude !== null && longitude !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation(null, null)}
                    className="text-expense border border-transparent hover:bg-expense/10 hover:border-expense/25"
                  >
                    Resetar
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
