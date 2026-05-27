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

  // Aplicar tema ao documento
  const applyTheme = useCallback((newTheme: Theme, newPalette: ColorPalette, newStyle: VisualStyle) => {
    const root = document.documentElement
    
    // Determinar o modo real (se for system, checar preferência)
    const actualTheme: 'light' | 'dark' | 'midnight' = newTheme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (newTheme as 'light' | 'dark' | 'midnight')

    // Remover todas as classes de tema antigas e novas
    root.classList.remove('mono-light', 'mono-dark', 'light', 'dark', 'midnight', 'system', 'cyberpunk')

    // Adicionar classe do tema selecionado (para controle manual se necessário)
    root.classList.add(newTheme)
    // Adicionar classe do modo real (para CSS genérico)
    // Se for midnight, também adiciona 'dark' para compatibilidade com seletores genéricos
    if (actualTheme === 'midnight') {
      root.classList.add('dark')
    }
    root.classList.add(actualTheme)

    // Adicionar estilo cyberpunk se ativo
    if (newStyle === 'cyberpunk') {
      root.classList.add('cyberpunk')
    }

    // Paletas de cores para elementos clássicos
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

    // Aplicar variáveis CSS com base no Estilo Visual e no Tema de Cores
    const themesVars: Record<'light' | 'dark' | 'midnight', Record<string, string>> = {
      light: newStyle === 'cyberpunk' ? {
        '--ds-color-surface-primary': 'rgba(240, 244, 255, 0.75)',
        '--ds-color-surface-secondary': '#f1f5f9',
        '--ds-color-surface-tertiary': 'rgba(226, 232, 240, 0.8)',
        '--ds-color-text-primary': '#0f172a',
        '--ds-color-text-secondary': '#475569',
        '--ds-color-border-default': 'rgba(15, 23, 42, 0.08)',
        '--ds-color-accent-primary': '#06b6d4',
        '--ds-color-accent-primary-strong': '#0891b2',
        '--ds-color-accent-primary-soft': 'rgba(6, 182, 212, 0.15)',
        '--ds-color-button-text': '#ffffff',
        '--ds-color-intent-success': '#10b981',
        '--ds-color-intent-warning': '#eab308',
        '--ds-color-intent-danger': '#ef4444',
        '--ds-color-interaction-hover': 'rgba(6, 182, 212, 0.12)',
        '--ds-color-interaction-focus': '#06b6d4',
        '--ds-color-interaction-disabled': '#e2e8f0',
        '--ds-color-interaction-active': 'rgba(6, 182, 212, 0.22)',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      } : {
        '--ds-color-surface-primary': '#ffffff',
        '--ds-color-surface-secondary': '#f8fafc',
        '--ds-color-surface-tertiary': '#f1f5f9',
        '--ds-color-text-primary': '#0f172a',
        '--ds-color-text-secondary': '#475569',
        '--ds-color-border-default': '#e2e8f0',
        '--ds-color-accent-primary': '#0f172a',
        '--ds-color-accent-primary-strong': '#020617',
        '--ds-color-accent-primary-soft': '#f1f5f9',
        '--ds-color-button-text': '#ffffff',
        '--ds-color-intent-success': '#10b981',
        '--ds-color-intent-warning': '#ca8a04',
        '--ds-color-intent-danger': '#ef4444',
        '--ds-color-interaction-hover': '#f8fafc',
        '--ds-color-interaction-focus': '#64748b',
        '--ds-color-interaction-disabled': '#e2e8f0',
        '--ds-color-interaction-active': '#e2e8f0',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      },
      dark: newStyle === 'cyberpunk' ? {
        '--ds-color-surface-primary': 'rgba(10, 11, 22, 0.65)',
        '--ds-color-surface-secondary': '#040409',
        '--ds-color-surface-tertiary': 'rgba(20, 22, 45, 0.7)',
        '--ds-color-text-primary': '#fafafa',
        '--ds-color-text-secondary': '#94a3b8',
        '--ds-color-border-default': 'rgba(0, 255, 136, 0.08)',
        '--ds-color-accent-primary': '#00FF88',
        '--ds-color-accent-primary-strong': '#00E67A',
        '--ds-color-accent-primary-soft': 'rgba(0, 255, 136, 0.15)',
        '--ds-color-button-text': '#07080E',
        '--ds-color-intent-success': '#00FF88',
        '--ds-color-intent-warning': '#facc15',
        '--ds-color-intent-danger': '#FF3366',
        '--ds-color-interaction-hover': 'rgba(0, 255, 136, 0.15)',
        '--ds-color-interaction-focus': '#00FF88',
        '--ds-color-interaction-disabled': '#18181b',
        '--ds-color-interaction-active': 'rgba(0, 255, 136, 0.25)',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      } : {
        '--ds-color-surface-primary': '#0b0f19', 
        '--ds-color-surface-secondary': '#111827',
        '--ds-color-surface-tertiary': '#1f2937',
        '--ds-color-text-primary': '#f8fafc',
        '--ds-color-text-secondary': '#94a3b8',
        '--ds-color-border-default': '#1e293b',
        '--ds-color-accent-primary': '#e2e8f0',
        '--ds-color-accent-primary-strong': '#f8fafc',
        '--ds-color-accent-primary-soft': '#334155',
        '--ds-color-button-text': '#0b0f19',
        '--ds-color-intent-success': '#22c55e',
        '--ds-color-intent-warning': '#eab308',
        '--ds-color-intent-danger': '#ef4444',
        '--ds-color-interaction-hover': '#1e293b',
        '--ds-color-interaction-focus': '#475569',
        '--ds-color-interaction-disabled': '#1e293b',
        '--ds-color-interaction-active': '#334155',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      },
      midnight: newStyle === 'cyberpunk' ? {
        '--ds-color-surface-primary': 'rgba(5, 5, 8, 0.7)',
        '--ds-color-surface-secondary': '#000000',
        '--ds-color-surface-tertiary': 'rgba(10, 10, 15, 0.75)',
        '--ds-color-text-primary': '#ffffff',
        '--ds-color-text-secondary': '#a3a3a3',
        '--ds-color-border-default': 'rgba(0, 255, 136, 0.1)',
        '--ds-color-accent-primary': '#00FF88',
        '--ds-color-accent-primary-strong': '#ffffff',
        '--ds-color-accent-primary-soft': 'rgba(0, 255, 136, 0.2)',
        '--ds-color-button-text': '#000000',
        '--ds-color-intent-success': '#00FF88',
        '--ds-color-intent-warning': '#facc15',
        '--ds-color-intent-danger': '#ff3366',
        '--ds-color-interaction-hover': 'rgba(0, 255, 136, 0.2)',
        '--ds-color-interaction-focus': '#00FF88',
        '--ds-color-interaction-disabled': '#18181b',
        '--ds-color-interaction-active': 'rgba(0, 255, 136, 0.3)',
        '--ds-motion-duration-fast': '200ms',
        '--ds-motion-duration-normal': '300ms',
      } : {
        '--ds-color-surface-primary': '#000000', 
        '--ds-color-surface-secondary': '#0a0a0a',
        '--ds-color-surface-tertiary': '#161616',
        '--ds-color-text-primary': '#ffffff',
        '--ds-color-text-secondary': '#a3a3a3',
        '--ds-color-border-default': '#262626',
        '--ds-color-accent-primary': '#ffffff',
        '--ds-color-accent-primary-strong': '#ffffff',
        '--ds-color-accent-primary-soft': '#262626',
        '--ds-color-button-text': '#000000',
        '--ds-color-intent-success': '#22c55e',
        '--ds-color-intent-warning': '#eab308',
        '--ds-color-intent-danger': '#ef4444',
        '--ds-color-interaction-hover': '#0a0a0a',
        '--ds-color-interaction-focus': '#737373',
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

    // Aplicar variáveis de paleta dinâmicas do Cyber-Minimalismo ou Clássicas
    const cyberIncome = actualTheme === 'light' ? '#10b981' : '#00FF88'
    const cyberExpense = actualTheme === 'light' ? '#EF4444' : '#FF3366'
    const cyberBalance = actualTheme === 'light' ? '#06b6d4' : '#00FF88'

    root.style.setProperty('--ds-color-data-income', newStyle === 'cyberpunk' ? cyberIncome : paletteVars.income)
    root.style.setProperty('--ds-color-data-expense', newStyle === 'cyberpunk' ? cyberExpense : paletteVars.expense)
    root.style.setProperty('--ds-color-data-balance', newStyle === 'cyberpunk' ? cyberBalance : paletteVars.balance)
  }, [])

  // Listener para mudanças no sistema
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system', colorPalette, visualStyle)
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, colorPalette, visualStyle, applyTheme])

  // Carregar tema, paleta e estilo do localStorage ao montar/trocar usuário
  useEffect(() => {
    const savedUserTheme = localStorage.getItem(`theme_${user?.id}`)
    const savedGlobalTheme = localStorage.getItem('theme')
    const normalizedTheme = normalizeTheme(savedUserTheme ?? savedGlobalTheme)
    const initialTheme: Theme = normalizedTheme ?? 'system'
    const initialPalette: ColorPalette = 'vivid'

    const savedUserStyle = localStorage.getItem(`visualStyle_${user?.id}`)
    const savedGlobalStyle = localStorage.getItem('visualStyle')
    const initialStyle: VisualStyle = (savedUserStyle ?? savedGlobalStyle) === 'cyberpunk' ? 'cyberpunk' : 'classic'

    // Sincronizar se necessário
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

