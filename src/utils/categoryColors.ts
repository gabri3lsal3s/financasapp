export type ColorPalette = 'vivid' | 'monochrome'

const PALETTE_SIZES: Record<ColorPalette, number> = {
  vivid: 20,
  monochrome: 24,
}

/** Chaves sem `#` — ordem alinhada a `--category-vivid-*` em theme-tokens.css */
const VIVID_COLOR_KEYS = [
  'ef4444', 'f87171', 'fca5a5',
  'f97316', 'fb923c', 'fed7aa',
  'f59e0b', 'fbbf24', 'fce7f3',
  '22c55e', '86efac', 'dcfce7',
  '06b6d4', '67e8f9', 'cffafe',
  '3b82f6', '93c5fd', 'dbeafe',
  '8b5cf6', 'd8b4fe',
] as const

function normalizeColorKey(color: string): string {
  return color.trim().replace(/^#/, '').toLowerCase()
}

function categoryVarName(palette: ColorPalette, index: number): string {
  const size = PALETTE_SIZES[palette]
  const idx = ((index % size) + size) % size
  const prefix = palette === 'vivid' ? 'vivid' : 'mono'
  return `var(--category-${prefix}-${String(idx).padStart(2, '0')})`
}

export function getCategoryColor(categoryIndex: number, palette: ColorPalette): string {
  return categoryVarName(palette, categoryIndex)
}

export function getCategoryColorForPalette(originalColor: string, palette: ColorPalette): string {
  const colorOnly = originalColor ? originalColor.split('|')[0] : ''
  const index = VIVID_COLOR_KEYS.findIndex((key) => key === normalizeColorKey(colorOnly))

  if (index !== -1) {
    return categoryVarName(palette, index)
  }

  return colorOnly
}

export function generateCategoryColor(categoryName: string, palette: ColorPalette): string {
  let hash = 0
  for (let i = 0; i < categoryName.length; i++) {
    const char = categoryName.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return categoryVarName(palette, Math.abs(hash))
}

export function getAllocationClassColor(classLabel: string): string {
  if (classLabel.includes('Ações Nacionais')) return 'var(--allocation-acoes)'
  if (classLabel.includes('Fundos')) return 'var(--allocation-fundos)'
  if (classLabel.includes('Cripto')) return 'var(--allocation-cripto)'
  if (classLabel.includes('Renda Fixa')) return 'var(--allocation-renda-fixa)'
  if (classLabel.includes('Internacionais')) return 'var(--allocation-internacionais)'
  if (classLabel.includes('ETFs')) return 'var(--allocation-etfs)'
  return 'var(--allocation-default)'
}

export function assignUniquePaletteColors<T extends { id?: string; name?: string; color?: string }>(
  categories: T[],
  palette: ColorPalette
): string[] {
  const size = PALETTE_SIZES[palette]
  const used = new Set<string>()
  const result: string[] = []

  const findNextAvailable = (startIndex: number): string => {
    for (let i = 0; i < size; i++) {
      const idx = (startIndex + i) % size
      const token = categoryVarName(palette, idx)
      if (!used.has(token)) return token
    }
    return categoryVarName(palette, startIndex % size)
  }

  categories.forEach((cat) => {
    let preferredIndex = -1

    if (cat.color) {
      const colorOnly = cat.color.split('|')[0]
      const vividIndex = VIVID_COLOR_KEYS.findIndex(
        (key) => key === normalizeColorKey(colorOnly ?? '')
      )
      if (vividIndex !== -1) preferredIndex = vividIndex
    }

    if (preferredIndex === -1 && cat.name) {
      let hash = 0
      for (let i = 0; i < cat.name.length; i++) {
        const ch = cat.name.charCodeAt(i)
        hash = ((hash << 5) - hash) + ch
        hash |= 0
      }
      preferredIndex = Math.abs(hash) % size
    }

    if (preferredIndex === -1) preferredIndex = 0

    const chosen = findNextAvailable(preferredIndex)
    used.add(chosen)
    result.push(chosen)
  })

  return result
}

export const DEFAULT_CATEGORY_COLOR_HEX = '#' + 'ef4444'

export const VIVID_COLORS = VIVID_COLOR_KEYS.map((key) => '#' + key)
