import { useEffect, useRef } from 'react'

type BalanceState = 'positive' | 'negative' | 'neutral' | 'unknown'

/**
 * Hook que ajusta dinamicamente o `--ambient-glow-primary` e
 * `--ambient-glow-secondary` no `<html>` com base no saldo financeiro.
 *
 * - Positivo: glow verde (income)
 * - Negativo: glow vermelho (expense)
 * - Neutro/Zero: glow padrão (balance/primary)
 * - Desconhecido: mantém o valor atual sem alteração
 *
 * Uso:
 * ```tsx
 * useBalanceGlow(balance)
 * ```
 *
 * O glow faz transição suave graças à `transition: background 0.3s ease`
 * já definida no `.theme-transitioning` do index.css.
 */
export function useBalanceGlow(balance: number | undefined | null) {
  const prevRef = useRef<BalanceState>('unknown')

  useEffect(() => {
    if (balance === undefined || balance === null) {
      return // unknown — não altera
    }

    let state: BalanceState
    if (balance > 0) {
      state = 'positive'
    } else if (balance < 0) {
      state = 'negative'
    } else {
      state = 'neutral'
    }

    // Evita reatribuição desnecessária se o estado não mudou
    if (state === prevRef.current) return
    prevRef.current = state

    const root = document.documentElement

    switch (state) {
      case 'positive':
        root.style.setProperty('--ambient-glow-primary', 'rgba(16, 185, 129, 0.12)')
        root.style.setProperty('--ambient-glow-secondary', 'rgba(16, 185, 129, 0.06)')
        break
      case 'negative':
        root.style.setProperty('--ambient-glow-primary', 'rgba(239, 68, 68, 0.15)')
        root.style.setProperty('--ambient-glow-secondary', 'rgba(239, 68, 68, 0.08)')
        break
      case 'neutral':
        root.style.removeProperty('--ambient-glow-primary')
        root.style.removeProperty('--ambient-glow-secondary')
        break
    }

    // Cleanup: restaura os valores originais ao desmontar
    return () => {
      root.style.removeProperty('--ambient-glow-primary')
      root.style.removeProperty('--ambient-glow-secondary')
    }
  }, [balance])
}
