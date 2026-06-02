import { useState, useEffect, ReactNode, useCallback } from 'react'
import { ThemeContext } from '@/contexts/themeSharedContext'
import { useAuth } from '@/contexts/AuthContext'

export type Theme = 'light' | 'dark' | 'midnight' | 'system'
export type ColorPalette = 'vivid' | 'monochrome'
export type VisualStyle = 'classic' | 'cyberpunk'

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

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>('vivid')
  const [visualStyle, setVisualStyleState] = useState<VisualStyle>('classic')
  const { user } = useAuth()

  const applyTheme = useCallback((newTheme: Theme, newPalette: ColorPalette, newStyle: VisualStyle) => {
    const root = document.documentElement

    const actualTheme: 'light' | 'dark' | 'midnight' = newTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (newTheme as 'light' | 'dark' | 'midnight')

    root.classList.remove('mono-light', 'mono-dark', 'light', 'dark', 'midnight', 'system', 'cyberpunk')
    root.classList.add(newTheme, actualTheme)

    if (actualTheme === 'midnight') {
      root.classList.add('dark')
    }

    if (newStyle === 'cyberpunk') {
      root.classList.add('cyberpunk')
    }

    root.dataset.colorPalette = newPalette
    root.dataset.visualStyle = newStyle
  }, [])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system', colorPalette, visualStyle)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, colorPalette, visualStyle, applyTheme])

  useEffect(() => {
    const savedUserTheme = localStorage.getItem(`theme_${user?.id}`)
    const savedGlobalTheme = localStorage.getItem('theme')
    const normalizedTheme = normalizeTheme(savedUserTheme ?? savedGlobalTheme)
    const initialTheme: Theme = normalizedTheme ?? 'system'
    const initialPalette: ColorPalette = 'vivid'

    const savedUserStyle = localStorage.getItem(`visualStyle_${user?.id}`)
    const savedGlobalStyle = localStorage.getItem('visualStyle')
    const initialStyle: VisualStyle = (savedUserStyle ?? savedGlobalStyle) === 'cyberpunk' ? 'cyberpunk' : 'classic'

    if (user?.id) {
      if (!savedUserTheme && initialTheme !== 'system') {
        localStorage.setItem(`theme_${user.id}`, initialTheme)
      }
      localStorage.setItem(`colorPalette_${user.id}`, 'vivid')
      if (!savedUserStyle) {
        localStorage.setItem(`visualStyle_${user.id}`, initialStyle)
      }
    } else {
      if (!savedGlobalTheme && initialTheme !== 'system') {
        localStorage.setItem('theme', initialTheme)
      }
      localStorage.setItem('colorPalette', 'vivid')
      if (!savedGlobalStyle) {
        localStorage.setItem('visualStyle', initialStyle)
      }
    }

    setThemeState(initialTheme)
    setColorPaletteState(initialPalette)
    setVisualStyleState(initialStyle)
    applyTheme(initialTheme, initialPalette, initialStyle)
  }, [user?.id, applyTheme])

  const setTheme = (newTheme: Theme) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setThemeState(newTheme)
    applyTheme(newTheme, colorPalette, visualStyle)

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
    applyTheme(theme, newPalette, visualStyle)

    if (user?.id) {
      localStorage.setItem(`colorPalette_${user.id}`, newPalette)
    }
    localStorage.setItem('colorPalette', newPalette)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  const setVisualStyle = (newStyle: VisualStyle) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setVisualStyleState(newStyle)
    applyTheme(theme, colorPalette, newStyle)

    if (user?.id) {
      localStorage.setItem(`visualStyle_${user.id}`, newStyle)
    }
    localStorage.setItem('visualStyle', newStyle)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorPalette, setColorPalette, visualStyle, setVisualStyle }}>
      {children}
    </ThemeContext.Provider>
  )
}
