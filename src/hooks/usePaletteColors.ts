import { useContext } from 'react'
import { ThemeContext } from '@/contexts/themeSharedContext'

export function usePaletteColors() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('usePaletteColors must be used within ThemeProvider')
  }

  const colorPalettes = {
    vivid: {
      name: 'Vivid',
      colors: [
        'var(--palette-preview-vivid-0)',
        'var(--palette-preview-vivid-1)',
        'var(--palette-preview-vivid-2)',
      ],
    },
  }

  return {
    colorPalette: context.colorPalette,
    setColorPalette: context.setColorPalette,
    colorPalettes,
  }
}
