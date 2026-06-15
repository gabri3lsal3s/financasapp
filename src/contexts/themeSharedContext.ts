import { createContext } from 'react'
import type { Theme, ColorPalette, AccentTone } from '@/contexts/ThemeContext'

export interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  colorPalette: ColorPalette
  setColorPalette: (palette: ColorPalette) => void
  accentTone: AccentTone
  setAccentTone: (tone: AccentTone) => void
  autoDarkPreference: 'dark' | 'midnight'
  setAutoDarkPreference: (pref: 'dark' | 'midnight') => void
  latitude: number | null
  longitude: number | null
  setLocation: (lat: number | null, lng: number | null) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
