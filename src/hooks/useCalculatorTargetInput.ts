import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CALCULATOR_TARGET_CLASS,
  getInputDisplayName,
  getNumericInputs,
  getTopDialog,
  isNumericField,
  isVisibleElement,
  prefersValorField,
} from '@/utils/calculatorDom'

/**
 * Rastreia o campo numérico ativo/destacado para a calculadora flutuante,
 * resolvendo o input de destino (atual ou fallback por heurística).
 */
export function useCalculatorTargetInput(isExpanded: boolean) {
  const [selectedFieldName, setSelectedFieldName] = useState('Nenhum')
  const activeNumericInputRef = useRef<HTMLInputElement | null>(null)
  const highlightedInputRef = useRef<HTMLInputElement | null>(null)
  const isExpandedRef = useRef(false)

  useEffect(() => {
    isExpandedRef.current = isExpanded
  })

  useEffect(() => {
    const updateActiveNumericInput = (event: FocusEvent) => {
      const target = event.target as Element | null
      if (!isNumericField(target)) {
        return
      }

      activeNumericInputRef.current = target
      setSelectedFieldName(getInputDisplayName(target))

      if (!isExpandedRef.current) {
        return
      }

      if (highlightedInputRef.current && highlightedInputRef.current !== target) {
        highlightedInputRef.current.classList.remove(CALCULATOR_TARGET_CLASS)
      }

      target.classList.add(CALCULATOR_TARGET_CLASS)
      highlightedInputRef.current = target
    }

    document.addEventListener('focusin', updateActiveNumericInput)

    return () => {
      document.removeEventListener('focusin', updateActiveNumericInput)
    }
  }, [])

  const clearHighlightedField = useCallback(() => {
    if (!highlightedInputRef.current) return
    highlightedInputRef.current.classList.remove(CALCULATOR_TARGET_CLASS)
    highlightedInputRef.current = null
  }, [])

  const setTargetInput = useCallback((input: HTMLInputElement | null) => {
    clearHighlightedField()

    activeNumericInputRef.current = input

    if (!input) {
      setSelectedFieldName('Nenhum')
      return
    }

    setSelectedFieldName(getInputDisplayName(input))

    if (isExpanded) {
      input.classList.add(CALCULATOR_TARGET_CLASS)
      highlightedInputRef.current = input
    }
  }, [isExpanded, clearHighlightedField])

  const findDefaultNumericInput = useCallback((): HTMLInputElement | null => {
    const activeElement = document.activeElement as Element | null
    const activeForm = activeElement?.closest('form')
    const topDialog = getTopDialog()

    const searchRoots: ParentNode[] = []
    if (topDialog) {
      searchRoots.push(topDialog)
    }
    if (activeForm) {
      searchRoots.push(activeForm)
    }
    searchRoots.push(document)

    for (const root of searchRoots) {
      const numericInputs = getNumericInputs(root)
      if (numericInputs.length === 0) {
        continue
      }

      const preferredValorInput = numericInputs.find(prefersValorField)
      if (preferredValorInput) {
        return preferredValorInput
      }

      return numericInputs[0]
    }

    return null
  }, [])

  const resolveTargetInput = useCallback((): HTMLInputElement | null => {
    const currentTarget = activeNumericInputRef.current
    if (currentTarget && isNumericField(currentTarget) && currentTarget.isConnected && isVisibleElement(currentTarget)) {
      return currentTarget
    }

    const fallbackTarget = findDefaultNumericInput()
    setTargetInput(fallbackTarget)

    return fallbackTarget
  }, [findDefaultNumericInput, setTargetInput])

  useEffect(() => {
    if (isExpanded) {
      const resolvedTarget = resolveTargetInput()
      if (resolvedTarget) {
        resolvedTarget.classList.add(CALCULATOR_TARGET_CLASS)
        highlightedInputRef.current = resolvedTarget
      }
      return
    }

    clearHighlightedField()
  }, [isExpanded, resolveTargetInput, clearHighlightedField])

  useEffect(() => {
    return () => {
      clearHighlightedField()
    }
  }, [clearHighlightedField])

  return {
    selectedFieldName,
    resolveTargetInput,
  }
}
