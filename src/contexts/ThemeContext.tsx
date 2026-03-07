import { useState, useEffect, ReactNode } from 'react'
import { ThemeContext } from '@/contexts/themeSharedContext'

export type Theme = 'mono-light' | 'mono-dark'
export type ColorPalette = 'vivid' | 'monochrome'

const VALID_THEMES: Theme[] = ['mono-light', 'mono-dark']
const VALID_PALETTES: ColorPalette[] = ['vivid', 'monochrome']

const LEGACY_PALETTE_MAP: Record<string, ColorPalette> = {
  sunset: 'monochrome',
  ocean: 'vivid',
  'neon-green': 'vivid',
}

const isTheme = (value: string | null): value is Theme => {
  return value !== null && VALID_THEMES.includes(value as Theme)
}

const isColorPalette = (value: string | null): value is ColorPalette => {
  return value !== null && VALID_PALETTES.includes(value as ColorPalette)
}

const normalizePalette = (value: string | null): ColorPalette | null => {
  if (!value) {
    return null
  }

  if (isColorPalette(value)) {
    return value
  }

  return LEGACY_PALETTE_MAP[value] ?? null
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('mono-dark')
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>('vivid')

  // Carregar tema e paleta do localStorage ao montar
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const savedPalette = localStorage.getItem('colorPalette')

    const hasValidTheme = isTheme(savedTheme)
    const normalizedPalette = normalizePalette(savedPalette)
    const hasValidPalette = normalizedPalette !== null

    const initialTheme: Theme = hasValidTheme ? savedTheme : 'mono-dark'
    const initialPalette: ColorPalette = hasValidPalette ? normalizedPalette : 'vivid'

    if (!hasValidTheme) {
      localStorage.setItem('theme', initialTheme)
    }

    if (!hasValidPalette) {
      localStorage.setItem('colorPalette', initialPalette)
    }

    setThemeState(initialTheme)
    setColorPaletteState(initialPalette)
    applyTheme(initialTheme, initialPalette)
  }, [])

  // Aplicar tema ao documento
  const applyTheme = (newTheme: Theme, newPalette: ColorPalette) => {
    const root = document.documentElement
    
    // Remover todas as classes de tema
    root.classList.remove('mono-light', 'mono-dark')
    
    // Adicionar nova classe
    root.classList.add(newTheme)
    
    // Paletas de cores para elementos
    const colorPalettes: Record<ColorPalette, { income: string; expense: string; balance: string }> = {
      vivid: {
        income: '#10b981',
        expense: '#ef4444',
        balance: '#3b82f6',
      },
      monochrome: {
        income: '#e5e7eb',
        expense: '#9ca3af',
        balance: '#6b7280',
      },
    }

    // Aplicar variáveis CSS
    const themes: Record<Theme, Record<string, string>> = {
      'mono-light': {
        '--ds-color-surface-primary': '#ffffff',
        '--ds-color-surface-secondary': '#f8f8f8',
        '--ds-color-surface-tertiary': '#e8e8e8',
        '--ds-color-text-primary': '#000000',
        '--ds-color-text-secondary': '#555555',
        '--ds-color-border-default': '#d0d0d0',
        '--ds-color-accent-primary': '#6b7280',
        '--ds-color-accent-primary-strong': '#1a1a1a',
        '--ds-color-accent-primary-soft': '#808080',
        '--ds-color-button-text': '#ffffff',
        '--ds-color-intent-success': '#2d5016',
        '--ds-color-intent-warning': '#5a4a00',
        '--ds-color-intent-danger': '#8b0000',
        '--ds-color-interaction-hover': '#f0f0f0',
        '--ds-color-interaction-focus': '#b0b0b0',
        '--ds-color-interaction-disabled': '#d8d8d8',
        '--ds-color-interaction-active': '#e0e0e0',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      },
      'mono-dark': {
        '--ds-color-surface-primary': '#101010',
        '--ds-color-surface-secondary': '#181818',
        '--ds-color-surface-tertiary': '#262626',
        '--ds-color-text-primary': '#eef2f7',
        '--ds-color-text-secondary': '#b3b3b3',
        '--ds-color-border-default': '#3b3b3b',
        '--ds-color-accent-primary': '#e5e7eb',
        '--ds-color-accent-primary-strong': '#9ca3af',
        '--ds-color-accent-primary-soft': '#f9fafb',
        '--ds-color-button-text': '#101010',
        '--ds-color-intent-success': '#86efac',
        '--ds-color-intent-warning': '#facc15',
        '--ds-color-intent-danger': '#f87171',
        '--ds-color-interaction-hover': '#2d2d2d',
        '--ds-color-interaction-focus': '#5f5f5f',
        '--ds-color-interaction-disabled': '#4e4e4e',
        '--ds-color-interaction-active': '#353535',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      },
    }

    const themeVars = themes[newTheme]
    const paletteVars = colorPalettes[newPalette]

    if (!themeVars || !paletteVars) {
      return
    }
    
    // Aplicar variáveis de tema
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    // Aplicar variáveis de paleta
    root.style.setProperty('--ds-color-data-income', paletteVars.income)
    root.style.setProperty('--ds-color-data-expense', paletteVars.expense)
    root.style.setProperty('--ds-color-data-balance', paletteVars.balance)
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme, colorPalette)
    localStorage.setItem('theme', newTheme)
  }

  const setColorPalette = (newPalette: ColorPalette) => {
    setColorPaletteState(newPalette)
    applyTheme(theme, newPalette)
    localStorage.setItem('colorPalette', newPalette)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorPalette, setColorPalette }}>
      {children}
    </ThemeContext.Provider>
  )
}
