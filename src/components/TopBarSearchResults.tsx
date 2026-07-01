import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingDown,
  TrendingUp,
  Receipt,
  CreditCard,
  Tags,
  Search,
  Home,
  PiggyBank,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { SearchResult } from '@/utils/searchEngine'
import { formatCurrency } from '@/utils/format'

/* ------------------------------------------------------------------ */
/*  Ícone por nome (string → componente)                              */
/* ------------------------------------------------------------------ */

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  TrendingDown: TrendingDown as React.ComponentType<{ size?: number; className?: string }>,
  TrendingUp: TrendingUp as React.ComponentType<{ size?: number; className?: string }>,
  Receipt: Receipt as React.ComponentType<{ size?: number; className?: string }>,
  CreditCard: CreditCard as React.ComponentType<{ size?: number; className?: string }>,
  Tags: Tags as React.ComponentType<{ size?: number; className?: string }>,
  Home: Home as React.ComponentType<{ size?: number; className?: string }>,
  PiggyBank: PiggyBank as React.ComponentType<{ size?: number; className?: string }>,
  BarChart3: BarChart3 as React.ComponentType<{ size?: number; className?: string }>,
  Settings: Settings as React.ComponentType<{ size?: number; className?: string }>,
}

/* ------------------------------------------------------------------ */
/*  Rótulo e cor de badge por tipo                                    */
/* ------------------------------------------------------------------ */

const typeMeta: Record<
  SearchResult['type'],
  { label: string; color: string }
> = {
  expense:       { label: 'Despesa',  color: 'var(--color-expense-text)' },
  income:        { label: 'Renda',    color: 'var(--color-income-text)' },
  debt:          { label: 'Dívida',   color: 'var(--color-warning)' },
  credit_card:   { label: 'Cartão',   color: 'var(--color-primary)' },
  category:      { label: 'Categoria', color: 'var(--color-text-secondary)' },
  income_category: { label: 'Categoria', color: 'var(--color-text-secondary)' },
  page:          { label: 'Página',   color: 'var(--color-text-secondary)' },
}

/* ------------------------------------------------------------------ */
/*  Highlight do termo buscado                                        */
/* ------------------------------------------------------------------ */

function HighlightedText({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    if (!query.trim()) return [{ text, highlight: false }]
    const q = query.toLowerCase()
    const lower = text.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx === -1) return [{ text, highlight: false }]

    return [
      { text: text.slice(0, idx), highlight: false },
      { text: text.slice(idx, idx + q.length), highlight: true },
      { text: text.slice(idx + q.length), highlight: false },
    ]
  }, [text, query])

  return (
    <span className="truncate">
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className="bg-primary/20 text-primary rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Componente principal                                              */
/* ------------------------------------------------------------------ */

interface Props {
  results: SearchResult[]
  query: string
  onSelect: (result: SearchResult) => void
}

export default function TopBarSearchResults({ results, query, onSelect }: Props) {
  // Agrupar resultados por tipo
  const grouped = useMemo(() => {
    const map = new Map<SearchResult['type'], SearchResult[]>()
    for (const r of results) {
      const g = map.get(r.type) ?? []
      g.push(r)
      map.set(r.type, g)
    }
    return map
  }, [results])

  // Ordem de exibição dos grupos
  const groupOrder: SearchResult['type'][] = [
    'expense',
    'income',
    'debt',
    'credit_card',
    'category',
    'income_category',
    'page',
  ]

  if (results.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="px-3.5 py-6 text-center"
      >
        <div className="flex justify-center mb-2">
          <Search size={20} className="text-secondary/50" />
        </div>
        <p className="text-xs text-secondary/70">
          Nenhum resultado encontrado para &ldquo;{query}&rdquo;
        </p>
        <p className="text-[10px] text-secondary/50 mt-1">
          Tente buscar por descrição, categoria, valor ou data
        </p>
      </motion.div>
    )
  }

  return (
    <div className="py-1 max-h-[60vh] overflow-y-auto">
      {groupOrder.map((type) => {
        const items = grouped.get(type)
        if (!items || items.length === 0) return null
        const meta = typeMeta[type]

        return (
          <div key={type}>
            {/* Cabeçalho da seção — só mostra se houver pelo menos 2 itens */}
            {items.length >= 2 && (
              <div className="px-3.5 pt-2 pb-1">
                <p
                  className="text-[9px] font-black uppercase tracking-widest"
                  style={{ color: meta.color }}
                >
                  {type === 'expense'
                    ? 'Despesas'
                    : type === 'income'
                      ? 'Rendas'
                      : type === 'debt'
                        ? 'Dívidas'
                        : type === 'credit_card'
                          ? 'Cartões'
                          : 'Categorias'}
                </p>
              </div>
            )}

            {items.map((r, i) => {
              const Icon = iconMap[r.iconName] || Tags
              const meta = typeMeta[r.type]

              return (
                <motion.button
                  key={`${r.type}-${r.id}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.15 }}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs text-primary hover:bg-secondary/10 transition-colors text-left"
                >
                  {/* Ícone */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                      color: meta.color,
                    }}
                  >
                    <Icon size={13} />
                  </div>

                  {/* Info central */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary truncate">
                      <HighlightedText text={r.title} query={query} />
                    </p>
                    <p className="text-[10px] text-secondary truncate mt-0.5">
                      {r.subtitle}
                    </p>
                  </div>

                  {/* Valor + badge */}
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {r.value !== undefined && (
                      <p className="text-xs font-bold font-mono text-primary">
                        {formatCurrency(r.value)}
                      </p>
                    )}
                    {/* Badge de tipo quando sem cabeçalho de seção */}
                    {items.length < 2 && (
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
                          color: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
