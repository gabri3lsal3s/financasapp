/**
 * Re-exporta componentes Skeleton do design system e variantes específicas do app.
 *
 * As variantes base (Skeleton, SkeletonText, SkeletonCard, SkeletonAccordionCard,
 * SkeletonKpi, SkeletonKpiGrid) foram movidas para `@/components/ui/skeleton`.
 *
 * Este arquivo mantém re-exports para compatibilidade com imports existentes.
 *
 * ⚠️ Para novo código, importe diretamente de `@/components/ui/skeleton`.
 */
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAccordionCard,
  SkeletonKpi,
  SkeletonKpiGrid,
} from '@/components/ui/skeleton'

// Skeletons específicos de página — permanecem aqui por serem acoplados ao layout das páginas
export {
  SkeletonDashboard,
  SkeletonTransactionList,
  SkeletonInvestments,
  SkeletonCategories,
  SkeletonContas,
  SkeletonReports,
  SkeletonCategoryGrid,
} from '@/components/ui/skeleton'
