import { createContext } from 'react'
import type { Theme, ColorPalette } from '@/contexts/ThemeContext'

export interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  colorPalette: ColorPalette
  setColorPalette: (palette: ColorPalette) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
