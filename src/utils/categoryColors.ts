export type ColorPalette = 'vivid' | 'monochrome' | 'neon-green'

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
  monochrome: [
    // Neutral grayscale
    '#f5f5f5', '#e5e5e5', '#d4d4d4',
    // Cool light grays
    '#cfcfcf', '#bdbdbd', '#a3a3a3',
    // Mid grays
    '#8a8a8a', '#737373', '#6b7280',
    // Deep grays
    '#5a5a5a', '#4b5563', '#444444',
    // Charcoal shades
    '#3a3a3a', '#333333', '#2a2a2a',
    // Near-black accents
    '#242424', '#1f1f1f', '#181818',
    // Alternate neutrals
    '#9ca3af', '#7c7c7c', '#525252',
  ],
  'neon-green': [
    // Soft neon highlights
    '#6ee787', '#4ade80', '#84cc16',
    // Lime support
    '#a3e635', '#bef264', '#9acd32',
    // Fresh green tones
    '#22c55e', '#34d399', '#10b981',
    // Medium greens
    '#16a34a', '#65a30d', '#4d7c0f',
    // Deep support greens for contrast
    '#166534', '#14532d', '#1f5f3a',
    // Mint accents
    '#86efac', '#6ee7b7', '#5eead4',
    // Alternate balanced accents
    '#7ddf64', '#57cc99', '#6fbf73',
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
