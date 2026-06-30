/**
 * Hook que gerencia atalhos de teclado para a calculadora flutuante.
 * Escuta eventos keydown e delega para os handlers da calculadora.
 * Usa useRef estável para evitar recriação do listener a cada expressão.
 */
import { useEffect, type MutableRefObject } from 'react'

export interface CalculatorKeyboardHandlers {
  appendToExpression: (value: string) => void
  applyEvaluation: () => string | null
  backspaceExpression: () => void
  clearExpression: () => void
}

/**
 * Configura os atalhos de teclado para a calculadora quando expandida.
 *
 * Atalhos suportados:
 * - 0-9, +, -, *, /, (, ), ., , → inserção na expressão
 * - Enter, = → avalia a expressão
 * - Backspace → apaga último caractere
 * - Delete → limpa expressão
 * - Escape → fecha a calculadora
 */
export function useCalculatorKeyboard(
  isExpanded: boolean,
  keyboardHandlersRef: MutableRefObject<CalculatorKeyboardHandlers>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!isExpanded) return

    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event
      const handlers = keyboardHandlersRef.current

      if (/^[0-9]$/.test(key)) {
        event.preventDefault()
        event.stopPropagation()
        handlers.appendToExpression(key)
        return
      }

      const isOperatorKey = key === '+' || key === '-' || key === '*' || key === '/'
      const isParenthesisKey = key === '(' || key === ')'

      if (isOperatorKey || isParenthesisKey) {
        event.preventDefault()
        event.stopPropagation()
        handlers.appendToExpression(key)
        return
      }

      if (key === '.' || key === ',') {
        event.preventDefault()
        event.stopPropagation()
        handlers.appendToExpression('.')
        return
      }

      if (key === 'Enter' || key === '=') {
        event.preventDefault()
        event.stopPropagation()
        handlers.applyEvaluation()
        return
      }

      if (key === 'Backspace') {
        event.preventDefault()
        event.stopPropagation()
        handlers.backspaceExpression()
        return
      }

      if (key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        handlers.clearExpression()
        return
      }

      if (key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [isExpanded, keyboardHandlersRef, onClose])
}
