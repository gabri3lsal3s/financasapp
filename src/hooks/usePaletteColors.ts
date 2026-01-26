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
    pastel: {
      name: 'Pastel',
      colors: ['#86efac', '#fca5a5', '#93c5fd'],
    },
    earth: {
      name: 'Terra',
      colors: ['#92400e', '#7c2d12', '#8b5cf6'],
    },
    ocean: {
      name: 'Oceano',
      colors: ['#0369a1', '#06b6d4', '#0ea5e9'],
    },
    sunset: {
      name: 'Pôr do Sol',
      colors: ['#d97706', '#dc2626', '#f59e0b'],
    },
  }

  return {
    colorPalette: context.colorPalette,
    setColorPalette: context.setColorPalette,
    colorPalettes,
  }
}
