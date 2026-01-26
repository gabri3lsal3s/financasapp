import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'

interface CategoryColorBarProps {
  color: string
  size?: 'sm' | 'md'
  className?: string
}

export default function CategoryColorBar({ color, size = 'md', className = '' }: CategoryColorBarProps) {
  const { colorPalette } = usePaletteColors()
  const mappedColor = getCategoryColorForPalette(color, colorPalette as any)

  const sizeClasses = {
    sm: 'w-1 h-5',
    md: 'w-1 h-6',
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-sm flex-shrink-0 ${className}`}
      style={{ backgroundColor: mappedColor }}
    />
  )
}
