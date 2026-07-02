import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Mapa de caminhos para títulos de página em português */
export const PAGE_TITLES: Record<string, string> = {
  '/': 'Início',
  '/expenses': 'Despesas',
  '/incomes': 'Rendas',
  '/investments': 'Investimentos',
  '/contas': 'Contas',
  '/categories': 'Categorias',
  '/categorias-despesa': 'Categorias de Despesa',
  '/categorias-renda': 'Categorias de Renda',
  '/reports': 'Relatórios',
  '/settings': 'Configurações',
  '/login': 'Login',
  '/register': 'Cadastro',
  '/forgot-password': 'Recuperar Senha',
  '/reset-password': 'Redefinir Senha',
  '/onboarding': 'Primeiros Passos',
}

/** Obtém o título da página a partir do pathname */
export function getPageTitle(pathname: string): string {
  // Tenta match exato primeiro
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]

  // Fallback: extrai o último segmento da URL
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0) {
    const last = segments[segments.length - 1]
    return last.charAt(0).toUpperCase() + last.slice(1)
  }
  return 'Finanças'
}

/**
 * Hook que lê os parâmetros `highlight` e `expand` da URL, faz scroll e aplica
 * um efeito visual temporário (ring + glow + scale sutil) no elemento.
 *
 * Também define `data-search-highlight="true"` no elemento para permitir
 * estilização via CSS.
 *
 * Uso: colocar `useSearchHighlight()` nas páginas que podem receber highlight
 * da busca global (expenses, incomes, contas, categories).
 */
export function useSearchHighlight() {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (!highlightId) return

    // Delay para garantir que o DOM já tenha sido renderizado (incluindo
    // troca de mês que pode triggerar re-render)
    const timer = setTimeout(() => {
      const el = document.getElementById(`item-${highlightId}`)
      if (!el) return

      el.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Marca como search-highlight para CSS
      el.dataset.searchHighlight = 'true'

      // Adiciona classes de destaque com animação sutil
      el.classList.add(
        'ring-2',
        'ring-[var(--color-primary)]',
        'rounded-xl',
        'transition-all',
        'duration-700',
        'search-highlight-item',
      )

      // Remove o destaque após 4s com fade-out
      const removeTimer = setTimeout(() => {
        el.classList.remove(
          'ring-2',
          'ring-[var(--color-primary)]',
          'rounded-xl',
          'transition-all',
          'duration-700',
          'search-highlight-item',
        )
        delete el.dataset.searchHighlight
      }, 4000)

      return () => clearTimeout(removeTimer)
    }, 400)

    // Remove o highlight param da URL após processar (mas mantém expand)
    const cleanupTimer = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      next.delete('highlight')
      next.delete('expand')
      setSearchParams(next, { replace: true })
    }, 600)

    return () => {
      clearTimeout(timer)
      clearTimeout(cleanupTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda apenas quando highlight muda
  }, [searchParams.get('highlight')])
}
