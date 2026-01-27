export type ColorPalette = 'vivid' | 'sunset' | 'ocean'

export const categoryColorPalettes: Record<ColorPalette, string[]> = {
  vivid: [
    // Reds
    '#ef4444', '#f87171', '#fca5a5',
    // Oranges
    '#f97316', '#fb923c', '#fed7aa',
    // Yellows
    '#f59e0b', '#fbbf24', '#fce7f3',
    // Greens
    '#22c55e', '#86efac', '#dcfce7',
    // Cyans
    '#06b6d4', '#67e8f9', '#cffafe',
    // Blues
    '#3b82f6', '#93c5fd', '#dbeafe',
    // Purples
    '#8b5cf6', '#d8b4fe',
  ],
  sunset: [
    // Deep Reds & Magentas
    '#dc2626', '#991b1b', '#f43f5e',
    // Warm Corals & Oranges
    '#ff6b35', '#ff8c42', '#ff6348',
    // Golden & Warm Yellows
    '#fcd34d', '#f59e0b', '#ff9500',
    // Vibrant Pinks & Hot Pinks
    '#ec4899', '#f72585', '#be185d',
    // Deep Purples & Magentas
    '#a855f7', '#d946ef', '#7e22ce',
    // Warm Rust & Bronze
    '#ea580c', '#c2410c', '#dc2626',
    // Coral Shades
    '#ff6b6b', '#ff7f7f', '#ff5252',
  ],
  ocean: [
    // Navy shades
    '#082f49', '#0c4a6e', '#1e3a8a',
    // Blue-slate
    '#0369a1', '#0284c7', '#0ea5e9',
    // Cyan shades
    '#06b6d4', '#14b8a6', '#2dd4bf',
    // Sky shades
    '#bfdbfe', '#93c5fd', '#60a5fa',
    // Teal shades
    '#0891b2', '#164e63', '#0e7490',
    // Indigo
    '#312e81', '#3730a3', '#4338ca',
    // Emerald
    '#047857', '#059669',
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
    // Garantir que o índice não saia dos limites da paleta alvo
    const targetColors = categoryColorPalettes[palette]
    return targetColors[index % targetColors.length]
  }
  
  // Se não encontrar correspondência exata, retorna a cor original
  // (útil para cores customizadas que não vêm da paleta)
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

// Atribui cores únicas da paleta para uma lista de categorias.
// Recebe um array de objetos que tenham `id` or `name` and `color`.
export function assignUniquePaletteColors<T extends { id?: string; name?: string; color?: string }>(
  categories: T[],
  palette: ColorPalette
): string[] {
  const targetColors = categoryColorPalettes[palette]
  const used = new Set<string>()
  const result: string[] = []

  // Helper to find next available color starting from index
  const findNextAvailable = (startIndex: number) => {
    const len = targetColors.length
    for (let i = 0; i < len; i++) {
      const idx = (startIndex + i) % len
      const c = targetColors[idx]
      if (!used.has(c)) return c
    }
    // all used, return based on startIndex
    return targetColors[startIndex % len]
  }

  // Determine preferred index for each category (try to keep original mapping when possible)
  categories.forEach((cat) => {
    let preferredIndex = -1

    // If original color matches vivid palette, try to map same index
    if (cat.color) {
      const vividIndex = categoryColorPalettes.vivid.findIndex(
        (c) => c.toLowerCase() === (cat.color || '').toLowerCase()
      )
      if (vividIndex !== -1) preferredIndex = vividIndex
    }

    // If no preferred index from original color, hash the name for consistency
    if (preferredIndex === -1 && cat.name) {
      let hash = 0
      for (let i = 0; i < cat.name.length; i++) {
        const ch = cat.name.charCodeAt(i)
        hash = ((hash << 5) - hash) + ch
        hash |= 0
      }
      preferredIndex = Math.abs(hash) % targetColors.length
    }

    // Fallback
    if (preferredIndex === -1) preferredIndex = 0

    const chosen = findNextAvailable(preferredIndex)
    used.add(chosen)
    result.push(chosen)
  })

  return result
}
