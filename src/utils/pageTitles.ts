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
 * Hook que lê o parâmetro `highlight` da URL, faz scroll e aplica um ring
 * visual temporário no elemento encontrado.
 *
 * Uso: colocar `useSearchHighlight()` nas páginas que podem receber highlight
 * da busca global (expenses, incomes, contas, categories).
 */
export function useSearchHighlight() {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (!highlightId) return

    // Pequeno delay para garantir que o DOM já tenha sido renderizado
    const timer = setTimeout(() => {
      const el = document.getElementById(`item-${highlightId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // Adiciona ring com a mesma estética dos modais
        el.classList.add(
          'ring-2',
          'ring-[var(--color-primary)]/50',
          'rounded-xl',
          'transition-all',
          'duration-300',
        )

        // Remove o destaque após 3s
        const removeTimer = setTimeout(() => {
          el.classList.remove(
            'ring-2',
            'ring-[var(--color-primary)]/50',
            'rounded-xl',
            'transition-all',
            'duration-300',
          )
        }, 3000)

        // Limpa o timer de remoção se o componente desmontar
        return () => clearTimeout(removeTimer)
      }
    }, 300)

    // Remove o highlight param da URL após processar
    const cleanupTimer = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      next.delete('highlight')
      setSearchParams(next, { replace: true })
    }, 500)

    return () => {
      clearTimeout(timer)
      clearTimeout(cleanupTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda apenas quando highlight muda
  }, [searchParams.get('highlight')])
}
