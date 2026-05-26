import { createContext } from 'react'
import type { Theme, ColorPalette, VisualStyle } from '@/contexts/ThemeContext'

export interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  colorPalette: ColorPalette
  setColorPalette: (palette: ColorPalette) => void
  visualStyle: VisualStyle
  setVisualStyle: (style: VisualStyle) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

