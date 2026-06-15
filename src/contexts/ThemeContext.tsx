import { useState, useEffect, ReactNode, useCallback } from 'react'
import { ThemeContext } from '@/contexts/themeSharedContext'
import { useAuth } from '@/contexts/AuthContext'
import { calculateSunriseSunset } from '@/utils/solar'

export type Theme = 'light' | 'dark' | 'midnight' | 'system' | 'auto'
export type ColorPalette = 'vivid' | 'monochrome'
/** Cor de destaque da UI (navegação, botões primários, anéis de foco) */
export type AccentTone = 'white' | 'violet' | 'blue' | 'emerald' | 'red'

const VALID_ACCENT_TONES: AccentTone[] = ['white', 'violet', 'blue', 'emerald', 'red']

const VALID_THEMES: Theme[] = ['light', 'dark', 'midnight', 'system', 'auto']

const getAutoThemeMode = (
  lat: number | null,
  lng: number | null,
  darkPref: 'dark' | 'midnight'
): 'light' | 'dark' | 'midnight' => {
  const now = new Date()
  let isNight = false

  if (lat !== null && lng !== null) {
    const { sunrise, sunset } = calculateSunriseSunset(lat, lng, now)
    if (sunrise && sunset) {
      isNight = now < sunrise || now > sunset
    } else {
      const hour = now.getHours()
      isNight = hour < 6 || hour >= 18
    }
  } else {
    const hour = now.getHours()
    isNight = hour < 6 || hour >= 18
  }

  return isNight ? darkPref : 'light'
}
const LEGACY_THEME_MAP: Record<string, Theme> = {
  'mono-light': 'light',
  'mono-dark': 'dark',
}

const isTheme = (value: string | null): value is Theme => {
  return value !== null && VALID_THEMES.includes(value as Theme)
}

const normalizeTheme = (value: string | null): Theme | null => {
  if (!value) return null
  if (isTheme(value)) return value
  return LEGACY_THEME_MAP[value] ?? null
}

interface ThemeProviderProps {
  children: ReactNode
}

function migrateLegacyVisualStyle(userId?: string) {
  const savedUserStyle = userId ? localStorage.getItem(`visualStyle_${userId}`) : null
  const savedGlobalStyle = localStorage.getItem('visualStyle')
  const wasCyberpunk = (savedUserStyle ?? savedGlobalStyle) === 'cyberpunk'

  if (!wasCyberpunk) return

  if (userId) {
    localStorage.removeItem(`visualStyle_${userId}`)
    localStorage.setItem(`colorPalette_${userId}`, 'vivid')
    const savedTheme = localStorage.getItem(`theme_${userId}`)
    if (!savedTheme || savedTheme === 'system' || savedTheme === 'light') {
      localStorage.setItem(`theme_${userId}`, 'dark')
    }
  }

  localStorage.removeItem('visualStyle')
  localStorage.setItem('colorPalette', 'vivid')
  const savedGlobalTheme = localStorage.getItem('theme')
  if (!savedGlobalTheme || savedGlobalTheme === 'system' || savedGlobalTheme === 'light') {
    localStorage.setItem('theme', 'dark')
  }
}

const isAccentTone = (value: string | null): value is AccentTone =>
  value !== null && VALID_ACCENT_TONES.includes(value as AccentTone)

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>('vivid')
  const [accentTone, setAccentToneState] = useState<AccentTone>('white')
  
  // Estados para Tema Automático por Horário
  const [autoDarkPreference, setAutoDarkPreferenceState] = useState<'dark' | 'midnight'>('dark')
  const [latitude, setLatitudeState] = useState<number | null>(null)
  const [longitude, setLongitudeState] = useState<number | null>(null)
  const { user } = useAuth()

  const applyTheme = useCallback((
    newTheme: Theme,
    newPalette: ColorPalette,
    newAccent: AccentTone,
    currentLat: number | null,
    currentLng: number | null,
    currentDarkPref: 'dark' | 'midnight'
  ) => {
    const root = document.documentElement

    let actualTheme: 'light' | 'dark' | 'midnight'
    if (newTheme === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } else if (newTheme === 'auto') {
      actualTheme = getAutoThemeMode(currentLat, currentLng, currentDarkPref)
    } else {
      actualTheme = newTheme as 'light' | 'dark' | 'midnight'
    }

    root.classList.remove('mono-light', 'mono-dark', 'light', 'dark', 'midnight', 'system', 'cyberpunk', 'auto')
    root.classList.add(newTheme, actualTheme)

    if (actualTheme === 'midnight') {
      root.classList.add('dark')
    }

    root.dataset.colorPalette = newPalette
    root.dataset.accentTone = newAccent
    delete root.dataset.visualStyle
  }, [])

  // Listener para tema de sistema
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system', colorPalette, accentTone, latitude, longitude, autoDarkPreference)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, colorPalette, accentTone, latitude, longitude, autoDarkPreference, applyTheme])

  // Verificador periódico para transições do tema automático
  useEffect(() => {
    if (theme !== 'auto') return

    const checkTime = () => {
      applyTheme('auto', colorPalette, accentTone, latitude, longitude, autoDarkPreference)
    }

    checkTime()
    const interval = setInterval(checkTime, 60000) // atualiza a cada minuto
    return () => clearInterval(interval)
  }, [theme, colorPalette, accentTone, latitude, longitude, autoDarkPreference, applyTheme])

  // Carregamento de preferências iniciais
  useEffect(() => {
    migrateLegacyVisualStyle(user?.id)

    const savedUserTheme = localStorage.getItem(`theme_${user?.id}`)
    const savedGlobalTheme = localStorage.getItem('theme')
    const normalizedTheme = normalizeTheme(savedUserTheme ?? savedGlobalTheme)
    const initialTheme: Theme = normalizedTheme ?? 'system'

    const savedUserPalette = localStorage.getItem(`colorPalette_${user?.id}`)
    const savedGlobalPalette = localStorage.getItem('colorPalette')
    const initialPalette: ColorPalette =
      savedUserPalette === 'monochrome' || savedGlobalPalette === 'monochrome' ? 'monochrome' : 'vivid'

    const savedUserAccent = localStorage.getItem(`accentTone_${user?.id}`)
    const savedGlobalAccent = localStorage.getItem('accentTone')
    const normalizedAccent = isAccentTone(savedUserAccent)
      ? savedUserAccent
      : isAccentTone(savedGlobalAccent)
        ? savedGlobalAccent
        : 'white'

    // Carregar configurações de tema automático
    const savedUserAutoDarkPref = localStorage.getItem(`autoDarkPref_${user?.id}`)
    const savedGlobalAutoDarkPref = localStorage.getItem('autoDarkPref')
    const initialAutoDarkPref: 'dark' | 'midnight' =
      savedUserAutoDarkPref === 'midnight' || savedGlobalAutoDarkPref === 'midnight' ? 'midnight' : 'dark'

    const savedUserLat = localStorage.getItem(`themeLatitude_${user?.id}`)
    const savedGlobalLat = localStorage.getItem('themeLatitude')
    const initialLat = savedUserLat ? parseFloat(savedUserLat) : savedGlobalLat ? parseFloat(savedGlobalLat) : null

    const savedUserLng = localStorage.getItem(`themeLongitude_${user?.id}`)
    const savedGlobalLng = localStorage.getItem('themeLongitude')
    const initialLng = savedUserLng ? parseFloat(savedUserLng) : savedGlobalLng ? parseFloat(savedGlobalLng) : null

    if (user?.id) {
      if (!savedUserTheme && initialTheme !== 'system') {
        localStorage.setItem(`theme_${user.id}`, initialTheme)
      }
      localStorage.setItem(`colorPalette_${user.id}`, initialPalette)
      localStorage.setItem(`accentTone_${user.id}`, normalizedAccent)
      localStorage.setItem(`autoDarkPref_${user.id}`, initialAutoDarkPref)
      if (initialLat !== null) localStorage.setItem(`themeLatitude_${user.id}`, String(initialLat))
      if (initialLng !== null) localStorage.setItem(`themeLongitude_${user.id}`, String(initialLng))
    } else {
      if (!savedGlobalTheme && initialTheme !== 'system') {
        localStorage.setItem('theme', initialTheme)
      }
      localStorage.setItem('colorPalette', initialPalette)
      localStorage.setItem('accentTone', normalizedAccent)
      localStorage.setItem('autoDarkPref', initialAutoDarkPref)
      if (initialLat !== null) localStorage.setItem('themeLatitude', String(initialLat))
      if (initialLng !== null) localStorage.setItem('themeLongitude', String(initialLng))
    }

    setThemeState(initialTheme)
    setColorPaletteState(initialPalette)
    setAccentToneState(normalizedAccent)
    setAutoDarkPreferenceState(initialAutoDarkPref)
    setLatitudeState(initialLat)
    setLongitudeState(initialLng)

    applyTheme(initialTheme, initialPalette, normalizedAccent, initialLat, initialLng, initialAutoDarkPref)
  }, [user?.id, applyTheme])

  const setTheme = (newTheme: Theme) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setThemeState(newTheme)
    applyTheme(newTheme, colorPalette, accentTone, latitude, longitude, autoDarkPreference)

    if (user?.id) {
      localStorage.setItem(`theme_${user.id}`, newTheme)
    }
    localStorage.setItem('theme', newTheme)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  const setColorPalette = (newPalette: ColorPalette) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setColorPaletteState(newPalette)
    applyTheme(theme, newPalette, accentTone, latitude, longitude, autoDarkPreference)

    if (user?.id) {
      localStorage.setItem(`colorPalette_${user.id}`, newPalette)
    }
    localStorage.setItem('colorPalette', newPalette)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  const setAccentTone = (newAccent: AccentTone) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setAccentToneState(newAccent)
    applyTheme(theme, colorPalette, newAccent, latitude, longitude, autoDarkPreference)

    if (user?.id) {
      localStorage.setItem(`accentTone_${user.id}`, newAccent)
    }
    localStorage.setItem('accentTone', newAccent)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  const setAutoDarkPreference = (newPref: 'dark' | 'midnight') => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setAutoDarkPreferenceState(newPref)
    applyTheme(theme, colorPalette, accentTone, latitude, longitude, newPref)

    if (user?.id) {
      localStorage.setItem(`autoDarkPref_${user.id}`, newPref)
    }
    localStorage.setItem('autoDarkPref', newPref)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  const setLocation = (lat: number | null, lng: number | null) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setLatitudeState(lat)
    setLongitudeState(lng)
    applyTheme(theme, colorPalette, accentTone, lat, lng, autoDarkPreference)

    if (user?.id) {
      if (lat !== null) {
        localStorage.setItem(`themeLatitude_${user.id}`, String(lat))
      } else {
        localStorage.removeItem(`themeLatitude_${user.id}`)
      }
      if (lng !== null) {
        localStorage.setItem(`themeLongitude_${user.id}`, String(lng))
      } else {
        localStorage.removeItem(`themeLongitude_${user.id}`)
      }
    } else {
      if (lat !== null) {
        localStorage.setItem('themeLatitude', String(lat))
      } else {
        localStorage.removeItem('themeLatitude')
      }
      if (lng !== null) {
        localStorage.setItem('themeLongitude', String(lng))
      } else {
        localStorage.removeItem('themeLongitude')
      }
    }

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        colorPalette,
        setColorPalette,
        accentTone,
        setAccentTone,
        autoDarkPreference,
        setAutoDarkPreference,
        latitude,
        longitude,
        setLocation,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
