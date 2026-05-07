import { useState, useEffect, ReactNode, useCallback } from 'react'
import { ThemeContext } from '@/contexts/themeSharedContext'
import { useAuth } from '@/contexts/AuthContext'

export type Theme = 'light' | 'dark' | 'midnight' | 'system'
export type ColorPalette = 'vivid' | 'monochrome'

const VALID_THEMES: Theme[] = ['light', 'dark', 'midnight', 'system']
const VALID_PALETTES: ColorPalette[] = ['vivid', 'monochrome']

const LEGACY_PALETTE_MAP: Record<string, ColorPalette> = {
  sunset: 'monochrome',
  ocean: 'vivid',
  'neon-green': 'vivid',
}

const LEGACY_THEME_MAP: Record<string, Theme> = {
  'mono-light': 'light',
  'mono-dark': 'dark',
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
  const { user } = useAuth()

  // Aplicar tema ao documento
  const applyTheme = useCallback((newTheme: Theme, newPalette: ColorPalette) => {
    const root = document.documentElement
    
    // Determinar o modo real (se for system, checar preferência)
    let actualTheme: 'light' | 'dark' | 'midnight' = newTheme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (newTheme as 'light' | 'dark' | 'midnight')

    // Remover todas as classes de tema antigas e novas
    root.classList.remove('mono-light', 'mono-dark', 'light', 'dark', 'midnight', 'system')

    // Adicionar classe do tema selecionado (para controle manual se necessário)
    root.classList.add(newTheme)
    // Adicionar classe do modo real (para CSS genérico)
    // Se for midnight, também adiciona 'dark' para compatibilidade com seletores genéricos
    if (actualTheme === 'midnight') {
      root.classList.add('dark')
    }
    root.classList.add(actualTheme)

    // Paletas de cores para elementos
    const colorPalettes: Record<ColorPalette, { income: string; expense: string; balance: string }> = {
      vivid: {
        income: actualTheme === 'midnight' ? '#22c55e' : '#10b981',
        expense: actualTheme === 'midnight' ? '#f43f5e' : '#ef4444',
        balance: actualTheme === 'midnight' ? '#3b82f6' : '#3b82f6',
      },
      monochrome: {
        income: '#e5e5e5',
        expense: '#a3a3a3',
        balance: '#737373',
      },
    }

    // Aplicar variáveis CSS
    const themesVars: Record<'light' | 'dark' | 'midnight', Record<string, string>> = {
      light: {
        '--ds-color-surface-primary': '#ffffff',
        '--ds-color-surface-secondary': '#f9fafb',
        '--ds-color-surface-tertiary': '#f3f4f6',
        '--ds-color-text-primary': '#000000',
        '--ds-color-text-secondary': '#111827',
        '--ds-color-border-default': '#d1d5db',
        '--ds-color-accent-primary': '#000000',
        '--ds-color-accent-primary-strong': '#000000',
        '--ds-color-accent-primary-soft': '#1f2937',
        '--ds-color-button-text': '#ffffff',
        '--ds-color-intent-success': '#064e3b',
        '--ds-color-intent-warning': '#713f12',
        '--ds-color-intent-danger': '#7f1d1d',
        '--ds-color-interaction-hover': '#f9fafb',
        '--ds-color-interaction-focus': '#6b7280',
        '--ds-color-interaction-disabled': '#f3f4f6',
        '--ds-color-interaction-active': '#f0f0f0',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      },
      dark: {
        '--ds-color-surface-primary': '#09090b', 
        '--ds-color-surface-secondary': '#121216',
        '--ds-color-surface-tertiary': '#1e1e24',
        '--ds-color-text-primary': '#fafafa',
        '--ds-color-text-secondary': '#a1a1aa',
        '--ds-color-border-default': '#27272a',
        '--ds-color-accent-primary': '#e4e4e7',
        '--ds-color-accent-primary-strong': '#d4d4d8',
        '--ds-color-accent-primary-soft': '#3f3f46',
        '--ds-color-button-text': '#09090b',
        '--ds-color-intent-success': '#4ade80',
        '--ds-color-intent-warning': '#fde047',
        '--ds-color-intent-danger': '#f87171',
        '--ds-color-interaction-hover': '#18181b',
        '--ds-color-interaction-focus': '#52525b',
        '--ds-color-interaction-disabled': '#27272a',
        '--ds-color-interaction-active': '#2a2a30',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      },
      midnight: {
        '--ds-color-surface-primary': '#000000', // Preto Puro
        '--ds-color-surface-secondary': '#09090b',
        '--ds-color-surface-tertiary': '#121216',
        '--ds-color-text-primary': '#ffffff',
        '--ds-color-text-secondary': '#a1a1aa',
        '--ds-color-border-default': '#27272a',
        '--ds-color-accent-primary': '#f4f4f5',
        '--ds-color-accent-primary-strong': '#ffffff',
        '--ds-color-accent-primary-soft': '#27272a',
        '--ds-color-button-text': '#000000',
        '--ds-color-intent-success': '#22c55e',
        '--ds-color-intent-warning': '#facc15',
        '--ds-color-intent-danger': '#f43f5e',
        '--ds-color-interaction-hover': '#0a0a0a',
        '--ds-color-interaction-focus': '#71717a',
        '--ds-color-interaction-disabled': '#18181b',
        '--ds-color-interaction-active': '#0f0f0f',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      },
    }

    const themeVars = themesVars[actualTheme]
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
  }, [])

  // Listener para mudanças no sistema
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system', colorPalette)
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, colorPalette, applyTheme])

  // Carregar tema e paleta do localStorage ao montar e sempre que trocar de usuário
  useEffect(() => {
    const savedUserTheme = localStorage.getItem(`theme_${user?.id}`)
    const savedUserPalette = localStorage.getItem(`colorPalette_${user?.id}`)
    
    const savedGlobalTheme = localStorage.getItem('theme')
    const savedGlobalPalette = localStorage.getItem('colorPalette')

    const normalizedTheme = normalizeTheme(savedUserTheme ?? savedGlobalTheme)
    const normalizedPalette = normalizePalette(savedUserPalette ?? savedGlobalPalette)
    
    const initialTheme: Theme = normalizedTheme ?? 'system'
    const initialPalette: ColorPalette = normalizedPalette ?? 'vivid'

    // Sincronizar se necessário
    if (user?.id) {
      if (!savedUserTheme && initialTheme !== 'system') {
        localStorage.setItem(`theme_${user.id}`, initialTheme)
      }
      if (!savedUserPalette && initialPalette !== 'vivid') {
        localStorage.setItem(`colorPalette_${user.id}`, initialPalette)
      }
    } else {
      if (!savedGlobalTheme && initialTheme !== 'system') {
        localStorage.setItem('theme', initialTheme)
      }
      if (!savedGlobalPalette && initialPalette !== 'vivid') {
        localStorage.setItem('colorPalette', initialPalette)
      }
    }

    setThemeState(initialTheme)
    setColorPaletteState(initialPalette)
    applyTheme(initialTheme, initialPalette)
  }, [user?.id, applyTheme])


  const setTheme = (newTheme: Theme) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setThemeState(newTheme)
    applyTheme(newTheme, colorPalette)
    
    // Salvar no perfil do usuário se logado
    if (user?.id) {
      localStorage.setItem(`theme_${user.id}`, newTheme)
    }
    // Sempre salvar no global para telas de login/registro
    localStorage.setItem('theme', newTheme)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  const setColorPalette = (newPalette: ColorPalette) => {
    const root = document.documentElement
    root.classList.add('theme-transitioning')

    setColorPaletteState(newPalette)
    applyTheme(theme, newPalette)
    
    if (user?.id) {
      localStorage.setItem(`colorPalette_${user.id}`, newPalette)
    }
    localStorage.setItem('colorPalette', newPalette)

    setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 450)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorPalette, setColorPalette }}>
      {children}
    </ThemeContext.Provider>
  )
}
