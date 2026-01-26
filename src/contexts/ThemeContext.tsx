import { createContext, useState, useEffect, ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'mono-light' | 'mono-dark'
export type ColorPalette = 'vivid' | 'pastel' | 'earth' | 'ocean' | 'sunset'

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
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const savedPalette = localStorage.getItem('colorPalette') as ColorPalette | null
    
    const initialTheme: Theme = savedTheme || 'mono-dark'
    const initialPalette: ColorPalette = savedPalette || 'vivid'
    setThemeState(initialTheme)
    setColorPaletteState(initialPalette)
    applyTheme(initialTheme, initialPalette)
  }, [])

  // Aplicar tema ao documento
  const applyTheme = (newTheme: Theme, newPalette: ColorPalette) => {
    const root = document.documentElement
    
    // Remover todas as classes de tema
    root.classList.remove('light', 'dark', 'mono-light', 'mono-dark')
    
    // Adicionar nova classe
    root.classList.add(newTheme)
    
    // Paletas de cores para elementos
    const colorPalettes: Record<ColorPalette, { income: string; expense: string; balance: string }> = {
      vivid: {
        income: '#10b981',
        expense: '#ef4444',
        balance: '#3b82f6',
      },
      pastel: {
        income: '#86efac',
        expense: '#fca5a5',
        balance: '#93c5fd',
      },
      earth: {
        income: '#92400e',
        expense: '#7c2d12',
        balance: '#8b5cf6',
      },
      ocean: {
        income: '#0369a1',
        expense: '#06b6d4',
        balance: '#0ea5e9',
      },
      sunset: {
        income: '#d97706',
        expense: '#dc2626',
        balance: '#f59e0b',
      },
    }

    // Aplicar variáveis CSS
    const themes: Record<Theme, Record<string, string>> = {
      light: {
        '--color-bg-primary': '#ffffff',
        '--color-bg-secondary': '#f3f4f6',
        '--color-bg-tertiary': '#e5e7eb',
        '--color-text-primary': '#1f2937',
        '--color-text-secondary': '#6b7280',
        '--color-border': '#e5e7eb',
        '--color-primary': '#0ea5e9',
        '--color-primary-dark': '#0284c7',
        '--color-primary-light': '#bae6fd',
        '--color-success': '#10b981',
        '--color-warning': '#f59e0b',
        '--color-danger': '#ef4444',
      },
      dark: {
        '--color-bg-primary': '#111827',
        '--color-bg-secondary': '#1f2937',
        '--color-bg-tertiary': '#374151',
        '--color-text-primary': '#f3f4f6',
        '--color-text-secondary': '#9ca3af',
        '--color-border': '#374151',
        '--color-primary': '#38bdf8',
        '--color-primary-dark': '#06b6d4',
        '--color-primary-light': '#0ea5e9',
        '--color-success': '#10b981',
        '--color-warning': '#f59e0b',
        '--color-danger': '#ef4444',
      },
      'mono-light': {
        '--color-bg-primary': '#ffffff',
        '--color-bg-secondary': '#f8f8f8',
        '--color-bg-tertiary': '#e8e8e8',
        '--color-text-primary': '#000000',
        '--color-text-secondary': '#555555',
        '--color-border': '#d0d0d0',
        '--color-primary': '#404040',
        '--color-primary-dark': '#1a1a1a',
        '--color-primary-light': '#808080',
        '--color-success': '#2d5016',
        '--color-warning': '#5a4a00',
        '--color-danger': '#8b0000',
      },
      'mono-dark': {
        '--color-bg-primary': '#0f0f0f',
        '--color-bg-secondary': '#1a1a1a',
        '--color-bg-tertiary': '#3a3a3a',
        '--color-text-primary': '#ffffff',
        '--color-text-secondary': '#b0b0b0',
        '--color-border': '#404040',
        '--color-primary': '#808080',
        '--color-primary-dark': '#505050',
        '--color-primary-light': '#a0a0a0',
        '--color-success': '#90ee90',
        '--color-warning': '#ffd700',
        '--color-danger': '#ff6b6b',
      },
    }

    const themeVars = themes[newTheme]
    const paletteVars = colorPalettes[newPalette]
    
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
