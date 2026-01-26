export type ColorPalette = 'vivid' | 'pastel' | 'earth' | 'ocean' | 'sunset'

const categoryColorPalettes: Record<ColorPalette, string[]> = {
  vivid: [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#6b7280', '#374151', '#1f2937',
  ],
  pastel: [
    '#fca5a5', '#fb923c', '#fcd34d', '#fde047', '#bef264',
    '#86efac', '#6ee7b7', '#5eead4', '#67e8f9', '#a5f3fc',
    '#93c5fd', '#c7d2fe', '#d8b4fe', '#f0abfc', '#fbcfe8',
    '#f472b6', '#fb7185', '#d1d5db', '#b4b5b6', '#9ca3af',
  ],
  earth: [
    '#7c2d12', '#92400e', '#b45309', '#d97706', '#f59e0b',
    '#fbbf24', '#fcd34d', '#fae8b6', '#ddd6fe', '#c4b5fd',
    '#a78bfa', '#8b5cf6', '#6d28d9', '#4c1d95', '#581c87',
    '#6b21a8', '#7c3aed', '#06b6d4', '#0891b2', '#0e7490',
  ],
  ocean: [
    '#082f49', '#0c4a6e', '#0369a1', '#0284c7', '#0ea5e9',
    '#06b6d4', '#14b8a6', '#2dd4bf', '#67e8f9', '#a5f3fc',
    '#cffafe', '#e0f2fe', '#bfdbfe', '#93c5fd', '#60a5fa',
    '#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554',
  ],
  sunset: [
    '#7c2d12', '#92400e', '#b45309', '#d97706', '#f59e0b',
    '#fbbf24', '#dc2626', '#ef4444', '#f87171', '#fca5a5',
    '#fecaca', '#fed7aa', '#fdba74', '#fb923c', '#f97316',
    '#ea580c', '#c2410c', '#92400e', '#78350f', '#451a03',
  ],
}

export function getCategoryColor(
  categoryIndex: number,
  palette: ColorPalette
): string {
  const colors = categoryColorPalettes[palette]
  return colors[categoryIndex % colors.length]
}

export function getCategoryColorForPalette(
  originalColor: string,
  palette: ColorPalette
): string {
  // Se a cor original está em uma das paletas vivid (padrão), mapeie para a nova paleta
  const vividColors = categoryColorPalettes.vivid
  const index = vividColors.findIndex(c => c.toLowerCase() === originalColor.toLowerCase())
  
  if (index !== -1) {
    return categoryColorPalettes[palette][index]
  }
  
  // Se não encontrar correspondência exata, procura por similaridade de índice
  // por enquanto, apenas use a cor original
  return originalColor
}

// Gerar cor automática para categoria baseado em um hash do nome
export function generateCategoryColor(
  categoryName: string,
  palette: ColorPalette
): string {
  // Simples hash do nome para gerar um índice consistente
  let hash = 0
  for (let i = 0; i < categoryName.length; i++) {
    const char = categoryName.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Converter para inteiro de 32 bits
  }
  
  const index = Math.abs(hash) % categoryColorPalettes[palette].length
  return categoryColorPalettes[palette][index]
}
