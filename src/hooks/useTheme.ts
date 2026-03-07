import { useContext } from 'react'
import type { Theme } from '@/contexts/ThemeContext'
import { ThemeContext } from '@/contexts/themeSharedContext'

export function useTheme() {
  const context = useContext(ThemeContext)
  
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  
  return context
}

export type { Theme }
