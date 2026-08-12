import { useCallback, useEffect, useMemo, useState } from 'react'
import { roundToDecimals } from '@/utils/format'
import {
  evaluateExpression,
  formatCanonicalNumberToPtBr,
  formatExpressionForDisplay,
  toCanonicalNumericString,
} from '@/utils/calculatorExpression'
import { isNumericField } from '@/utils/calculatorDom'

const CALCULATOR_STATE_KEY = 'floating-calculator-state'

interface PersistedCalculatorState {
  expression: string
  lastResult: string
}

const DEFAULT_STATE: PersistedCalculatorState = {
  expression: '0',
  lastResult: '',
}

interface UseCalculatorExpressionOptions {
  resolveTargetInput: () => HTMLInputElement | null
  onClose: () => void
}

/**
 * Estado e operações da expressão da calculadora flutuante:
 * avaliação, operadores unários, envio do resultado e persistência no localStorage.
 */
export function useCalculatorExpression({ resolveTargetInput, onClose }: UseCalculatorExpressionOptions) {
  const [expression, setExpression] = useState(DEFAULT_STATE.expression)
  const [lastResult, setLastResult] = useState(DEFAULT_STATE.lastResult)
  const [hasError, setHasError] = useState(false)

  // WHY: restaura estado persistido da calculadora ao montar
  useEffect(() => {
    try {
      const persistedStateRaw = window.localStorage.getItem(CALCULATOR_STATE_KEY)
      if (!persistedStateRaw) return

      const persistedState = JSON.parse(persistedStateRaw) as PersistedCalculatorState
      if (typeof persistedState.expression === 'string') {
        setExpression(persistedState.expression || DEFAULT_STATE.expression)
      }
      if (typeof persistedState.lastResult === 'string') {
        setLastResult(persistedState.lastResult)
      }
    } catch {
      window.localStorage.removeItem(CALCULATOR_STATE_KEY)
    }
  }, [])

  // WHY: persiste estado da calculadora no localStorage
  useEffect(() => {
    const persistableState: PersistedCalculatorState = {
      expression,
      lastResult,
    }
    window.localStorage.setItem(CALCULATOR_STATE_KEY, JSON.stringify(persistableState))
  }, [expression, lastResult])

  const applyEvaluation = useCallback(() => {
    const result = evaluateExpression(expression)
    if (!result) {
      setHasError(true)
      return null
    }

    setHasError(false)
    setLastResult(result)
    setExpression(result)

    return result
  }, [expression])

  const appendToExpression = useCallback((value: string) => {
    setHasError(false)
    setExpression((previousValue) => (previousValue === '0' ? value : `${previousValue}${value}`))
  }, [])

  const appendConstant = useCallback((constantValue: number) => {
    const constantAsString = String(roundToDecimals(constantValue, 8))

    setHasError(false)
    setExpression((previousValue) => {
      if (previousValue === '0') {
        return constantAsString
      }

      if (/[\d)]$/.test(previousValue)) {
        return `${previousValue}*${constantAsString}`
      }

      return `${previousValue}${constantAsString}`
    })
  }, [])

  const clearExpression = useCallback(() => {
    setHasError(false)
    setExpression('0')
    setLastResult('')
  }, [])

  const backspaceExpression = useCallback(() => {
    setHasError(false)
    setExpression((previousValue) => {
      if (previousValue.length <= 1) {
        return '0'
      }

      return previousValue.slice(0, -1)
    })
  }, [])

  const preloadExpression = useCallback((value: string) => {
    setHasError(false)
    setExpression(toCanonicalNumericString(value))
  }, [])

  const applyUnaryOperation = useCallback((operation: (value: number) => number | null) => {
    const result = evaluateExpression(expression)
    if (!result) {
      setHasError(true)
      return
    }

    const numericValue = Number(result)
    if (!Number.isFinite(numericValue)) {
      setHasError(true)
      return
    }

    const transformedValue = operation(numericValue)
    if (transformedValue === null || !Number.isFinite(transformedValue)) {
      setHasError(true)
      return
    }

    const roundedValue = String(roundToDecimals(transformedValue, 8))
    setHasError(false)
    setExpression(roundedValue)
    setLastResult(roundedValue)
  }, [expression])

  const sendResultToActiveInput = useCallback(() => {
    const result = applyEvaluation()
    if (!result) return

    const activeNumericInput = resolveTargetInput()

    if (!activeNumericInput || !isNumericField(activeNumericInput) || !activeNumericInput.isConnected) {
      return
    }

    activeNumericInput.value = result

    if (activeNumericInput.type !== 'number') {
      activeNumericInput.value = formatCanonicalNumberToPtBr(result)
    }

    // Dispara evento 'input' para React atualizar seu estado interno
    activeNumericInput.dispatchEvent(new Event('input', { bubbles: true }))

    // Guarda referência para usar dentro do microtask
    const targetInput = activeNumericInput

    // queueMicrotask: espera React processar o evento 'input' (atualizar estado)
    // antes de disparar 'blur' e fechar a calculadora.
    // Isso garante que o handler onBlur (ex: AmountInput.handleBlur)
    // leia o valor CORRETO do React, evitando que o valor retorne ao anterior.
    queueMicrotask(() => {
      if (targetInput.isConnected) {
        targetInput.dispatchEvent(new Event('blur', { bubbles: true }))
      }
      setHasError(false)
      setExpression('0')
      setLastResult('')
      onClose()
    })
  }, [applyEvaluation, resolveTargetInput, onClose])

  const displayExpression = useMemo(() => formatExpressionForDisplay(expression), [expression])

  const displayLastResult = useMemo(() => {
    if (!lastResult) {
      return ''
    }

    return formatCanonicalNumberToPtBr(lastResult)
  }, [lastResult])

  return {
    expression,
    lastResult,
    hasError,
    displayExpression,
    displayLastResult,
    preloadExpression,
    applyEvaluation,
    appendToExpression,
    appendConstant,
    clearExpression,
    backspaceExpression,
    applyUnaryOperation,
    sendResultToActiveInput,
  }
}
