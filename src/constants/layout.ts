/**
 * Tokens de layout padronizados para todo o app.
 *
 * Use estas constantes em vez de valores avulsos de padding/margin
 * para garantir consistência visual entre cards e seções.
 */

/** Padding padrão de cards (uso geral) */
export const CARD_PADDING = 'p-4 sm:p-5'

/** Padding grande de cards (cards de destaque / hero) */
export const CARD_PADDING_LARGE = 'p-5 sm:p-6'

/** Padding extra-grande (empty states, modais especiais) */
export const CARD_PADDING_XL = 'p-8 sm:p-12'

/** Gap entre seções no Dashboard e páginas de lista */
export const SECTION_GAP = 'space-y-5'

/** Gap entre grupos de cards internos */
export const CARD_GROUP_GAP = 'space-y-4'

/** Classe base para card com borda e fundo glass */
export const CARD_BASE = 'border border-glass surface-glass rounded-2xl shadow-sm'

/** Classe base para card sem sombra */
export const CARD_BASE_FLAT = 'border border-glass surface-glass rounded-2xl'

/** Grid padrão de 2 colunas para KPIs / métricas */
export const KPI_GRID = 'grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch'

/** Grid de 3 colunas para ações rápidas */
export const ACTION_GRID = 'grid grid-cols-3 gap-3'

/** Classe de entrada animada para páginas */
export const PAGE_ENTER_ANIMATION = 'animate-page-enter relative'

/** Padding horizontal responsivo do conteúdo principal */
export const CONTENT_PADDING = 'p-4 lg:p-6'

/** Max-width do conteúdo centralizado */
export const CONTENT_MAX_WIDTH = 'max-w-7xl mx-auto'
