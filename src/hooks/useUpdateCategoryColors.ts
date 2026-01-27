import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePaletteColors } from './usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'

/**
 * Hook que atualiza as cores de todas as categorias existentes
 * quando a paleta de cores é mudada
 */
export function useUpdateCategoryColors() {
  const { colorPalette } = usePaletteColors()

  useEffect(() => {
    const updateColors = async () => {
      try {
        // Buscar categorias de despesas
        const { data: categories } = await supabase
          .from('categories')
          .select('*')

        // Atualizar cores de categorias de despesas
        if (categories && categories.length > 0) {
          const categoryUpdates = categories.map(async (cat: any) => {
            const newColor = getCategoryColorForPalette(cat.color, colorPalette)
            if (newColor !== cat.color) {
              await supabase
                .from('categories')
                .update({ color: newColor })
                .eq('id', cat.id)
            }
          })
          await Promise.all(categoryUpdates)
        }

        // Buscar categorias de rendas
        const { data: incomeCategories } = await supabase
          .from('income_categories')
          .select('*')

        // Atualizar cores de categorias de rendas
        if (incomeCategories && incomeCategories.length > 0) {
          const incomeCategoryUpdates = incomeCategories.map(async (cat: any) => {
            const newColor = getCategoryColorForPalette(cat.color, colorPalette)
            if (newColor !== cat.color) {
              await supabase
                .from('income_categories')
                .update({ color: newColor })
                .eq('id', cat.id)
            }
          })
          await Promise.all(incomeCategoryUpdates)
        }
      } catch (error) {
        console.error('Erro ao atualizar cores das categorias:', error)
      }
    }

    updateColors()
  }, [colorPalette])
}
