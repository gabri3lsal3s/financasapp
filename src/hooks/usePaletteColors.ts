import { useContext } from 'react'
import { ThemeContext } from '@/contexts/ThemeContext'

export function usePaletteColors() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('usePaletteColors must be used within ThemeProvider')
  }

  const colorPalettes = {
    vivid: {
      name: 'Vivid',
      colors: ['#10b981', '#ef4444', '#3b82f6'],
    },
    sunset: {
      name: 'Sunset',
      colors: ['#ff6b35', '#f43f5e', '#a855f7'],
    },
    ocean: {
      name: 'Oceano',
      colors: ['#0369a1', '#06b6d4', '#0ea5e9'],
    },
  }

  return {
    colorPalette: context.colorPalette,
    setColorPalette: context.setColorPalette,
    colorPalettes,
  }
}
