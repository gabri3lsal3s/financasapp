import { useState, useEffect, ReactNode, useCallback } from 'react'
import { ThemeContext } from '@/contexts/themeSharedContext'
import { useAuth } from '@/contexts/AuthContext'

export type Theme = 'light' | 'dark' | 'midnight' | 'system'
export type ColorPalette = 'vivid' | 'monochrome'
/** Cor de destaque da UI (navegação, botões primários, anéis de foco) */
export type AccentTone = 'none' | 'white' | 'violet' | 'blue' | 'emerald' | 'red'

const VALID_ACCENT_TONES: AccentTone[] = ['none', 'white', 'violet', 'blue', 'emerald', 'red']

const VALID_THEMES: Theme[] = ['light', 'dark', 'midnight', 'system']
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
  const { user } = useAuth()

  const applyTheme = useCallback((newTheme: Theme, newPalette: ColorPalette, newAccent: AccentTone) => {
    const root = document.documentElement

    const actualTheme: 'light' | 'dark' | 'midnight' = newTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (newTheme as 'light' | 'dark' | 'midnight')

    root.classList.remove('mono-light', 'mono-dark', 'light', 'dark', 'midnight', 'system', 'cyberpunk')
    root.classList.add(newTheme, actualTheme)

    if (actualTheme === 'midnight') {
      root.classList.add('dark')
    }

    root.dataset.colorPalette = newPalette
    root.dataset.accentTone = newAccent
    delete root.dataset.visualStyle
  }, [])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system', colorPalette, accentTone)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, colorPalette, accentTone, applyTheme])

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

    if (user?.id) {
      if (!savedUserTheme && initialTheme !== 'system') {
        localStorage.setItem(`theme_${user.id}`, initialTheme)
      }
      localStorage.setItem(`colorPalette_${user.id}`, initialPalette)
      localStorage.setItem(`accentTone_${user.id}`, normalizedAccent)
    } else {
      if (!savedGlobalTheme && initialTheme !== 'system') {
        localStorage.setItem('theme', initialTheme)
      }
      localStorage.setItem('colorPalette', initialPalette)
      localStorage.setItem('accentTone', normalizedAccent)
    }

    setThemeState(initialTheme)
    setColorPaletteState(initialPalette)
    setAccentToneState(normalizedAccent)
    applyTheme(initialTheme, initialPalette, normalizedAccent)
  }, [user?.id, applyTheme])

  const setTheme = (newTheme: Theme) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setThemeState(newTheme)
    applyTheme(newTheme, colorPalette, accentTone)

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
    applyTheme(theme, newPalette, accentTone)

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
    applyTheme(theme, colorPalette, newAccent)

    if (user?.id) {
      localStorage.setItem(`accentTone_${user.id}`, newAccent)
    }
    localStorage.setItem('accentTone', newAccent)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, colorPalette, setColorPalette, accentTone, setAccentTone }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
