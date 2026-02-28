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
    monochrome: {
      name: 'Monocromática',
      colors: ['#e5e7eb', '#9ca3af', '#6b7280'],
    },
  }

  return {
    colorPalette: context.colorPalette,
    setColorPalette: context.setColorPalette,
    colorPalettes,
  }
}
