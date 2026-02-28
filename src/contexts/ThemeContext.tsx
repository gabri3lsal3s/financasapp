import { createContext, useState, useEffect, ReactNode } from 'react'

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

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  colorPalette: ColorPalette
  setColorPalette: (palette: ColorPalette) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

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
        '--color-bg-primary': '#ffffff',
        '--color-bg-secondary': '#f8f8f8',
        '--color-bg-tertiary': '#e8e8e8',
        '--color-text-primary': '#000000',
        '--color-text-secondary': '#555555',
        '--color-border': '#d0d0d0',
        '--color-primary': '#6b7280',
        '--color-primary-dark': '#1a1a1a',
        '--color-primary-light': '#808080',
        '--color-button-text': '#ffffff',
        '--color-success': '#2d5016',
        '--color-warning': '#5a4a00',
        '--color-danger': '#8b0000',
        '--color-hover': '#f0f0f0',
        '--color-focus': '#b0b0b0',
        '--color-disabled': '#d8d8d8',
        '--color-active': '#e0e0e0',
        '--transition-fast': '200ms',
        '--transition-normal': '300ms',
      },
      'mono-dark': {
        '--color-bg-primary': '#101010',
        '--color-bg-secondary': '#181818',
        '--color-bg-tertiary': '#262626',
        '--color-text-primary': '#eef2f7',
        '--color-text-secondary': '#b3b3b3',
        '--color-border': '#3b3b3b',
        '--color-primary': '#e5e7eb',
        '--color-primary-dark': '#9ca3af',
        '--color-primary-light': '#f9fafb',
        '--color-button-text': '#101010',
        '--color-success': '#86efac',
        '--color-warning': '#facc15',
        '--color-danger': '#f87171',
        '--color-hover': '#2d2d2d',
        '--color-focus': '#5f5f5f',
        '--color-disabled': '#4e4e4e',
        '--color-active': '#353535',
        '--transition-fast': '200ms',
        '--transition-normal': '300ms',
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
    root.style.setProperty('--color-income', paletteVars.income)
    root.style.setProperty('--color-expense', paletteVars.expense)
    root.style.setProperty('--color-balance', paletteVars.balance)
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
